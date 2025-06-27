import { NextRequest, NextResponse } from "next/server";
import { 
  processIncomingMessage, 
  type ConversationalParticipant, 
  type ChatContext,
} from "@/lib/Juan-bot-engine/bot-manager";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger"; 
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { 
    handleEscalationOrAdminCommand, 
    EscalationResult
} from "@/lib/Juan-bot-engine/escalation/handler";
import { getOrCreateChatContext, persistSessionState, START_BOOKING_PAYLOAD } from "@/lib/Juan-bot-engine/bot-manager-helpers";
import { handleFaqOrChitchat } from "@/lib/Juan-bot-engine/step-handlers/faq-handler";
import crypto from 'crypto';
import { IntelligentLLMService } from "@/lib/Juan-bot-engine/services/intelligent-llm-service";
import { LanguageDetectionService } from "@/lib/Juan-bot-engine/services/language-detection";
import { Notification } from '@/lib/database/models/notification';
import { ChatSession } from '@/lib/database/models/chat-session';
import { UserContext } from "@/lib/database/models/user-context";
import { Business } from '@/lib/database/models/business';

// No type guard needed anymore - handleEscalationOrAdminCommand only returns EscalationResult

export const dynamic = "force-dynamic";

// Production Configuration
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN; // For webhook verification
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET; // For webhook signature verification
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK; // Changed to different env var
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";
const LOG_PREFIX = "[Juan-Bot Webhook PROD]";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 200; // WhatsApp Business Management API limit

// Production webhook signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WHATSAPP_APP_SECRET) {
    console.warn(`${LOG_PREFIX} WHATSAPP_APP_SECRET not configured - skipping signature verification`);
    return true; // Allow in development, but warn
  }

  const expectedSignature = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));
}

