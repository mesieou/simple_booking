/**
 * app/api/webhook/route.ts
 * 
 * WhatsApp Webhook API Route for Next.js.
 * 
 * - Handles GET requests for webhook verification (Meta/WhatsApp setup).
 * - Handles POST requests for incoming WhatsApp messages/events.
 * - Only enabled if USE_WABA_WEBHOOK="true" in environment variables.
 * 
 * This is the correct place for API routes in a Next.js app using the /app directory structure.
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  processIncomingMessage, 
  type ConversationalParticipant, 
  type ChatContext,
} from "@/lib/conversation-engine/juan-bot-engine-v2/bot-manager";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger"; 
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { 
    handleEscalationOrAdminCommand, 
    EscalationResult, 
    AdminCommandResult 
} from "@/lib/conversation-engine/juan-bot-engine-v2/escalation/handler";
import { getOrCreateChatContext, persistSessionState, START_BOOKING_PAYLOAD } from "@/lib/conversation-engine/juan-bot-engine-v2/bot-manager-helpers";
import { handleFaqOrChitchat } from "@/lib/conversation-engine/juan-bot-engine-v2/step-handlers/faq-handler";
import { IntelligentLLMService } from "@/lib/conversation-engine/juan-bot-engine-v2/services/intelligent-llm-service";
import { LanguageDetectionService } from "@/lib/Juan-bot-engine/services/language-detection";
import { Notification } from '@/lib/database/models/notification';
import { ChatMessage, ChatSession } from '@/lib/database/models/chat-session';
import { Business } from '@/lib/database/models/business';
import { UserContext } from "@/lib/database/models/user-context";

// Type guard to check if the result is an EscalationResult
function isEscalationResult(result: EscalationResult | AdminCommandResult): result is EscalationResult {
    return 'isEscalated' in result;
}

export const dynamic = "force-dynamic";
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";
const LOG_PREFIX = "[Juan-Bot Webhook V2]";

//Handles the GET request from Meta/WhatsApp to verify the webhook endpoint.
export async function GET(req: NextRequest) {
  console.log(`${LOG_PREFIX} Parsed USE_WABA_WEBHOOK: ${USE_WABA_WEBHOOK}`);

  if (!USE_WABA_WEBHOOK) {
    console.log(`${LOG_PREFIX} WABA Webhook for juan-bot is disabled. Skipping GET request.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  console.log(`${LOG_PREFIX} GET request received for webhook verification.`);

  const isSubscribeMode = hubMode === "subscribe";
  const isTokenValid = hubVerifyToken === WHATSAPP_VERIFY_TOKEN;
  const hasChallenge = !!hubChallenge;

  if (!isSubscribeMode) {
    console.error(`${LOG_PREFIX} Webhook verification failed: Mode is not 'subscribe'. Mode: ${hubMode}`);
    return NextResponse.json({ message: "Verification failed (mode)" }, { status: 403 });
  }

  if (!isTokenValid) {
    console.error(`${LOG_PREFIX} Webhook verification failed: Invalid verify token. Received: ${hubVerifyToken}, Expected: ${WHATSAPP_VERIFY_TOKEN}`);
    return NextResponse.json({ message: "Verification failed (token)" }, { status: 403 });
  }

  if (!hasChallenge) {
    console.error(`${LOG_PREFIX} Webhook verification failed: Challenge not present.`);
    return NextResponse.json({ message: "Verification failed (challenge)" }, { status: 403 });
  }

  console.log(`${LOG_PREFIX} Webhook verified successfully for juan-bot.`);
  return new NextResponse(hubChallenge, { status: 200 });
}

//Handles POST requests which contain WhatsApp webhook events (e.g., incoming messages).
export async function POST(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log(`${LOG_PREFIX} WABA Webhook for juan-bot is disabled. Skipping POST request.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;
    console.log(`${LOG_PREFIX} POST request received.`);

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

            // Save the user's message to history (always do this)
            if (chatContext.currentConversationSession) {
                await persistSessionState(
                    sessionId, 
                    userContext, 
                    chatContext.currentConversationSession, 
                    undefined, // No active goal
                    parsedMessage.text || '', 
                    '', // No bot response during escalation
                    historyForLLM
                );
            }

            // Different behavior based on escalation status
            if (escalationStatus === 'pending') {
                // Staff hasn't taken control yet - send waiting message
                const language = chatContext.participantPreferences.language === 'es' ? 'es' : 'en';
                const waitingMessage = language === 'es' 
                  ? "Un agente ya ha sido notificado y te atenderá en breve. Por favor, espera un momento."
                  : "An agent has been notified and will assist you shortly. Please wait a moment.";

                const sender = new WhatsappSender();
                await sender.sendMessage(parsedMessage.senderId, { text: waitingMessage }, parsedMessage.recipientId);

                return NextResponse.json({ status: 'ok', message: 'Message received and saved during pending escalation.' });
            } else if (escalationStatus === 'attending') {
                // Staff has taken control - bot stays completely silent
                console.log(`${LOG_PREFIX} Staff is attending session ${sessionId}. Bot remains silent.`);
                return NextResponse.json({ status: 'ok', message: 'Message received and saved during staff assistance.' });
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

        // --- Step 1: Check for Escalation or Admin Command (only if no active escalation) ---
        if (chatContext.currentConversationSession && !escalationStatus) {
            const escalationResult = await handleEscalationOrAdminCommand(
                parsedMessage.text,
                participant,
                chatContext,
                userContext,
                historyForLLM,
                customerUser,
                parsedMessage.recipientId
            );

            if (isEscalationResult(escalationResult)) {
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
                            historyForLLM
                        );
                    }
                    return NextResponse.json({ status: "success - handled by escalation system" }, { status: 200 });
                }
            } else { // It's an AdminCommandResult
                if (escalationResult.isHandled) {
                    console.log(`${LOG_PREFIX} Message handled by admin command system.`);
                    if (escalationResult.response) {
                        const sender = new WhatsappSender();
                        await sender.sendMessage(parsedMessage.senderId, escalationResult.response, parsedMessage.recipientId);
                        console.log(`${LOG_PREFIX} Sent admin command response to ${parsedMessage.senderId}.`);
                    }
                    return NextResponse.json({ status: "success - handled by admin system" }, { status: 200 });
                }
            }
        }
        
        // --- Step 2: If not escalated, decide between FAQ/Chitchat and Booking Flow ---
        let botManagerResponse: BotResponse | null = null;
        const userCurrentGoal = chatContext.currentConversationSession?.activeGoals.find(g => g.goalStatus === 'inProgress');

        // If the user wants to start booking or is already in a booking flow, let the main engine handle it.
        if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() || (userCurrentGoal && userCurrentGoal.goalType === 'serviceBooking')) {
            console.log(`${LOG_PREFIX} User is starting or continuing a booking flow. Routing to main engine.`);
            
            // If starting fresh, ensure any previous goal is marked as completed.
            if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() && userCurrentGoal) {
                userCurrentGoal.goalStatus = 'completed';
            }

            // The main engine now returns a complete BotResponse object, already translated.
            botManagerResponse = await processIncomingMessage(parsedMessage.text, participant);

        } else {
            // Otherwise, handle as a general FAQ or chitchat.
            console.log(`${LOG_PREFIX} No active booking goal. Routing to FAQ/Chitchat handler.`);
            const faqResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text, historyForLLM);
            
            // --- Post-Processing for FAQ/Chitchat Responses ---
            const targetLanguage = chatContext.participantPreferences.language;
            if (targetLanguage && targetLanguage !== 'en') {
                console.log(`${LOG_PREFIX} Translating FAQ response to ${targetLanguage}`);
                botManagerResponse = await translateBotResponse(faqResponse, targetLanguage);
            } else {
                botManagerResponse = faqResponse;
            }
            // --- End Post-Processing ---

            // Persist the state after the FAQ handler runs
            if (botManagerResponse.text && chatContext.currentConversationSession) {
                await persistSessionState(
                    sessionId, 
                    userContext, 
                    chatContext.currentConversationSession, 
                    undefined,
                    parsedMessage.text, 
                    botManagerResponse.text,
                    historyForLLM
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
      let reason = "Payload could not be parsed into an actionable message.";
      if (parsedEvent && "id" in parsedEvent) {
        reason = `Received a status update for message ${parsedEvent.id}, not an incoming message.`;
      }
      console.log(`${LOG_PREFIX} Skipping processing: ${reason}.`);
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

/**
 * Helper function to translate a BotResponse object.
 * This ensures translation logic is consistent for any path.
 * @param response The BotResponse to translate.
 * @param targetLanguage The language to translate to.
 * @returns A translated BotResponse.
 */
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
        
        // A mutable copy of the translated texts array
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
  