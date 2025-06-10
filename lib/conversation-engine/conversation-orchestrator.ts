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

export interface OrchestratorResult {
    finalBotResponse: BotResponse;
    updatedContext: UserContext;
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

    // Step 2: Call the "State Manager" to process the turn based on the intent.
    const updatedContext = await processTurn(
        userContext, 
        analyzedIntent, 
        parsedMessage.text || '', 
        parsedMessage.businessWhatsappNumber
    );
    console.log(`[Orchestrator] State Manager processing complete.`);

    // Step 3: Extract the response and buttons from the updated context's goal data.
    // The state manager places the response here for the orchestrator to find.
    const responseText = updatedContext.currentGoal?.collectedData?.confirmationMessage || "Sorry, I'm not sure how to help with that. Can you please try rephrasing?";
    const responseButtons = (updatedContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[];
    
    const finalBotResponse: BotResponse = {
        text: responseText,
        buttons: responseButtons
    };
    
    // Step 4: Clean up temporary response data from the context before it's saved.
    // This prevents the response from one turn from being accidentally used in the next.
    if (updatedContext.currentGoal?.collectedData) {
        delete updatedContext.currentGoal.collectedData.confirmationMessage;
        delete updatedContext.currentGoal.collectedData.uiButtons;
    }

    // Step 5: Return the final response and the updated context to the webhook.
    return {
        finalBotResponse,
        updatedContext
    };
} 