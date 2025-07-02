import { type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { type ChatContext } from "@/lib/bot-engine/types";
import { type ChatMessage } from "@/lib/database/models/chat-session";
import { RAGfunction } from "@/lib/shared/llm/functions/embeddings";
import { executeChatCompletion, type OpenAIChatMessage } from "@/lib/shared/llm/openai/openai-core";
import { START_BOOKING_PAYLOAD } from "@/lib/bot-engine/config/constants";

/**
 * Handles FAQ and chitchat messages with natural user creation flow.
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

  // Check if we need to handle user creation first
  const userCreationResult = await handleUserCreationIfNeeded(chatContext, userMessage, userLanguage);
  if (userCreationResult) {
    return userCreationResult;
  }

  let chatbotResponseText: string;

  // Create language instruction for AI
  const languageInstruction = userLanguage === 'es' 
    ? 'IMPORTANTE: Responde SIEMPRE en ESPAÑOL.' 
    : 'IMPORTANT: Respond ALWAYS in ENGLISH.';

  try {
    // Get relevant context using RAG
    const ragResults = await RAGfunction(businessId, userMessage);
    
    // Check if we have a known user for personalization
    const sessionUserInfo = chatContext.currentConversationSession?.userData;
    const customerName = sessionUserInfo?.customerName;
    
    // Check if this is a booking-related request from a known user
    const isBookingRequest = /book|appointment|reserve|schedule|available|availability/i.test(userMessage);
    
    if (customerName && isBookingRequest && ragResults && ragResults.length > 0) {
      console.log(`[handleFaqOrChitchat] Detected booking request from known user: ${customerName}`);
      
      // Extract available times from RAG results for personalized message
      const context = ragResults.map(r => r.content).join('\n---\n');
      const timesMatch = context.match(/(\d{1,2}:\d{2}\s*(AM|PM))/gi);
      const availableTimes = timesMatch ? timesMatch.slice(0, 6).join(', ') : '8:00 AM, 9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM';
      
      // Use personalized booking availability message
      const { BOOKING_TRANSLATIONS } = await import('@/lib/bot-engine/config/translations');
      const translations = BOOKING_TRANSLATIONS[userLanguage];
      
      if (translations?.MESSAGES?.BOOKING_AVAILABILITY_PERSONALIZED) {
        chatbotResponseText = translations.MESSAGES.BOOKING_AVAILABILITY_PERSONALIZED
          .replace('{name}', customerName)
          .replace('{times}', availableTimes);
      } else {
        // Fallback if translation not found
        chatbotResponseText = userLanguage === 'es' 
          ? `📅 ¡Hola ${customerName}! Por supuesto, me encantaría ayudarte a reservar otra cita. Tenemos excelente disponibilidad hoy con espacios a las ${availableTimes}. ¡Por favor déjame saber qué fecha y hora te funcionan mejor! 😊`
          : `📅 Hello ${customerName}! Of course, I'd be happy to help you book another appointment. We have excellent availability today with slots at ${availableTimes}. Please let me know what date and time work best for you, and I'll get that booked right away! 😊`;
      }
    } else {
      // Continue with normal FAQ processing but with personalization
      // Create a simple text representation of the conversation history for the AI
      let systemPrompt: string;

      const historyText = messageHistory
        .slice(-6) // Get the last 6 messages for context
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      if (ragResults && ragResults.length > 0) {
        console.log(`[handleFaqOrChitchat] Found ${ragResults.length} relevant document(s). Using them to generate response.`);
        const context = ragResults.map(r => r.content).join('\n---\n');
        systemPrompt = `You are a helpful assistant for a booking system. A user is asking a question. Use the conversation history for context to understand the question fully. 
        
        **CRITICAL: Give clear, direct answers based on the provided information.**
        
        **PERSONALIZATION RULES:**
        - The customer's name is: ${customerName || 'Unknown'}
        ${customerName ? `- ALWAYS use "${customerName}" naturally in your response to make it personal` : '- No customer name available'}
        - Make responses warm and personal when possible
        - Use friendly emoticons when appropriate
        
        **AVAILABILITY & SCHEDULING RULES:**
        - If user asks about availability, times, or when to book → Use the SPECIFIC dates and times from the information
        - Show ACTUAL available times like "7:00 AM, 8:00 AM, 9:00 AM" when available
        - Mention SPECIFIC days like "This Monday", "Next Friday" when provided
        - If asking about a specific day (like Monday), highlight that day's availability
        
        **SERVICE AVAILABILITY RULES:**
        - If user asks about a service that's NOT in the information → clearly say "No, we don't offer [service]"
        - If user asks about a service that IS in the information → provide details about that service
        - Always mention what services ARE available after saying what's not available
        
        **EXAMPLES:**
        - User asks "when are you available?" with specific times → "We have availability This Tuesday: 7:00 AM, 8:00 AM, 9:00 AM, and Next Friday: 7:00 AM, 8:00 AM..."
        - User asks "do you do haircuts" but info only shows manicures → "No, we don't offer haircut services. We specialize in manicures and pedicures."
        - User asks "do you do manicures" and info shows manicures → "Yes! We offer several manicure services including..."
        
        **NEVER say "I don't have specific information" when you have detailed times and dates - USE THEM!**
        
        ${languageInstruction}
        
        **IMPORTANT**: After answering the question, ALWAYS offer to help the user book an appointment for the services we DO offer.
        
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
        
        **PERSONALIZATION RULES:**
        - The customer's name is: ${customerName || 'Unknown'}
        ${customerName ? `- ALWAYS use "${customerName}" naturally in your response to make it personal` : '- No customer name available'}
        - Make responses warm and personal when possible
        - Use friendly emoticons when appropriate
        
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
    }

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

/**
 * Handles user creation flow during initial FAQ interaction
 */
async function handleUserCreationIfNeeded(
  chatContext: ChatContext,
  userMessage: string,
  userLanguage: string
): Promise<BotResponse | null> {
  const customerWhatsappNumber = chatContext.currentParticipant.customerWhatsappNumber;
  
  if (!customerWhatsappNumber) {
    console.warn('[handleFaqOrChitchat] No customer WhatsApp number available');
    return null;
  }

  try {
    // Check if this conversation already has user info or if we're in the middle of collecting it
    const sessionUserInfo = chatContext.currentConversationSession?.userData;
    
    // If we're waiting for a name (user creation in progress)
    if (sessionUserInfo?.awaitingName) {
      // Validate the name
      if (userMessage && userMessage.length >= 2 && !userMessage.includes('uuid') && !userMessage.includes('@')) {
        console.log('[handleFaqOrChitchat] Creating user with provided name:', userMessage);
        
        // Create the user
        const { User } = await import('@/lib/database/models/user');
        const newUser = new User(
          userMessage.trim(),
          '',
          'customer',
          chatContext.currentParticipant.associatedBusinessId || ''
        );
        
        await newUser.add({
          whatsappNumber: customerWhatsappNumber
        });
        
        // Update session to indicate user is created and clear awaitingName
        if (chatContext.currentConversationSession) {
          chatContext.currentConversationSession.userData = {
            userId: newUser.id,
            customerName: newUser.firstName,
            existingUserFound: false,
            originalQuestion: sessionUserInfo.originalQuestion // Preserve original question
          };
        }
        
        // If we have an original question stored, process it now instead of generic welcome
        if (sessionUserInfo.originalQuestion) {
          console.log('[handleFaqOrChitchat] Processing stored original question after user creation:', sessionUserInfo.originalQuestion);
          
          // Process the original question with the new user context
          const businessId = chatContext.currentParticipant.associatedBusinessId;
          const ragResults = await RAGfunction(businessId!, sessionUserInfo.originalQuestion);
          
          let responseText: string;
          
          if (ragResults && ragResults.length > 0) {
            console.log(`[handleFaqOrChitchat] Found ${ragResults.length} relevant document(s) for original question.`);
            const context = ragResults.map(r => r.content).join('\n---\n');

            const languageInstruction = userLanguage === 'es' 
              ? 'IMPORTANTE: Responde SIEMPRE en ESPAÑOL.' 
              : 'IMPORTANT: Respond ALWAYS in ENGLISH.';

            const systemPrompt = `You are a helpful assistant for a booking system. A user asked a question, then provided their name. Now answer their original question in a personalized way.
            
            **CRITICAL: Give clear, direct answers based on the provided information.**
            
            **PERSONALIZATION RULES:**
            - Use the customer's name (${newUser.firstName}) naturally in your response
            - Make the response warm and personal since this is after introductions
            
            **AVAILABILITY & SCHEDULING RULES:**
            - If user asks about availability, times, or when to book → Use the SPECIFIC dates and times from the information
            - Show ACTUAL available times like "7:00 AM, 8:00 AM, 9:00 AM" when available
            - Mention SPECIFIC days like "This Monday", "Next Friday" when provided
            - If asking about a specific day (like Monday), highlight that day's availability
            
            **SERVICE AVAILABILITY RULES:**
            - If user asks about a service that's NOT in the information → clearly say "No, we don't offer [service]"
            - If user asks about a service that IS in the information → provide details about that service
            - Always mention what services ARE available after saying what's not available
            
            **EXAMPLES:**
            - User asks "when are you available?" with specific times → "We have availability This Tuesday: 7:00 AM, 8:00 AM, 9:00 AM, and Next Friday: 7:00 AM, 8:00 AM..."
            - User asks "do you do haircuts" but info only shows manicures → "No, we don't offer haircut services. We specialize in manicures and pedicures."
            - User asks "do you do manicures" and info shows manicures → "Yes! We offer several manicure services including..."
            
            **NEVER say "I don't have specific information" when you have detailed times and dates - USE THEM!**
            
            ${languageInstruction}
            
            **IMPORTANT**: After answering the question, ALWAYS offer to help the user book an appointment for the services we DO offer.
            
            **FORMATTING RULES FOR WHATSAPP**:
            - To make text bold, wrap it in single asterisks: *your bold text*.
            - To make text italic, wrap it in single underscores: _your italic text_.
            - For lists, use a hyphen or an asterisk followed by a space.
            - Do NOT use other markdown like headers (#), or combine asterisks and spaces. The formatting should be clean and simple for WhatsApp.

            Information:
            ---
            ${context}
            ---`;

            const messages: OpenAIChatMessage[] = [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: sessionUserInfo.originalQuestion }
            ];

            try {
              const llmResponse = await executeChatCompletion(messages, "gpt-4o", 0.7, 2048);
              responseText = llmResponse.choices[0]?.message?.content?.trim() || `Nice to meet you, ${newUser.firstName}! I'd be happy to help with your question.`;
            } catch (error) {
              console.error('[handleFaqOrChitchat] Error processing original question:', error);
              responseText = `Nice to meet you, ${newUser.firstName}! I'd be happy to help with your question.`;
            }
          } else {
            // No relevant context found, give a personalized response
            responseText = userLanguage === 'es' 
              ? `¡Encantado de conocerte, ${newUser.firstName}! Permíteme ayudarte con tu pregunta.`
              : `Nice to meet you, ${newUser.firstName}! Let me help you with your question.`;
          }
          
          // Create localized button text
          const buttonText = userLanguage === 'es' ? 'Reservar una cita' : 'Book an Appointment';
          const buttonDescription = userLanguage === 'es' ? 'Iniciar el proceso de reserva' : 'Start the booking process';

          return {
            text: responseText,
            buttons: [
              {
                buttonText,
                buttonValue: START_BOOKING_PAYLOAD,
                buttonType: "postback",
                buttonDescription,
              },
            ],
          };
        } else {
          // No original question stored, give generic welcome
          const welcomeMessage = userLanguage === 'es' 
            ? `¡Encantado de conocerte, ${newUser.firstName}! ¿En qué puedo ayudarte hoy?`
            : `Nice to meet you, ${newUser.firstName}! How can I help you today?`;
          
          return {
            text: welcomeMessage
          };
        }
      } else {
        // Invalid name, ask again
        const errorMessage = userLanguage === 'es'
          ? 'Por favor proporciona tu nombre (al menos 2 letras):'
          : 'Please provide your name (at least 2 letters):';
        
        return {
          text: errorMessage
        };
      }
    }
    
    // Check if user already exists or is already known in this session
    if (sessionUserInfo?.userId) {
      console.log('[handleFaqOrChitchat] User already known in session:', sessionUserInfo.customerName);
      return null; // Continue with normal FAQ flow
    }
    
    // Check if user exists in database
    const { User } = await import('@/lib/database/models/user');
    const existingUser = await User.findUserByCustomerWhatsappNumber(customerWhatsappNumber);
    
    if (existingUser) {
      console.log('[handleFaqOrChitchat] Found existing user:', existingUser.firstName);
      
      // Store user info in session
      if (chatContext.currentConversationSession) {
        chatContext.currentConversationSession.userData = {
          userId: existingUser.id,
          customerName: existingUser.firstName,
          existingUserFound: true
        };
      }
      
      return null; // Continue with normal FAQ flow (will now be personalized)
    }
    
    // No existing user found, ask for name naturally and store original question
    console.log('[handleFaqOrChitchat] No existing user found, asking for name and storing original question');
    
    // Mark that we're waiting for a name and store the original question
    if (chatContext.currentConversationSession) {
      chatContext.currentConversationSession.userData = {
        awaitingName: true,
        originalQuestion: userMessage // Store the original question to process after user creation
      };
    }
    
    const nameRequestMessage = userLanguage === 'es'
      ? '¡Hola! Me encantaría ayudarte. ¿Cómo te llamas para poder asistirte mejor?'
      : 'Hi! I\'d love to help you. What\'s your name so I can assist you better?';
    
    return {
      text: nameRequestMessage
    };
    
  } catch (error) {
    console.error('[handleFaqOrChitchat] Error during user creation process:', error);
    return null; // Continue with normal FAQ flow
  }
} 