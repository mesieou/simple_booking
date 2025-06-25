import { type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { type ChatContext } from "../bot-manager";
import { type ChatMessage } from "@lib/database/models/chat-session";
import { RAGfunction } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/embeddings";
import { executeChatCompletion, type OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";
import { START_BOOKING_PAYLOAD } from "../bot-manager-helpers";

/**
 * Handles FAQ and chitchat messages.
 *
 * @param chatContext - The current chat context.
 * @param userMessage - The message from the user.
 * @param messageHistory - The past messages in the conversation.
 * @returns A BotResponse object with the chatbot's reply.
 */
export async function handleFaqOrChitchat(
  chatContext: ChatContext,
  userMessage: string,
  messageHistory: ChatMessage[]
): Promise<BotResponse> {
  const businessId = chatContext.currentParticipant.associatedBusinessId;
  const userLanguage = chatContext.participantPreferences.language || 'en';
  console.log(`[handleFaqOrChitchat] Handling FAQ/Chitchat for business ${businessId} in language: ${userLanguage}`);

  if (!businessId) {
    console.error("[handleFaqOrChitchat] Critical: associatedBusinessId is missing from chatContext.");
    return {
      text: "I'm sorry, I'm having trouble identifying the business you're asking about. Please start over.",
    };
  }

  let chatbotResponseText: string;

  // Create language instruction for AI
  const languageInstruction = userLanguage === 'es' 
    ? 'IMPORTANTE: Responde SIEMPRE en ESPAÑOL.' 
    : 'IMPORTANT: Respond ALWAYS in ENGLISH.';

  try {
    const ragResults = await RAGfunction(businessId, userMessage);
    
    console.log('[handleFaqOrChitchat] Top 3 RAG results:', JSON.stringify(
      ragResults.map(r => ({
        documentId: r.documentId,
        source: r.source,
        type: r.type,
        similarity: r.similarityScore,
        content: r.content.substring(0, 100) + '...'
      })), null, 2
    ));

    let systemPrompt: string;

    const historyText = messageHistory
      .slice(-6) // Get the last 6 messages for context
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    if (ragResults && ragResults.length > 0) {
      console.log(`[handleFaqOrChitchat] Found ${ragResults.length} relevant document(s). Using them to generate response.`);
      const context = ragResults.map(r => r.content).join('\n---\n');
      systemPrompt = `You are a helpful assistant for a booking system. A user is asking a question. Use the conversation history for context to understand the question fully. 
      Formulate your answer based ONLY on the provided "Information" section. Be conversational and friendly.
      If the information doesn't seem to contain the answer, say that you don't have that specific information but you can try to help with something else.
      
      ${languageInstruction}
      
      **IMPORTANT**: After answering the question, ALWAYS offer to help the user book an appointment, as this is your main function.
      
      **FORMATTING RULES FOR WHATSAPP**:
      - To make text bold, wrap it in single asterisks: *your bold text*.
      - To make text italic, wrap it in single underscores: _your italic text_.
      - For lists, use a hyphen or an asterisk followed by a space.
      - Do NOT use other markdown like headers (#), or combine asterisks and spaces. The formatting should be clean and simple for WhatsApp.

      CONVERSATION HISTORY:
      ---
      ${historyText}
      ---

      Information:
      ---
      ${context}
      ---`;
    } else {
      console.log(`[handleFaqOrChitchat] No relevant document found. Treating as chitchat.`);
      systemPrompt = `You are a friendly and helpful assistant for a booking system. The user is making small talk or asking a general question. 
      Use the conversation history for context and respond conversationally and naturally.
      
      ${languageInstruction}
      
      **IMPORTANT**: After your response, ALWAYS offer to help the user book an appointment, as this is your main function.

      **FORMATTING RULES FOR WHATSAPP**:
      - To make text bold, wrap it in single asterisks: *your bold text*.
      - To make text italic, wrap it in single underscores: _your italic text_.
      - Do NOT use other markdown like headers (#).
      `;
    }

    const messages: OpenAIChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ];

    const llmResponse = await executeChatCompletion(messages, "gpt-4o", 0.7, 2048);
    chatbotResponseText = llmResponse.choices[0]?.message?.content?.trim() || "I'm not sure how to respond to that, but I'm here to help!";

  } catch (error) {
    console.error(`[handleFaqOrChitchat] Error during FAQ processing:`, error);
    chatbotResponseText = "I'm sorry, I had a little trouble understanding that. Could you try asking in a different way?";
  }
  
  // Create localized button text
  const buttonText = userLanguage === 'es' ? 'Reservar una cita' : 'Book an Appointment';
  const buttonDescription = userLanguage === 'es' ? 'Iniciar el proceso de reserva' : 'Start the booking process';

  return {
    text: chatbotResponseText,
    buttons: [
      {
        buttonText,
        buttonValue: START_BOOKING_PAYLOAD,
        buttonType: "postback",
        buttonDescription,
      },
    ],
  };
} 