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
import { extractSessionHistoryAndContext } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/extract-history-and-context.ts";
import { routeInteraction } from "@/lib/conversation-engine/conversation-orchestrator";
import { persistSessionState } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/save-history-and-context";
import { MainOrchestrator, createConversationInput, validateConversationInput, ConversationInput, ConversationOutput } from '@/lib/conversation-engine/v2/main-orchestrator';
import { extractDialogueStateFromHistory } from '@/lib/conversation-engine/v2/main-orchestrator';
import { Notification } from '@/lib/database/models/notification';
import { EscalationManager } from '@/lib/escalation-system/manager';
import { EscalationDetector } from '@/lib/escalation-system/detector';
import { DialogueState } from "@/lib/conversation-engine/v2/nlu/types";
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

/**
 * Handles incoming messages using the V2 Conversation Engine.
 * This function orchestrates the entire V2 pipeline in a clean, modular way.
 * @param parsedMessage The message parsed from the WhatsApp payload.
 * @returns A NextResponse object.
 */
async function handleV2Conversation(parsedMessage: any) {
  try {
    // Step 1: Extract history and context for the user
    const historyAndContext = await extractSessionHistoryAndContext(
      parsedMessage.channelType,
      parsedMessage.senderId,
      '228c7e8e-ec15-4eeb-a766-d1ebee07104f', // TODO: Replace with dynamic business ID
      12 // Session timeout in hours
    );

    if (!historyAndContext) {
      console.error("[Webhook] V2: Failed to get history and context. Aborting.");
      return NextResponse.json({ message: "Failed to process context" }, { status: 500 });
    }

    const { userContext, historyForLLM, currentSessionId, dialogueState } = historyAndContext;

    // Step 2: Create the input for the V2 Main Orchestrator
    const conversationInput = createConversationInput(
      parsedMessage.text,
      userContext,
      historyForLLM,
      currentSessionId,
      dialogueState
    );

    if (!validateConversationInput(conversationInput)) {
        return NextResponse.json({ message: "Invalid conversation input" }, { status: 400 });
    }

    // Step 1: Check if conversation is locked for human intervention
    if (EscalationManager.isConversationLocked(conversationInput.currentDialogueState?.escalationStatus)) {
        const pausedResponse = EscalationManager.createPausedResponse();
        const newHistory = [...historyForLLM, { role: 'user' as const, content: parsedMessage.text }];
        await persistSessionState(currentSessionId, userContext, newHistory);
        return NextResponse.json({ status: "success", message: "Message forwarded to human agent." });
    }
    
    // Step 2: Check if the new message is an escalation request
    if (EscalationDetector.isEscalationRequired(parsedMessage.text)) {
        const escalationResult = await EscalationManager.initiateEscalation(
            userContext.businessId!,
            currentSessionId,
            userContext.channelUserId,
            parsedMessage.text
        );
        
        // Persist the state change
        const updatedDialogueState: DialogueState = {
            ...(conversationInput.currentDialogueState || { lastActivityAt: new Date().toISOString() }),
            ...escalationResult.updatedState,
            lastActivityAt: new Date().toISOString()
        };
        const updatedContextForDB: UserContext = {
            ...userContext,
            currentGoal: { 
                ...(userContext.currentGoal || { goalType: 'v2Conversation', goalStatus: 'inProgress', collectedData: {}, currentStepIndex: 0, flowKey: 'v2' }),
                collectedData: { ...userContext.currentGoal?.collectedData, dialogueState: updatedDialogueState } 
            }
        };
        const newHistory = [...historyForLLM, { role: 'user' as const, content: parsedMessage.text }, { role: 'bot' as const, content: escalationResult.response }];
        await persistSessionState(currentSessionId, updatedContextForDB, newHistory);

        // Send the "connecting you" message
        const whatsappSender = new WhatsappSender();
        await whatsappSender.sendMessage(parsedMessage.senderId, { text: escalationResult.response });

        return NextResponse.json({ status: "success", message: "Human escalation initiated." });
    }

    // Step 3: Process the conversation through the V2 pipeline
    const output = await MainOrchestrator.processConversation(conversationInput);

    // Step 4: Persist the updated state and history
    if (output.shouldPersistContext) {
      // We need a way to store the V2 DialogueState. For now, we adapt it to UserContext.
      // This part will need a proper mapping function in a real scenario.
      userContext.currentGoal = {
        ...(userContext.currentGoal || {
          goalType: "v2Conversation",
          goalStatus: "inProgress" as const,
          collectedData: {},
          currentStepIndex: 0,
          flowKey: "v2",
        }),
        collectedData: {
          ...userContext.currentGoal?.collectedData,
          dialogueState: output.updatedDialogueState,
        },
      };

      // Check if escalation was triggered and create notification
      if (output.updatedDialogueState.escalationStatus === 'pending_human' && dialogueState?.escalationStatus !== 'pending_human') {
          await Notification.create({
              businessId: userContext.businessId!,
              chatSessionId: currentSessionId,
              message: `User ${parsedMessage.senderId} requires human assistance. Last message: "${parsedMessage.text}"`
          });
          console.log(`[Webhook] V2: Human escalation notification created for session ${currentSessionId}`);
      }
      
      const newHistory = [...historyForLLM, { role: 'user' as const, content: parsedMessage.text }, { role: 'bot' as const, content: output.response }];
      await persistSessionState(currentSessionId, userContext, newHistory);
    }

    // Step 5: Send the response back to the user, but only if the bot is not paused
    const whatsappSender = new WhatsappSender();
    await whatsappSender.sendMessage(parsedMessage.senderId, {
      text: output.response,
      buttons: output.buttons
    });
    
    return NextResponse.json({ status: "success", message: "V2 pipeline processed message." });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Webhook] V2 Error for ${parsedMessage.senderId}:`, errorMessage);
    return NextResponse.json({ status: "error", message: "Failed to process message." }, { status: 500 });
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
        
        console.log(`\n\n--- [Webhook] New V2 message from: ${parsedMessage.senderId} ---`);

        // Delegate to the new V2 conversation handler
        return handleV2Conversation(parsedMessage);
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
  