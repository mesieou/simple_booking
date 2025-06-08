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
import { ChatSession } from "@/lib/database/models/chat-session";

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
          // Acknowledge receipt even if we can't process it further.
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


        // STEP 2: Analyze Intent 
        console.log(`[Webhook] Analyzing intent for message: "${parsedMessage.text}"`);

        // Join user past history, and new history
        const historyForIntentAnalysis = historyForLLM.map(msg => ({
          role: (msg.role === 'bot' ? 'assistant' : msg.role) as 'user' | 'assistant',
          content: msg.content
        }));

        // Analyze Intent
        const analyzedIntent = await analyzeConversationIntent(
          parsedMessage.text || "",
          historyForIntentAnalysis,
          userContext
        );

        console.log(`[Webhook] Intent Analysis Result for ${parsedMessage.senderId}:`);
        console.log(JSON.stringify(analyzedIntent, null, 2));
        

        // STEP 3: Send Test Response 
        // This section is for testing and will be replaced by the call to Juan's State Manager.
        try {
          const whatsappSender = new WhatsappSender();
          const testResponse: BotResponse = {
            text: `🤖 Intent Test Complete! 
            Goal: ${analyzedIntent.goalType}
            Action: ${analyzedIntent.goalAction}
            Switch: ${analyzedIntent.contextSwitch}`
          };
          
          await whatsappSender.sendMessage(parsedMessage.senderId, testResponse);
          console.log(`[Webhook] Sent test analysis response to ${parsedMessage.senderId}`);
          
          // STEP 4: Add new conversation message to the session
          // Update the session with the new conversation messages
          if (historyAndContext) {
            try {
              const now = new Date().toISOString();
              const userMessage = { role: 'user' as const, content: parsedMessage.text || '', timestamp: now };
              const botMessage = { role: 'bot' as const, content: testResponse.text || '', timestamp: now };
              
              const updatedMessages = [...historyForLLM, userMessage, botMessage];
              
              await ChatSession.update(currentSessionId, {
                allMessages: updatedMessages
              });
              
              console.log(`[Webhook] Updated session ${currentSessionId} with conversation history.`);
            } catch (updateError) {
              console.error("[Webhook] Error updating session with messages:", updateError);
            }
          }
          
          return NextResponse.json({ 
            status: "success", 
            message: "Test analysis complete and response sent." 
          });
        } catch (sendError) {
          console.error("[Webhook] Error sending WhatsApp test response:", sendError);
          return NextResponse.json({ 
            status: "error", 
            message: "Failed to send test response." 
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
  