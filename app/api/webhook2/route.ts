import { NextRequest, NextResponse } from "next/server";
import { 
  processIncomingMessage, 
  type ConversationalParticipant, 
} from "../../../lib/Juan-bot-engine/bot-manager";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger"; 
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";


export const dynamic = "force-dynamic"; // Ensures the route is re-evaluated on every request
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";
const LOG_PREFIX = "[Juan-Bot Webhook V2]"; // Updated prefix for clarity


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
    const payload = (await req.json()) as WebhookAPIBody; // Type assertion from parser
    console.log(`${LOG_PREFIX} POST request received.`); // Simplified log

    const parsedMessage: ParsedMessage | null = parseWhatsappMessage(payload);

    if (parsedMessage && parsedMessage.senderId && parsedMessage.text) {
      console.log(`${LOG_PREFIX} Successfully parsed message from ${parsedMessage.senderId}: "${parsedMessage.text}"`);
      
      const participant: ConversationalParticipant = {
        id: parsedMessage.senderId,
        type: 'customer', // Assuming WhatsApp users are customers
        businessWhatsappNumber: parsedMessage.businessWhatsappNumber, // Business WhatsApp number customers message TO
        customerWhatsappNumber: parsedMessage.customerWhatsappNumber, // Customer's WhatsApp number who is messaging FROM
        creationTimestamp: parsedMessage.timestamp ? new Date(parsedMessage.timestamp) : new Date(),
        lastUpdatedTimestamp: new Date(),
        // Add other participant details if available from parsedMessage or context
      };

      try {
        // Process with juan-bot's specific engine
        const juanBotRawResponse = await processIncomingMessage(parsedMessage.text, participant);
        
        // Adapt the juanBotRawResponse to the BotResponse interface expected by WhatsappSender
        let botManagerResponse: BotResponse | null = null;
        if (juanBotRawResponse && typeof juanBotRawResponse.chatbotResponse === 'string') {
          botManagerResponse = { 
            text: juanBotRawResponse.chatbotResponse,
            // Convert bot manager's uiButtons to standardized buttons format
            buttons: juanBotRawResponse.uiButtons?.map(btn => ({
              title: btn.buttonText,
              payload: btn.buttonValue,
              type: (btn.buttonType === 'link' ? 'url' : btn.buttonType) as 'postback' | 'url' || 'postback'
            }))
          };
        }

        console.log(`${LOG_PREFIX} Bot Manager generated response for ${parsedMessage.senderId}.`);

        if (botManagerResponse && botManagerResponse.text) { // Check adapted response
          const sender = new WhatsappSender();
          try {
            console.log(`${LOG_PREFIX} Attempting to send reply to ${parsedMessage.senderId}: "${botManagerResponse.text}"`);
            await sender.sendMessage(parsedMessage.senderId, botManagerResponse); 
            console.log(`${LOG_PREFIX} Reply successfully sent via WhatsappSender to ${parsedMessage.senderId}.`);
          } catch (sendError) {
            console.error(`${LOG_PREFIX} Error sending reply via WhatsappSender to ${parsedMessage.senderId}:`, sendError);
            // Decide on error handling: maybe send a generic error to user or just log
          }
        } else {
          console.log(`${LOG_PREFIX} No text in Bot Manager Response to send for ${parsedMessage.senderId}.`);
        }
      } catch (botError) {
        console.error(`${LOG_PREFIX} Error processing message with Bot Manager for ${parsedMessage.senderId}:`, botError);
        // Handle error from bot manager, potentially send a generic error reply
      }
    } else {
      let reason = "Payload could not be parsed into an actionable message.";
      if (parsedMessage && !parsedMessage.senderId) reason = "Parsed message missing senderId.";
      if (parsedMessage && !parsedMessage.text) reason = "Parsed message missing text content.";
      console.log(`${LOG_PREFIX} Skipping processing: ${reason}.`); // Simplified log, removed full parsedMessage
    }
    
    // Always acknowledge WhatsApp's request quickly.
    return NextResponse.json({ status: "success - acknowledged by juan-bot v2" }, { status: 200 });

  } catch (error) {
    console.error(`${LOG_PREFIX} Critical error processing POST request for juan-bot:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error in juan-bot webhook" }, { status: 500 });
  }
} 