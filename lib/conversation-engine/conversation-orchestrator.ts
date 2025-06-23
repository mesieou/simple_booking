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

import { ServiceData } from '../database/models/service';
import { ParsedMessage } from '../cross-channel-interfaces/standardized-conversation-interface';
import { UserContext } from '../database/models/user-context';
import { BotResponse } from '../cross-channel-interfaces/standardized-conversation-interface';
import { analyzeConversationIntent, AnalyzedIntent } from './llm-actions/chat-interactions/functions/intention-detector';
import { processTurn } from './state-manager';
import { ChatMessage } from '../database/models/chat-session';
import { OpenAIChatMessage } from './llm-actions/chat-interactions/openai-config/openai-core';
import { getBestKnowledgeMatch } from './llm-actions/chat-interactions/functions/vector-search';
import { generateAgentResponse } from './llm-actions/llm-response-generator';
import { Business } from '../database/models/business';
import { Service } from '../database/models/service';
import { BookingButtonGenerator } from '../Juan-bot-engine/step-handlers/customer-booking-steps';

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

    // A businessId is critical for all subsequent operations.
    const businessId = userContext.businessId;
    if (!businessId) {
        console.error("[Orchestrator] Critical Error: Cannot proceed without a businessId in the user context.");
        const errorResponse: BotResponse = { text: "I'm sorry, there's a configuration issue. I can't access business information right now." };
        return { finalBotResponse: errorResponse, updatedContext: userContext, history };
    }

    let analyzedIntent: AnalyzedIntent;
    const userMessage = parsedMessage.text || '';

    // --- Intent Detection Bypass Logic ---
    // First, check if the user's input is a direct ID match for a service.
    // This is far more reliable than sending a UUID to an LLM for intent analysis.
    const services = await Service.getByBusiness(businessId);
    const serviceIds = services.map(s => s.id);

    if (userMessage && serviceIds.includes(userMessage)) {
        console.log('[Orchestrator] Service ID detected in message. Bypassing LLM intent analysis.');
        // Manually construct the intent, as we know exactly what the user wants.
        analyzedIntent = {
            goalType: 'serviceBooking',
            goalAction: 'create',
            contextSwitch: false,
            confidence: 1.0,
            extractedInformation: { serviceId: userMessage }
        };
    } else {
        // If it's not a service ID, proceed with normal LLM-based intent analysis.
        console.log('[Orchestrator] No service ID match. Proceeding with LLM intent analysis.');
        const historyForAI = mapHistoryForAI(history);
        analyzedIntent = await analyzeConversationIntent(userMessage, historyForAI, userContext);
    }
    
    console.log(`[Orchestrator] Intent Analysis Complete:`, JSON.stringify(analyzedIntent, null, 2));

    // --- Unified Agent Pipeline ---
    // Instead of branching for FAQ vs. Goal, we now run a unified pipeline for every message.
    // The new "Agent Brain" in the response generator will decide how to use this combined context.

    console.log(`[Orchestrator] Executing unified agent pipeline...`);
    
    // 1. Always retrieve knowledge from the knowledge base (RAG).
    const knowledgeContext = await getBestKnowledgeMatch(
        userMessage,
        businessId
    );
    console.log(`[Orchestrator] RAG service found ${knowledgeContext ? 'a match' : 'no match'}.`);

    // 2. Always process the state manager to understand the current task status.
    const taskContext = await processTurn(
        userContext,
        analyzedIntent,
        userMessage,
        parsedMessage.businessWhatsappNumber
    );
    console.log(`[Orchestrator] State Manager processing complete.`);

    // --- Proactive Step Logic ---
    // If the agent is about to answer a question outside of a flow, prepare the service
    // buttons and add them to the context so the agent can introduce them properly.
    if (analyzedIntent.goalType === 'frequentlyAskedQuestion' && !taskContext.currentGoal) {
        console.log('[Orchestrator] Proactively preparing service buttons for the agent.');
        try {
            if (services && services.length > 0) {
                const servicesData = services.map(s => s.getData());
                const serviceButtons = BookingButtonGenerator.createServiceButtons(servicesData);
                // We create a shell context for the agent to see the buttons and for the next step to have the data it needs.
                taskContext.currentGoal = {
                    goalType: 'serviceBooking',
                    goalStatus: 'inProgress',
                    flowKey: 'bookingCreatingForNoneMobileService', // Placeholder
                    currentStepIndex: 0,
                    collectedData: {
                        uiButtons: serviceButtons,
                        availableServices: servicesData // Add the services list to the context
                    }
                };
            }
        } catch (error) {
            console.error('[Orchestrator] Failed to fetch services for proactive offer.', error);
        }
    }
    
    // --- Special Instructions for Agent ---
    // Check for the specific scenario where we want to list services proactively.
    let specialInstructions: string | undefined = undefined;
    const validationFailureReason =
      taskContext.currentGoal?.collectedData?.validationFailureReason;
    const isNewBookingFlow =
      analyzedIntent.goalType === 'serviceBooking' &&
      (!userContext.currentGoal || userContext.currentGoal.currentStepIndex === 0);

    if (validationFailureReason === 'NOT_FOUND' && isNewBookingFlow) {
      const availableServices = taskContext.currentGoal?.collectedData
        ?.availableServices as ServiceData[] | undefined;
      if (availableServices && availableServices.length > 0) {
        const serviceList = availableServices
          .map(
            service =>
              `* ${service.name} - $${service.fixedPrice} (${service.durationEstimate} min)`,
          )
          .join('\n');
        specialInstructions = `The user asked for a service we don't offer. First, politely inform them of this. Then, you MUST proactively list the services we DO offer, formatted as a clear, bulleted list with name, price, and duration. For example: "We offer the following services:\n* Basic Manicure - $40 (30 min)\n* Gel Pedicure - $60 (45 min)". The available services are:\n${serviceList}\n\nThis overrides the rule about not repeating button text. Finally, ask the user to select an option from the buttons below to proceed.`;
      }
    }

    // 3. Always get business identity for personalization.
    let businessName = 'the salon'; // Default fallback
    try {
        const business = await Business.getById(businessId);
        if (business && business.name) {
            businessName = business.name;
        }
    } catch (error) {
        console.error(`[Orchestrator] Could not fetch business name for ID: ${businessId}`, error);
    }

    // 4. Call the central "Agent Brain" with all gathered context to generate a response.
    // This new function will be responsible for synthesizing everything into a single, coherent reply.
    const finalBotResponse = await generateAgentResponse({
        userMessage,
        chatHistory: history,
        knowledgeContext,
        taskContext,
        businessName,
        specialInstructions,
    });
    
    // 5. Clean up temporary response data from the context before it's saved.
    // This is a carry-over and might be removed when the new agent is fully implemented.
    if (taskContext.currentGoal?.collectedData) {
        delete taskContext.currentGoal.collectedData.confirmationMessage;
    }

    // 6. Append the latest turn to the history that will be returned.
    // The webhook is responsible for persisting this.
    const updatedHistory = [
        ...history,
        { role: 'user' as const, content: parsedMessage.text || '' },
        { role: 'bot' as const, content: finalBotResponse.text || '' }
    ];

    // 7. Return the final response and the updated context to the webhook.
    return {
        finalBotResponse,
        updatedContext: taskContext,
        history: updatedHistory
    };
} 