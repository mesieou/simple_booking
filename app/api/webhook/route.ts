/**
 * app/api/webhook/route.ts
 * 
 * WhatsApp Webhook API Route for Next.js.
 * 
 * - Handles GET requests for webhook verification (Meta/WhatsApp setup).
 * - Handles POST requests for incoming WhatsApp messages/events.
 * - Uses the logIncomingMessage helper to print payloads for debugging.
 * - Only enabled if USE_WABA_WEBHOOK="true" in environment variables.
 * 
 * This is the correct place for API routes in a Next.js app using the /app directory structure.
 */

import { NextRequest, NextResponse } from "next/server";
import { logIncomingMessage, WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

// New Imports for the new conversation engine
import { routeInteraction } from "@/lib/conversation-engine/main-conversation-manager";
import { ConversationContext } from "@/lib/conversation-engine/conversation.context";
import { ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";

export const dynamic = "force-dynamic";

// Read environment variables for security and feature toggling
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";

// Handle incoming customer messages
async function handleCustomerMessage(message: string) {
    // For now, just logging the message
    console.log("Received customer message:", message);
}

/**
 * GET handler: Used by Meta/WhatsApp to verify the webhook endpoint.
 * Responds with the challenge if the verify token matches.
 */
export async function GET(req: NextRequest) {
  console.log(`Raw USE_WABA_WEBHOOK from env: '${rawUseWabaWebhook}'`);
  console.log(`Parsed USE_WABA_WEBHOOK: ${USE_WABA_WEBHOOK}`);

  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping GET request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  console.log("Webhook GET request received:");
  console.log("Mode:", hubMode);
  console.log("Challenge:", hubChallenge);
  console.log("Verify Token:", hubVerifyToken);
  console.log("Expected Token:", WHATSAPP_VERIFY_TOKEN);

  if (
    hubMode === "subscribe" &&
    hubVerifyToken === WHATSAPP_VERIFY_TOKEN &&
    hubChallenge
  ) {
    console.log("Webhook verified successfully.");
    return new NextResponse(hubChallenge, { status: 200 });
  } else {
    console.error("Webhook verification failed.");
    return NextResponse.json({ message: "Verification failed" }, { status: 403 });
  }
}

/**
 * POST handler: Receives WhatsApp webhook events (messages, status, etc).
 * Logs the payload using logIncomingMessage for debugging.
 */
export async function POST(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping POST request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;
    console.log("[Webhook] POST request received. Raw Payload:", JSON.stringify(payload, null, 2));
    // Optional: Keep logIncomingMessage if it provides value beyond just raw payload logging
    // logIncomingMessage(payload); 

    const parsedMessage = parseWhatsappMessage(payload);

    if (parsedMessage && parsedMessage.senderId) { // Ensure senderId is present for replies
      console.log("[Webhook] Successfully parsed WhatsApp message:", JSON.stringify(parsedMessage, null, 2));

      // Initialize ConversationContext for this interaction
      // For now, chatHistory starts fresh. Later, load from DB.
      const context: ConversationContext = {
        userId: parsedMessage.senderId,
        currentMode: 'IdleMode', 
        chatHistory: [], 
        // lastUserIntent, bookingState, etc., will be populated by routeInteraction or loaded from DB later
      };

      console.log("[Webhook] Calling routeInteraction with parsedMessage and new context.");
      try {
        const { finalBotResponse, updatedContext } = await routeInteraction(parsedMessage, context);

        console.log("[Webhook] Response from routeInteraction:", JSON.stringify(finalBotResponse, null, 2));
        console.log("[Webhook] Updated context after routeInteraction:", JSON.stringify(updatedContext, null, 2));

        if (finalBotResponse && finalBotResponse.text) {
          const sender = new WhatsappSender();
          try {
            console.log(`[Webhook] Attempting to send reply to ${parsedMessage.senderId}: "${finalBotResponse.text}"`);
            await sender.sendMessage(parsedMessage.senderId, finalBotResponse);
            console.log("[Webhook] Reply successfully sent to WhatsApp user via WhatsappSender.");
          } catch (sendError) {
            console.error("[Webhook] Error sending reply via WhatsappSender:", sendError);
          }
        } else {
          console.log("[Webhook] No text in BotResponse to send.");
        }
        // TODO: Save updatedContext (especially updatedContext.chatHistory and mode-specific states like updatedContext.bookingState)
        // to your database/persistence layer here, associated with parsedMessage.senderId.

      } catch (interactionError) {
        console.error("[Webhook] Error during routeInteraction:", interactionError);
        // Consider sending a generic error message back to the user via WhatsApp in this case
      }

    } else {
      if (!parsedMessage) {
        console.log("[Webhook] Failed to parse WhatsApp message or message was not actionable.");
      } else {
        console.log("[Webhook] Parsed message missing critical info (e.g., senderId). Skipping interaction.", JSON.stringify(parsedMessage, null, 2));
      }
    }
    // Always acknowledge WhatsApp's request quickly, even if processing or sending fails.
    return NextResponse.json({ status: "success - acknowledged" }, { status: 200 });
  } catch (error) {
    console.error("[Webhook] Critical error processing POST request:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
  