import { NextRequest, NextResponse } from "next/server";
import { 
  processIncomingMessage, 
  type ConversationalParticipant, 
} from "@/lib/Juan-bot-engine/bot-manager";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger"; 
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { 
    handleEscalationOrAdminCommand, 
    EscalationResult, 
    AdminCommandResult 
} from "@/lib/Juan-bot-engine/escalation/handler";
import { getOrCreateChatContext, persistSessionState, START_BOOKING_PAYLOAD } from "@/lib/Juan-bot-engine/bot-manager-helpers";
import { handleFaqOrChitchat } from "@/lib/Juan-bot-engine/step-handlers/faq-handler";

// Type guard to check if the result is an EscalationResult
function isEscalationResult(result: EscalationResult | AdminCommandResult): result is EscalationResult {
    return 'isEscalated' in result;
}

export const dynamic = "force-dynamic";
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK || process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";
const LOG_PREFIX = "[Juan-Bot Webhook]";

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
  console.log(`${LOG_PREFIX} Received a POST request.`);
  if (!USE_WABA_WEBHOOK) {
    console.log(`${LOG_PREFIX} WABA Webhook for juan-bot is disabled. Skipping POST request.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;
    console.log(`${LOG_PREFIX} POST request payload successfully parsed:`, JSON.stringify(payload, null, 2));

    const parsedEvent = parseWhatsappMessage(payload);
    console.log(`${LOG_PREFIX} WhatsApp message parsed. Event:`, parsedEvent ? JSON.stringify(parsedEvent, null, 2) : "null");

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
        
        const { context: chatContext, sessionId, userContext, historyForLLM, customerUser } = await getOrCreateChatContext(participant);
        
        // --- Step 1: Check for Escalation or Admin Command ---
        if (chatContext.currentConversationSession) {
            const escalationResult = await handleEscalationOrAdminCommand(
                parsedMessage.text,
                participant,
                chatContext,
                userContext,
                historyForLLM,
                customerUser
            );

            if (isEscalationResult(escalationResult)) {
                if (escalationResult.isEscalated) {
                    console.log(`${LOG_PREFIX} Message handled by escalation system. Reason: ${escalationResult.reason}`);
                    if (escalationResult.response) {
                        const sender = new WhatsappSender();
                        await sender.sendMessage(parsedMessage.senderId, escalationResult.response);
                        console.log(`${LOG_PREFIX} Sent escalation response to ${parsedMessage.senderId}.`);
                        
                        chatContext.currentConversationSession.sessionStatus = 'escalated';
                        await persistSessionState(
                            sessionId, 
                            userContext, 
                            chatContext.currentConversationSession, 
                            undefined, 
                            parsedMessage.text || '', 
                            escalationResult.response.text || ''
                        );
                    }
                    return NextResponse.json({ status: "success - handled by escalation system" }, { status: 200 });
                }
            } else { // It's an AdminCommandResult
                if (escalationResult.isHandled) {
                    console.log(`${LOG_PREFIX} Message handled by admin command system.`);
                    if (escalationResult.response) {
                        const sender = new WhatsappSender();
                        await sender.sendMessage(parsedMessage.senderId, escalationResult.response);
                        console.log(`${LOG_PREFIX} Sent admin command response to ${parsedMessage.senderId}.`);
                    }
                    return NextResponse.json({ status: "success - handled by admin system" }, { status: 200 });
                }
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

            const juanBotRawResponse = await processIncomingMessage(parsedMessage.text, participant);
            
            if (juanBotRawResponse && typeof juanBotRawResponse.chatbotResponse === 'string') {
                const convertedButtons = juanBotRawResponse.uiButtons?.map(btn => ({
                    buttonText: btn.buttonText,
                    buttonValue: btn.buttonValue,
                    buttonDescription: btn.buttonDescription,
                    buttonType: btn.buttonType
                }));
                botManagerResponse = { 
                    text: juanBotRawResponse.chatbotResponse,
                    buttons: convertedButtons
                };
            }
        } else {
            console.log(`${LOG_PREFIX} No active booking goal. Routing to FAQ/Chitchat handler.`);
            botManagerResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text, historyForLLM);
            
            if (botManagerResponse.text && chatContext.currentConversationSession) {
                await persistSessionState(
                    sessionId, 
                    userContext, 
                    chatContext.currentConversationSession, 
                    undefined,
                    parsedMessage.text, 
                    botManagerResponse.text
                );
            }
        }

        console.log(`${LOG_PREFIX} Bot Manager generated response for ${parsedMessage.senderId}.`);

        if (botManagerResponse && botManagerResponse.text && botManagerResponse.text.trim()) {
          const sender = new WhatsappSender();
          try {
            console.log(`${LOG_PREFIX} Attempting to send reply to ${parsedMessage.senderId}: "${botManagerResponse.text}"`);
            await sender.sendMessage(parsedMessage.senderId, botManagerResponse); 
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
      console.log(`${LOG_PREFIX} Skipping processing: ${reason}. Full parsed event:`, parsedEvent ? JSON.stringify(parsedEvent, null, 2) : "null");
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