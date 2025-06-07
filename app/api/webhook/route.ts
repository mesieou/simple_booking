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
import { WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger";
import { processWhatsappPayload } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { BotResponse, ParsedMessage } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { extractSessionContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/context-extractor";
import { ChatSession } from "@/lib/database/models/chat-session";

export const dynamic = "force-dynamic";

// Read environment variables for security and feature toggling
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";


/**
 * GET handler: Used by Meta/WhatsApp to verify the webhook endpoint.
 * Responds with the challenge if the verify token matches.
 */
export async function GET(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping GET request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  if (
    hubMode === "subscribe" &&
    hubVerifyToken === WHATSAPP_VERIFY_TOKEN &&
    hubChallenge
  ) {
    console.log("Webhook verified successfully.");
    return new NextResponse(hubChallenge, { status: 200 });
  } else {
    console.error("Webhook verification failed. Ensure verify token is set correctly.");
    return NextResponse.json({ message: "Verification failed" }, { status: 403 });
  }
}

/**
 * POST handler: Receives WhatsApp webhook events (messages, status, etc).
 */
export async function POST(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping POST request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;

    const response = await processWhatsappPayload(payload, {
      
      // --- Handle Status Updates ---
      onStatusUpdate: async (statusUpdate) => {
        console.log(`[Webhook] Received status update for message ${statusUpdate.messageId}: ${statusUpdate.status}`);
        // You could add logic here to update your database with the message status
        return NextResponse.json({ status: "success - status update received" }, { status: 200 });
      },

      // --- Handle Incoming Messages ---
      onMessage: async (parsedMessage) => {
        if (!parsedMessage.senderId) {
          console.log("[Webhook] Parsed message missing senderId. Skipping interaction.");
          // Acknowledge receipt even if we can't process it further.
          return NextResponse.json({ status: "success - acknowledged but no senderId" }, { status: 200 });
        }
        
        const messageType = parsedMessage.text ? 'text' : (parsedMessage.attachments && parsedMessage.attachments.length > 0 ? parsedMessage.attachments[0].type : 'unknown');
        console.log(`[Webhook] Processing message from: ${parsedMessage.senderId} | Type: ${messageType}`);

        // Log the parsed message
        console.log('Received message:', parsedMessage);

        // Get or create session and extract context
        const sessionContext = await extractSessionContext(
          parsedMessage.channelType,
          parsedMessage.senderId,
          '2b4d2e67-a00f-4e36-81a1-64e6ac397394', // TODO: Replace with actual business ID
          12 // Default session timeout in hours
        );
        console.log('Session context:', sessionContext);

        // Send hardcoded test response via WhatsApp
        try {
          const whatsappSender = new WhatsappSender();
          const testResponse: BotResponse = {
            text: "Hello! I received your message and created a session. Bot is working! 🤖"
          };
          
          await whatsappSender.sendMessage(parsedMessage.senderId, testResponse);
          console.log(`[Webhook] Sent test response to ${parsedMessage.senderId}`);
          
          // Update session with conversation history
          if (sessionContext) {
            try {
              const now = new Date().toISOString();
              
              // Add user message
              const userMessage = {
                role: 'user' as const,
                content: parsedMessage.text || '',
                timestamp: now
              };
              
              // Add bot response
              const botMessage = {
                role: 'bot' as const,
                content: testResponse.text || '',
                timestamp: now
              };
              
              // Get current messages and add new ones
              const updatedMessages = [...sessionContext.historyForLLM, userMessage, botMessage];
              
              // Update session in database
              await ChatSession.update(sessionContext.currentSessionId, {
                allMessages: updatedMessages
              });
              
              console.log(`[Webhook] Updated session ${sessionContext.currentSessionId} with conversation history`);
            } catch (updateError) {
              console.error("[Webhook] Error updating session with messages:", updateError);
            }
          }
          
          return NextResponse.json({ 
            status: "success", 
            message: "Message received, session created, response sent, and conversation saved" 
          });
        } catch (sendError) {
          console.error("[Webhook] Error sending WhatsApp response:", sendError);
          return NextResponse.json({ 
            status: "success", 
            message: "Message received and session created, but failed to send response" 
          });
        }
      }
    });

    if (response) {
      return response;
    }

    // This case is hit if `parseWhatsappMessage` returns null
    return NextResponse.json({ status: "success - not actionable" }, { status: 200 });

  } catch (error) {
    console.error("[Webhook] Critical error processing POST request:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
  