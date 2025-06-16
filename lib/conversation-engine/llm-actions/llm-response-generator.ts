/**
 * @file This file contains the LLM Response Generator service.
 * @description This service is responsible for taking a full conversational and task context
 * and using an LLM to generate a single, coherent, and intelligent response. It functions
 * as the "brain" of the conversational agent.
 */

import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { UserContext } from "@/lib/database/models/user-context";
import { executeChatCompletion, OpenAIChatMessage, ChatMessage } from "./chat-interactions/openai-config/openai-core";
import { ButtonConfig } from "../state-manager";

/**
 * Defines the comprehensive context object required by the agent to generate a response.
 */
export interface AgentContext {
  userMessage: string;
  chatHistory: ChatMessage[];
  knowledgeContext: string | null;
  taskContext: UserContext;
  businessName: string;
  specialInstructions?: string;
}

/**
 * Acts as the central "Agent Brain". It receives a comprehensive context of the conversation
 * and the user's task status, then generates a single, coherent, and intelligent response.
 * This function replaces the older, more rigid 'rephrase' and 'faq_answer' modes.
 *
 * @param {AgentContext} context - A single object containing all necessary information for the agent.
 * @returns {Promise<BotResponse>} A promise that resolves to the final bot response object.
 */
export async function generateAgentResponse(context: AgentContext): Promise<BotResponse> {
  const { userMessage, chatHistory, knowledgeContext, taskContext, businessName, specialInstructions } = context;

  const systemPrompt = `You are a friendly, highly intelligent AI assistant for "${businessName}". Your primary goal is to provide a seamless, human-like conversational experience. You must skillfully blend answering the user's questions with guiding them through their booking task.

**CRITICAL INSTRUCTIONS:**

1.  **ANALYZE THE FULL CONTEXT:** You will be given the user's latest message, the recent chat history, potentially relevant information from our knowledge base, and the current status of their booking task. You must use all of this information to craft your response.

2.  **PRIORITIZE QUESTIONS:** Your first priority is to identify and answer any explicit questions in the user's message.
    *   Use the "Knowledge Base Info" as your primary source of truth.
    *   If the Knowledge Base Info is not provided or does not seem relevant to the user's question, you MUST state that you don't have the information. For example, if the user asks for "haircuts" and the knowledge base is empty or talks about something else, you should politely say, "Unfortunately, we don't offer haircuts."
    *   If you can answer, do so concisely and naturally.

3.  **ADVANCE THE TASK:** After addressing any questions, your second priority is to advance the user's booking task.
    *   The "Current Task Status" section will tell you what the next logical step is. It will often include a "Suggested Next Action" message.
    *   Use this as a guide to ask the next question or present the next set of options to the user. You do not need to use the exact wording of the suggested action; rephrase it to fit the conversational flow.

4.  **SYNTHESIZE, DON'T SEPARATE:** Combine your answer to the user's question and the next step of the task into a *single, fluid response*. Do not answer the question and then ask another question in two separate paragraphs.

5.  **HANDLE NO-QUESTION SCENARIOS:** If the user's message is not a question (e.g., they just say "Okay", select a button, or provide requested information), focus entirely on smoothly executing the "Current Task Status" step.

6.  **LEAD INTO THE UI:** If you see "uiButtons" listed in the "Current Task Status" data, your response MUST end with a clear call to action that directs the user to those buttons. For example: "...please select one of the options below:" or "...here are the services we offer:".

7.  **AVOID REDUNDANCY:** A list of button titles will be provided in the context below under "UI Buttons to be Displayed". **IT IS FORBIDDEN** for you to repeat the text from this list in your response. Your text should only introduce the action the user needs to take with these buttons.

8.  **FORMAT BOOKING SUMMARIES:** If the 'bookingSummary' data is present in the "Current Task Status", you MUST format it into a clear, attractive, bulleted list for the user. Use emojis to make it friendly and easy to read (e.g., 💼 Service, 📅 Date, ⏰ Time, 💰 Price). This is a primary display task.

9.  **TONE & FORMATTING:** Maintain a warm, friendly, and helpful tone. For WhatsApp, use only single asterisks * for bold and single underscores _ for italics. Never use double asterisks or other unsupported markdown.`;

  const recentHistory = chatHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n');
  const goalType = taskContext.currentGoal?.goalType || 'None';
  // Pruning collectedData for the prompt to avoid excessive length and focus on key items
  const prunedData = { ...taskContext.currentGoal?.collectedData };
  delete prunedData.availableServices;
  delete prunedData.next3AvailableSlots;
  delete prunedData.availableDays;
  delete prunedData.availableHours;
  delete prunedData.formattedAvailableHours;
  delete prunedData.persistedQuote;
  // Keep bookingSummary so the agent can see and format it
  // delete prunedData.bookingSummary;

  const collectedData = JSON.stringify(prunedData, null, 2);
  const suggestedActionText = taskContext.currentGoal?.collectedData?.confirmationMessage || 'No specific action suggested. Decide what to do next based on the conversation.';
  const uiButtons = (taskContext.currentGoal?.collectedData?.uiButtons as ButtonConfig[] | undefined)?.map(btn => btn.buttonText) || [];

  const userPrompt = `Here is the full context for your response.
${specialInstructions ? `
---
**HIGH PRIORITY DIRECTIVE (OVERRIDE OTHER RULES):**
${specialInstructions}
---
` : ''}
---
**1. User's Latest Message:**
"${userMessage}"

---
**2. Recent Conversation History (for conversational context):**
${recentHistory}

---
**3. Knowledge Base Info (for answering questions):**
${knowledgeContext || "No information found in the knowledge base."}

---
**4. Current Task Status (for advancing the booking):**
*   Current Goal: ${goalType}
*   Data Collected So Far: ${collectedData}
*   Suggested Next Action: "${suggestedActionText}"

---
**5. UI Buttons to be Displayed (DO NOT REPEAT THESE IN YOUR RESPONSE):**
[${uiButtons.map(text => `"${text}"`).join(', ')}]
---
Based on all of this context, please generate your response now.`;

  try {
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const llmResult = await executeChatCompletion(messages, 'gpt-4o', 0.5, 300);
    const generatedMessage = llmResult.choices[0]?.message?.content?.trim();

    const fallbackResponse: BotResponse = {
      text: suggestedActionText.replace('[DYNAMIC_GREETING]', '').trim(), // Ensure old placeholders are removed
      buttons: (taskContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[],
    };

    if (!generatedMessage) {
        console.warn("[AgentBrain] LLM returned an empty response. Falling back to suggested action.");
        return fallbackResponse;
    }

    console.log(`[AgentBrain] LLM-generated message: "${generatedMessage}"`);
    
    const finalResponse: BotResponse = {
      text: generatedMessage,
      buttons: (taskContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[],
    };

    return finalResponse;

  } catch (error) {
    console.error("[AgentBrain] Fallback Activated: LLM call failed. Using raw suggested action text.", error);
    // CRITICAL: If the agent fails, fall back to the raw action from the state manager.
    const fallbackResponse: BotResponse = {
        text: suggestedActionText.replace('[DYNAMIC_GREETING]', '').trim(), // Ensure old placeholders are removed
        buttons: (taskContext.currentGoal?.collectedData?.uiButtons || []) as ButtonConfig[],
    };
    return fallbackResponse;
  }
}
