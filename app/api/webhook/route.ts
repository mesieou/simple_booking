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
import { BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { extractSessionHistoryAndContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/history-extractor";
import { analyzeConversationIntent } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/intention-detector";
import { routeInteraction } from "@/lib/conversation-engine/conversation-orchestrator";
import { ChatSession } from "@/lib/database/models/chat-session";
import { UserContext } from "@/lib/database/models/user-context";

export const dynamic = "force-dynamic";

// Read environment variables for security and feature toggling
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";



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


// POST handler: Receives WhatsApp webhook events (messages, status, etc).
export async function POST(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping POST request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;

    const response = await processWhatsappPayload(payload, {
      
      // Status update logger
      onStatusUpdate: async (statusUpdate) => {
        console.log(`[Webhook] Received status update for message ${statusUpdate.messageId}: ${statusUpdate.status}`);
        // You could add logic here to update your database with the message status
        return NextResponse.json({ status: "success - status update received" }, { status: 200 });
      },

      // Message handler
      onMessage: async (parsedMessage) => {
        if (!parsedMessage.senderId) {
          console.log("[Webhook] Parsed message missing senderId. Skipping interaction.");
          return NextResponse.json({ status: "success - acknowledged but no senderId" }, { status: 200 });
        }
        
        console.log(`\n\n--- [Webhook] New message from: ${parsedMessage.senderId} ---`);

        // STEP 1: Extract History and Context 
        const historyAndContext = await extractSessionHistoryAndContext(
          parsedMessage.channelType,
          parsedMessage.senderId,
          '2b4d2e67-a00f-4e36-81a1-64e6ac397394', // TODO: Replace with actual business ID
          12
        );

        if (!historyAndContext) {
          console.error("[Webhook] Failed to get history and context. Aborting.");
          return NextResponse.json({ message: "Failed to process context" }, { status: 500 });
        }
        
        const { historyForLLM, userContext, currentSessionId } = historyAndContext;
        
        console.log(`[Webhook] Context Loaded for ${parsedMessage.senderId}:`);
        console.log(JSON.stringify(userContext, null, 2));

        // --- STEP 3: Delegate to the Conversation Orchestrator ---
        // The orchestrator will handle intent analysis, state management, and response generation.
        const { finalBotResponse, updatedContext } = await routeInteraction(
          parsedMessage,
          userContext,
          historyForLLM
        );

        console.log(`[Webhook] Orchestrator finished. Final updated context:`);
        console.log(JSON.stringify(updatedContext, null, 2));

        // --- NEW STEP 4: Send the generated response ---
        try {
          const whatsappSender = new WhatsappSender();
          await whatsappSender.sendMessage(parsedMessage.senderId, finalBotResponse);
          console.log(`[Webhook] Sent orchestrator response to ${parsedMessage.senderId}: "${finalBotResponse.text}"`);
          
          // --- Persist UserContext State ---
          await UserContext.updateByChannelUserId(updatedContext.channelUserId, {
            currentGoal: updatedContext.currentGoal,
            previousGoal: updatedContext.previousGoal,
            frequentlyDiscussedTopics: updatedContext.frequentlyDiscussedTopics,
            participantPreferences: updatedContext.participantPreferences,
          });
          console.log(`[Webhook] Successfully persisted updated UserContext for ${updatedContext.channelUserId}.`);
          
          // --- Persist ChatSession History ---
          if (historyAndContext) {
            try {
              // The most up-to-date history is now in the returned context's goal.
              // We will use that as the new source of truth for the session's message log.
              const updatedHistory = updatedContext.currentGoal?.messageHistory || [];
              
              const historyForDb = updatedHistory.map(msg => ({
                ...msg,
                role: (msg.speakerRole === 'chatbot' ? 'bot' : 'user') as 'user' | 'bot'
              }));
              
              await ChatSession.update(currentSessionId, {
                allMessages: historyForDb
              });
              
              console.log(`[Webhook] Updated session ${currentSessionId} with latest conversation history.`);
            } catch (updateError) {
              console.error("[Webhook] Error updating session with messages:", updateError);
            }
          }
          
          return NextResponse.json({ 
            status: "success", 
            message: "Orchestrator processed message and sent response." 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`[Webhook] Error sending response or persisting state for ${parsedMessage.senderId}:`, errorMessage);
          // Return a generic error to the client, but log the specific error server-side.
          return NextResponse.json({ 
            status: "error", 
            message: "Failed to process message." 
          }, { status: 500 });
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
  