// Rate limiting check
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const key = `rate_limit_${identifier}`;
  const current = rateLimitStorage.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStorage.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for ${identifier}: ${current.count}/${RATE_LIMIT_MAX_REQUESTS}`);
    return false;
  }

  current.count++;
  return true;
}

//Handles the GET request from Meta/WhatsApp to verify the webhook endpoint.
export async function GET(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.warn(`${LOG_PREFIX} Webhook verification skipped: USE_WABA_WEBHOOK is not 'true'.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");
  const expectedToken = WHATSAPP_VERIFY_TOKEN;

  if (hubMode !== "subscribe") {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Invalid hub.mode: ${hubMode}`);
    return NextResponse.json({ message: "Verification failed (mode)" }, { status: 403 });
  }

  if (!hubChallenge) {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Missing hub.challenge`);
    return NextResponse.json({ message: "Verification failed (challenge)" }, { status: 403 });
  }

  if (hubVerifyToken !== expectedToken) {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Invalid verify token`);
    return NextResponse.json({ message: "Verification failed (token)" }, { status: 403 });
  }

  console.log(`${LOG_PREFIX} Webhook verification PASSED`);
  return new NextResponse(hubChallenge, { status: 200 });
}

//Handles POST requests which contain WhatsApp webhook events (e.g., incoming messages).
export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown';
  const signature = req.headers.get('x-hub-signature-256');
  
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (bodyError) {
    console.error(`${LOG_PREFIX} Error reading request body:`, bodyError);
    return NextResponse.json({ message: "Error reading request body" }, { status: 400 });
  }
  
  if (!USE_WABA_WEBHOOK) {
    console.log(`${LOG_PREFIX} WABA Webhook for juan-bot is disabled. Skipping POST request.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  // Production security: Rate limiting
  if (!checkRateLimit(clientIp)) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Production security: Webhook signature verification
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.error(`${LOG_PREFIX} Webhook signature verification failed`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as WebhookAPIBody;
    const parsedEvent = parseWhatsappMessage(payload);

    if (parsedEvent && "text" in parsedEvent && parsedEvent.senderId && parsedEvent.text && parsedEvent.text.trim()) {
      const parsedMessage = parsedEvent;
      console.log(`${LOG_PREFIX} Successfully parsed message from ${parsedMessage.senderId}: "${parsedMessage.text}"`);

      const participant: ConversationalParticipant = {
        id: parsedMessage.senderId,
        type: 'customer',
        businessWhatsappNumber: parsedMessage.businessWhatsappNumber,
        customerWhatsappNumber: parsedMessage.customerWhatsappNumber,
        creationTimestamp: parsedMessage.timestamp ? new Date(parsedMessage.timestamp) : new Date(),
        lastUpdatedTimestamp: new Date(),
      };

      try {
        if (!parsedMessage.text) {
          console.log(`${LOG_PREFIX} Parsed message has no text content. Skipping all processing.`);
          return NextResponse.json({ status: "success - no text content" }, { status: 200 });
        }
        
        // --- Auto-map WhatsApp Phone Number ID for multi-tenant support ---
        if (parsedMessage.businessWhatsappNumber && parsedMessage.recipientId) {
          await Business.autoMapWhatsappPhoneNumberId(
            parsedMessage.businessWhatsappNumber, 
            parsedMessage.recipientId
          );
        }
        
        const { context: chatContext, sessionId, userContext, historyForLLM, customerUser } = await getOrCreateChatContext(participant);
        
        // --- Bot Escalation Check (FIRST PRIORITY) ---
        const escalationStatus = await Notification.getEscalationStatus(sessionId);
        if (escalationStatus) {
            console.log(`${LOG_PREFIX} Bot is in escalation mode for session ${sessionId}. Status: ${escalationStatus}`);

            // Different behavior based on escalation status
            if (escalationStatus === 'pending') {
                // Staff hasn't taken control yet - send waiting message and save to history
                const language = chatContext.participantPreferences.language === 'es' ? 'es' : 'en';
                const waitingMessage = language === 'es' 
                  ? "Un agente ya ha sido notificado y te atenderá en breve. Por favor, espera un momento."
                  : "An agent has been notified and will assist you shortly. Please wait a moment.";

                console.log(`${LOG_PREFIX} Sending waiting message and saving to history: "${waitingMessage}"`);
                const sender = new WhatsappSender();
                await sender.sendMessage(parsedMessage.senderId, { text: waitingMessage }, parsedMessage.recipientId);

                // Save BOTH user's message AND bot's waiting response to history
                if (chatContext.currentConversationSession) {
                    await persistSessionState(
                        sessionId, 
                        userContext, 
                        chatContext.currentConversationSession, 
                        undefined, // No active goal
                        parsedMessage.text || '', 
                        waitingMessage, // Save the waiting message to history
                        historyForLLM // Preserve full history during escalation
                    );
                }

                return NextResponse.json({ status: 'ok', message: 'Message received and saved during pending escalation.' });
            } else if (escalationStatus === 'attending') {
                // Staff has taken control - save user message but don't respond
                console.log(`${LOG_PREFIX} Staff is attending session ${sessionId}. Saving user message but bot stays silent.`);
                
                // Save ONLY the user's message to history (no bot response when staff is attending)
                if (chatContext.currentConversationSession) {
                    await persistSessionState(
                        sessionId, 
                        userContext, 
                        chatContext.currentConversationSession, 
                        undefined, // No active goal
                        parsedMessage.text || '', 
                        '', // No bot response during staff assistance
                        historyForLLM // Preserve full history during escalation - dont delete
                    );
                }

                return NextResponse.json({ status: 'ok', message: 'User message saved during staff assistance.' });
            }
        }
        
        // --- Centralized Language Detection ---
        const languageResult = await LanguageDetectionService.detectAndUpdateLanguage(
          parsedMessage.text, 
          chatContext, 
          LOG_PREFIX
        );
        
        if (languageResult.wasChanged) {
          console.log(`${LOG_PREFIX} Language detection: ${languageResult.reason}`);
        }
        // --- End Language Detection ---

        // --- Step 1: Check for Escalation ---
        if (chatContext.currentConversationSession && !escalationStatus) {
            const escalationResult = await handleEscalationOrAdminCommand(
                parsedMessage.text,
                participant,
                chatContext,
                userContext,
                historyForLLM,
                customerUser,
                parsedMessage.recipientId,
                parsedMessage.userName
            );

            if (escalationResult.isEscalated) {
                console.log(`${LOG_PREFIX} Message handled by escalation system. Reason: ${escalationResult.reason}`);
                if (escalationResult.response) {
                    const sender = new WhatsappSender();
                    await sender.sendMessage(parsedMessage.senderId, escalationResult.response, parsedMessage.recipientId);
                    console.log(`${LOG_PREFIX} Sent escalation response to ${parsedMessage.senderId}.`);
                    
                    chatContext.currentConversationSession.sessionStatus = 'escalated';
                    await persistSessionState(
                        sessionId, 
                        userContext, 
                        chatContext.currentConversationSession, 
                        undefined, 
                        parsedMessage.text || '', 
                        escalationResult.response.text || '',
                        historyForLLM // Pass full history
                    );
                }
                return NextResponse.json({ status: "success - handled by escalation system" }, { status: 200 });
            }
        }
        
        // --- Step 2: If not escalated, decide between FAQ/Chitchat and Booking Flow ---
        let botManagerResponse: BotResponse | null = null;
        const userCurrentGoal = chatContext.currentConversationSession?.activeGoals.find(g => g.goalStatus === 'inProgress');

        if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() || (userCurrentGoal && userCurrentGoal.goalType === 'serviceBooking')) {
            console.log(`${LOG_PREFIX} User is starting or continuing a booking flow. Routing to main engine.`);
            
            if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() && userCurrentGoal) {
                userCurrentGoal.goalStatus = 'completed';
            }

            botManagerResponse = await processIncomingMessage(parsedMessage.text, participant);
            
        } else {
            console.log(`${LOG_PREFIX} No active booking goal. Routing to FAQ/Chitchat handler.`);
            const faqResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text, historyForLLM);
            
            const targetLanguage = chatContext.participantPreferences.language;
            if (targetLanguage && targetLanguage !== 'en') {
                console.log(`${LOG_PREFIX} Translating FAQ response to ${targetLanguage}`);
                botManagerResponse = await translateBotResponse(faqResponse, targetLanguage);
            } else {
                botManagerResponse = faqResponse;
            }
            
            if (botManagerResponse.text && chatContext.currentConversationSession) {
                await persistSessionState(
                    sessionId, 
                    userContext, 
                    chatContext.currentConversationSession, 
                    undefined,
                    parsedMessage.text, 
                    botManagerResponse.text,
                    historyForLLM // Pass full history
                );
            }
        }

        console.log(`${LOG_PREFIX} Bot Manager generated response for ${parsedMessage.senderId}.`);

        if (botManagerResponse && botManagerResponse.text && botManagerResponse.text.trim()) {
          const sender = new WhatsappSender();
          try {
            console.log(`${LOG_PREFIX} Attempting to send reply to ${parsedMessage.senderId}: "${botManagerResponse.text}"`);
            await sender.sendMessage(parsedMessage.senderId, botManagerResponse, parsedMessage.recipientId); 
            console.log(`${LOG_PREFIX} Reply successfully sent via WhatsappSender to ${parsedMessage.senderId}.`);
          } catch (sendError) {
            console.error(`${LOG_PREFIX} Error sending reply via WhatsappSender to ${parsedMessage.senderId}:`, sendError);
          }
        } else {
          if (botManagerResponse && !botManagerResponse.text?.trim()) {
            console.log(`${LOG_PREFIX} Bot Manager returned empty response - not sending message to ${parsedMessage.senderId}.`);
          } else {
            console.log(`${LOG_PREFIX} No text in Bot Manager Response to send for ${parsedMessage.senderId}.`);
          }
        }
      } catch (botError) {
        console.error(`${LOG_PREFIX} Error processing message with Bot Manager for ${parsedMessage.senderId}:`, botError);
      }
    } else {
      // Skip status updates and non-actionable messages (sent/delivered/read receipts)
      if (parsedEvent && "type" in parsedEvent && parsedEvent.type === "status_update") {
        // Silently skip status updates
      } else {
        console.log(`${LOG_PREFIX} Skipping processing: Payload could not be parsed into an actionable message.`);
      }
    }
    
    return NextResponse.json({ status: "success - acknowledged by juan-bot v2" }, { status: 200 });

  } catch (error) {
    console.error(`${LOG_PREFIX} Critical error processing POST request for juan-bot:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error in juan-bot webhook" }, { status: 500 });
  }
} 

async function translateBotResponse(response: BotResponse, targetLanguage: string): Promise<BotResponse> {
    const llmService = new IntelligentLLMService();
    const textsToTranslate: string[] = [];

    if (response.text) {
        textsToTranslate.push(response.text);
    }
    if (response.listActionText) {
        textsToTranslate.push(response.listActionText);
    }
    if (response.listSectionTitle) {
        textsToTranslate.push(response.listSectionTitle);
    }
    response.buttons?.forEach(btn => {
        if (btn.buttonText) {
            textsToTranslate.push(btn.buttonText);
        }
        if (btn.buttonDescription) {
            textsToTranslate.push(btn.buttonDescription);
        }
    });

    if (textsToTranslate.length === 0) {
        return response;
    }

    try {
        const translatedTexts = await llmService.translate(textsToTranslate, targetLanguage) as string[];
        
        const mutableTranslatedTexts = [...translatedTexts];

        let translatedText = response.text;
        if (response.text) {
            translatedText = mutableTranslatedTexts.shift() || response.text;
        }

        let translatedListActionText = response.listActionText;
        if (response.listActionText) {
            translatedListActionText = mutableTranslatedTexts.shift() || response.listActionText;
        }

        let translatedListSectionTitle = response.listSectionTitle;
        if (response.listSectionTitle) {
            translatedListSectionTitle = mutableTranslatedTexts.shift() || response.listSectionTitle;
        }

        const translatedButtons = response.buttons?.map(btn => {
            const newBtn = { ...btn };
            if (newBtn.buttonText) {
                newBtn.buttonText = mutableTranslatedTexts.shift() || newBtn.buttonText;
            }
            if (newBtn.buttonDescription) {
                newBtn.buttonDescription = mutableTranslatedTexts.shift() || newBtn.buttonDescription;
            }
            return newBtn;
        });

        return { 
            text: translatedText, 
            buttons: translatedButtons,
            listActionText: translatedListActionText,
            listSectionTitle: translatedListSectionTitle
        };
    } catch (error) {
        console.error(`${LOG_PREFIX} Error translating bot response:`, error);
        return response; // Return original on error
    }
} 