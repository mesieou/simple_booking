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

  // Initialize with a default fallback value
  let chatbotResponseText = "I'm not sure how to respond to that, but I'm here to help!";

  // Create language instruction for AI
  const languageInstruction = userLanguage === 'es' 
    ? 'IMPORTANTE: Responde SIEMPRE en ESPAÑOL.' 
    : 'IMPORTANT: Respond ALWAYS in ENGLISH.';

  try {
    // Get relevant context using RAG (which already does smart classification)
    const ragResults = await RAGfunction(businessId, userMessage);
    
    // Check if we have a known user for personalization
    const sessionUserInfo = chatContext.currentConversationSession?.userData;
    const customerName = sessionUserInfo?.customerName;
    
    console.log(`[handleFaqOrChitchat] Found ${ragResults?.length || 0} relevant results for: "${userMessage}"`);
    
    // Check if there's an active booking goal to determine context (used by both RAG and chitchat)
    const activeBookingGoal = chatContext.currentConversationSession?.activeGoals.find(g => 
      g.goalStatus === 'inProgress' && g.goalType === 'serviceBooking'
    );
    
    if (ragResults && ragResults.length > 0) {
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
        
        **BOOKING DIRECTION (CONTEXT-AWARE)**:
        ${activeBookingGoal ? 
          `- The user is currently in a booking process, so DO NOT mention "Book an Appointment" or redirect them to booking
          - Simply answer their question directly and end naturally
          - The booking context will be added automatically after your response` :
          `- NEVER ask users to "tell me your preferred date/time" or "let me know when you'd like to book"
          - NEVER create expectations that they can book via text messages
          - ALWAYS end responses with: "Click the 'Book an Appointment' button below to get started!"
          - The booking process requires clicking the button, not text responses`
        }
        
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
        
        **BOOKING DIRECTION (CONTEXT-AWARE)**:
        ${activeBookingGoal ? 
          `- The user is currently in a booking process, so DO NOT mention "Book an Appointment" or redirect them to booking
          - Simply answer their question directly and end naturally
          - The booking context will be added automatically after your response` :
          `- NEVER ask users to "tell me your preferred date/time" or "let me know when you'd like to book"
          - NEVER create expectations that they can book via text messages
          - ALWAYS end responses with: "Click the 'Book an Appointment' button below to get started!"
          - The booking process requires clicking the button, not text responses`
        }

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
  
  // Context-aware FAQ response - handle both inside and outside booking flow
  return await generateContextAwareFAQResponse(chatbotResponseText, chatContext, userLanguage);
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
      // Use LLM to assess if the message is a name or another question/request
      const isValidName = await assessIfMessageIsName(userMessage, userLanguage);
      
      if (isValidName) {
        console.log('[handleFaqOrChitchat] LLM confirmed this is a name, creating user:', userMessage);
        
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
            
            **BOOKING DIRECTION (CONTEXT-AWARE)**:
            ${activeBookingGoal ? 
              `- The user is currently in a booking process, so simply answer their question directly and end naturally
              - The booking context will be added automatically after your response` :
              `- After answering the question, ALWAYS offer to help the user book an appointment for the services we DO offer
              - The booking buttons will be added automatically after your response`
            }
            
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
          
          // Context-aware FAQ response for user creation flow too
          return await generateContextAwareFAQResponse(responseText, chatContext, userLanguage);
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
        // LLM determined this is not a name, ask again with context
        const errorMessage = userLanguage === 'es'
          ? 'Entiendo que quieres ayuda, pero primero necesito saber tu nombre. Por favor, solo dime cómo te llamas:'
          : 'I understand you want help, but I need to know your name first. Please just tell me what your name is:';
        
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


/**
 * Uses LLM to assess if a user's message is a name or another type of message
 */
async function assessIfMessageIsName(message: string, language: string): Promise<boolean> {
  try {
    const prompt = language === 'es' ? 
      `Evalúa si el siguiente mensaje es un nombre de persona o no.

Ejemplos de NOMBRES (responder "yes"):
- "Juan"
- "María García"
- "Pedro Luis"
- "Ana"
- "Carlos Alberto"

Ejemplos de NO NOMBRES (responder "no"):
- "me puedes ayudar con un servicio"
- "hola como estas"
- "necesito información"
- "cuando están disponibles"
- "qué servicios ofrecen"
- "help me please"
- "I need assistance"

Mensaje a evaluar: "${message}"

Responde ÚNICAMENTE con "yes" si es un nombre o "no" si no es un nombre.` :

      `Evaluate if the following message is a person's name or not.

Examples of NAMES (answer "yes"):
- "John"
- "Mary Smith"
- "Peter"
- "Anna"
- "Carlos"

Examples of NOT NAMES (answer "no"):
- "me puedes ayudar con un servicio"
- "can you help me with a service"
- "hello how are you"
- "I need information"
- "when are you available"
- "what services do you offer"
- "help me please"

Message to evaluate: "${message}"

Answer ONLY with "yes" if it's a name or "no" if it's not a name.`;

    const messages: OpenAIChatMessage[] = [
      { role: 'user', content: prompt }
    ];

    const response = await executeChatCompletion(messages, "gpt-4o", 0.3, 50);
    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    
    console.log(`[assessIfMessageIsName] Message: "${message}" -> LLM result: "${result}"`);
    
    return result === 'yes';
  } catch (error) {
    console.error('[assessIfMessageIsName] Error with LLM assessment:', error);
    // Fallback to basic validation if LLM fails
    return message.length >= 2 && message.length <= 50 && !message.includes('?') && !message.includes('@');
  }
}

/**
 * Generates context-aware FAQ response with appropriate buttons
 */
async function generateContextAwareFAQResponse(
  faqAnswerText: string,
  chatContext: ChatContext,
  userLanguage: string
): Promise<BotResponse> {
  // Check if there's an active booking goal
  const activeBookingGoal = chatContext.currentConversationSession?.activeGoals.find(g => 
    g.goalStatus === 'inProgress' && g.goalType === 'serviceBooking'
  );
  
  if (activeBookingGoal) {
    // User is in booking flow - add booking context and show current step options
    console.log(`[generateContextAwareFAQResponse] Active booking goal detected, adding booking context`);
    
    try {
      // Get current step information
      const { conversationFlowBlueprints } = await import('@/lib/bot-engine/config/blueprints');
      const { botTasks } = await import('@/lib/bot-engine/config/tasks');
      
      const currentFlow = conversationFlowBlueprints[activeBookingGoal.flowKey];
      const currentStepName = currentFlow[activeBookingGoal.currentStepIndex];
      const currentStepHandler = botTasks[currentStepName];
      
      // Get step-friendly names
      const stepDisplayNames: { [key: string]: { en: string; es: string } } = {
        'selectService': { en: 'selecting a service', es: 'seleccionando un servicio' },
        'addAdditionalServices': { en: 'adding additional services', es: 'agregando servicios adicionales' },
        'showAvailableTimes': { en: 'selecting appointment time', es: 'seleccionando hora de cita' },
        'handleTimeChoice': { en: 'selecting appointment time', es: 'seleccionando hora de cita' },
        'selectSpecificTime': { en: 'selecting specific time', es: 'seleccionando hora específica' },
        'selectDate': { en: 'selecting appointment date', es: 'seleccionando fecha de cita' },
        'askPickupAddress': { en: 'providing pickup address', es: 'proporcionando dirección de recogida' },
        'askDropoffAddress': { en: 'providing dropoff address', es: 'proporcionando dirección de entrega' },
        'quoteSummary': { en: 'reviewing booking summary', es: 'revisando resumen de reserva' },
        'handleQuoteChoice': { en: 'confirming booking', es: 'confirmando reserva' }
      };
      
      const currentStepDisplay = stepDisplayNames[currentStepName] 
        ? stepDisplayNames[currentStepName][userLanguage]
        : (userLanguage === 'es' ? 'completando tu reserva' : 'completing your booking');
      
      // Get selected services for context (handle both single and multiple services)
      const selectedServices = activeBookingGoal.collectedData.selectedServices || [];
      const singleService = activeBookingGoal.collectedData.selectedService;
      
      // If we have selectedServices array, use it; otherwise fall back to single service
      let servicesText = '';
      if (selectedServices.length > 0) {
        if (selectedServices.length === 1) {
          servicesText = selectedServices[0].name || selectedServices[0];
        } else {
          // Format multiple services nicely
          const serviceNames = selectedServices.map(s => s.name || s);
          servicesText = serviceNames.join(' and ');
        }
      } else if (singleService) {
        servicesText = singleService.name || singleService;
      }
      
      // Create booking context message
      let bookingContextMessage = '';
      if (servicesText) {
        bookingContextMessage = userLanguage === 'es' 
          ? `\n\n📋 Estás reservando *${servicesText}* y actualmente estás ${currentStepDisplay}. Para continuar, selecciona una de las opciones a continuación:`
          : `\n\n📋 You are booking *${servicesText}* and currently ${currentStepDisplay}. To continue, select from the options below:`;
      } else {
        bookingContextMessage = userLanguage === 'es' 
          ? `\n\n📋 Actualmente estás ${currentStepDisplay}. Para continuar, selecciona una de las opciones a continuación:`
          : `\n\n📋 You are currently ${currentStepDisplay}. To continue, select from the options below:`;
      }
      
      // Get current step buttons
      let stepButtons: any[] = [];
      if (currentStepHandler.fixedUiButtons) {
        if (typeof currentStepHandler.fixedUiButtons === 'function') {
          stepButtons = await currentStepHandler.fixedUiButtons(activeBookingGoal.collectedData, chatContext);
        } else {
          stepButtons = currentStepHandler.fixedUiButtons;
        }
      }
      
      // Convert step buttons to the expected format
      const formattedButtons = stepButtons.map(button => ({
        buttonText: button.text || button.buttonText || 'Option',
        buttonValue: button.value || button.buttonValue || button.id || 'unknown',
        buttonType: "postback" as const,
        buttonDescription: button.description || button.buttonDescription || button.desc || '',
      }));
      
      return {
        text: faqAnswerText + bookingContextMessage,
        buttons: formattedButtons.length > 0 ? formattedButtons : undefined
      };
      
    } catch (error) {
      console.error('[generateContextAwareFAQResponse] Error getting booking context:', error);
      // Fallback to basic response without booking context
      return {
        text: faqAnswerText
      };
    }
  } else {
    // No active booking goal - show standard "Book an Appointment" button
    const buttonText = userLanguage === 'es' ? 'Reservar una cita' : 'Book an Appointment';
    const buttonDescription = userLanguage === 'es' ? 'Iniciar el proceso de reserva' : 'Start the booking process';

    return {
      text: faqAnswerText,
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
}