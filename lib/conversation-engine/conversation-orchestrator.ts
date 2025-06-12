/**
 * lib/conversation-engine/conversation-orchestrator.ts
 *
 * The Conversation Orchestrator.
 * This is the central "General Manager" of the conversational flow.
 *
 * Its responsibilities are:
 * 1.  Receive the parsed message and the user's current state (UserContext).
 * 2.  Call the "AI Brain" (intention-detector) to understand the user's intent.
 * 3.  Call the "Factory Foreman" (state-manager) to execute the next step of the user's goal.
 * 4.  Return the final bot response and the updated user state to the caller (e.g., the webhook).
 */

import { ParsedMessage } from '../cross-channel-interfaces/standardized-conversation-interface';
import { UserContext } from '../database/models/user-context';
import { BotResponse } from '../cross-channel-interfaces/standardized-conversation-interface';
import { analyzeConversationIntent } from './llm-actions/chat-interactions/functions/intention-detector';
import { processTurn } from './state-manager';
import { ChatMessage } from '../database/models/chat-session';
import { OpenAIChatMessage } from './llm-actions/chat-interactions/openai-config/openai-core';
import { ButtonConfig } from './state-manager';
import { enhanceBotResponse } from './llm-actions/llm-response-generator';
import { classifyFaq } from './llm-actions/chat-interactions/functions/faq-category-classifier';
import { getBestKnowledgeMatch } from './llm-actions/chat-interactions/functions/vector-search';
import { CATEGORY_DISPLAY_NAMES } from '@/lib/general-config/general-config';

export interface OrchestratorResult {
    finalBotResponse: BotResponse;
    updatedContext: UserContext;
    history: ChatMessage[]
}

/**
 * Maps the chat history from the ChatMessage format (our DB) to the OpenAIChatMessage format
 * that the AI model expects. ('bot' -> 'assistant')
 * @param history The chat history from the database.
 * @returns The chat history formatted for the AI.
 */
function mapHistoryForAI(history: ChatMessage[]): OpenAIChatMessage[] {
    return history.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
    }));
}

/**
 * The main orchestration function. It directs the flow of a single conversational turn.
 * @param parsedMessage The standardized message received from the channel.
 * @param userContext The user's current state, fetched from the database.
 * @param history The user's full conversation history from the chat session.
 * @returns A promise resolving to the bot's response and the new user state.
 */
export async function routeInteraction(
    parsedMessage: ParsedMessage,
    userContext: UserContext,
    history: ChatMessage[]
): Promise<OrchestratorResult> {

    // Step 1: Call the "AI Brain" to analyze the user's intent.
    const historyForAI = mapHistoryForAI(history);
    const analyzedIntent = await analyzeConversationIntent(parsedMessage.text || '', historyForAI, userContext);
    console.log(`[Orchestrator] Intent Analysis Complete:`, JSON.stringify(analyzedIntent, null, 2));

    // --- Proactive FAQ Check ---
    // If the intent is FAQ, handle it immediately, even if another goal is in progress.
    // This allows users to ask questions anytime without breaking the flow.
    if (analyzedIntent.goalType === 'frequentlyAskedQuestion') {
        console.log("[Orchestrator] FAQ Intent Detected. Routing to RAG service.");

        const businessId = userContext.businessId;
        if (!businessId) {
            console.error("[Orchestrator] Cannot run FAQ pipeline without a businessId in the user context.");
            const errorResponse: BotResponse = { text: "I'm sorry, there was a system error and I can't look up information right now." };
            return { finalBotResponse: errorResponse, updatedContext: userContext, history };
        }
        
        const userQuestion = parsedMessage.text || '';

        // 1. Get the raw text from the knowledge base.
        const knowledgeBaseText = await getBestKnowledgeMatch(
            userQuestion,
            businessId
        );
        
        // 2. Prepare the raw response and call the central enhancer in 'faq_answer' mode.
        const rawText = knowledgeBaseText || "I'm sorry, I couldn't find an answer to your question in our knowledge base. Could I help with anything else?";
        const rawBotResponse: BotResponse = { text: rawText };

        let finalBotResponse = await enhanceBotResponse(
            rawBotResponse,
            userContext,
            history,
            'faq_answer',
            userQuestion
        );

        // 3. After answering, add a prompt to guide the user back to their original task, if applicable.
        const isGoalInProgress = userContext.currentGoal && userContext.currentGoal.goalType !== 'idle';
        if (isGoalInProgress) {
            const previousStepPrompt = userContext.currentGoal?.collectedData?.reengagementMessage || "Now, where were we? Shall we continue?";
            const resumeButtons = (userContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[];
            
            finalBotResponse.text = `${finalBotResponse.text}\n\n${previousStepPrompt}`;
            finalBotResponse.buttons = resumeButtons;
        }

        // Return the FAQ answer but keep the original context unchanged, so the user can continue their task.
        return { finalBotResponse, updatedContext: userContext, history };
    } 
    
    // --- GOAL-ORIENTED PIPELINE (Booking, etc.) ---
    // If it's not an FAQ, proceed with the stateful, goal-oriented flow.
    console.log("[Orchestrator] Goal-Oriented Intent Detected. Routing to State Manager.");

    const updatedContext = await processTurn(
        userContext, 
        analyzedIntent, 
        parsedMessage.text || '', 
        parsedMessage.businessWhatsappNumber
    );
    console.log(`[Orchestrator] State Manager processing complete.`);

    // Step 3: Extract the raw response and buttons from the updated context's goal data.
    const rawResponseText = updatedContext.currentGoal?.collectedData?.confirmationMessage || "Sorry, I'm not sure how to help with that. Can you please try rephrasing?";
    const responseButtons = (updatedContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[];
    
    const rawBotResponse: BotResponse = {
        text: rawResponseText,
        buttons: responseButtons
    };
    
    // Step 3.5: Pass the raw response through the LLM Enhancer to get the final version.
    const finalBotResponse = await enhanceBotResponse(rawBotResponse, userContext, history, 'rephrase');

    // Step 4: Clean up temporary response data from the context before it's saved.
    if (updatedContext.currentGoal?.collectedData) {
        delete updatedContext.currentGoal.collectedData.confirmationMessage;
        delete updatedContext.currentGoal.collectedData.uiButtons;
    }

    // Step 4.5: IMPORTANT - Update the history with the final, enhanced message.
    if (updatedContext.currentGoal?.messageHistory) {
        const lastMessageIndex = updatedContext.currentGoal.messageHistory.findLastIndex(
            (msg) => msg.speakerRole === 'chatbot'
        );
        if (lastMessageIndex !== -1 && finalBotResponse.text) {
            updatedContext.currentGoal.messageHistory[lastMessageIndex].content = finalBotResponse.text;
        }
    }

    // Step 5: Return the final response and the updated context to the webhook.
    return {
        finalBotResponse,
        updatedContext,
        history
    };
} 