// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { routeInteraction } from "@/lib/conversation-engine/main-conversation-manager";
import { ConversationContext, ConversationMode } from "@/lib/conversation-engine/conversation.context";
import { ParsedMessage, BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { OpenAIChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";

export const dynamic = "force-dynamic";

// POST  →  chat endpoint used by the UI
export async function POST(req: NextRequest) {
  console.log("[API Route - /api/chat] Received POST request"); 
  try {
    const body = await req.json();
    const incomingHistory: OpenAIChatMessage[] = body.history || [];

    if (incomingHistory.length === 0) {
      return NextResponse.json({ error: "Received empty history" }, { status: 400 });
    }

    // Assume the last message in the history is the current user's message for this turn.
    const lastMessageFromHistory = incomingHistory[incomingHistory.length - 1];
    
    if (lastMessageFromHistory.role !== 'user') {
        return NextResponse.json({ error: "Last message in history must be from user" }, { status: 400 });
    }

    // Create a ParsedMessage for the current turn based on the last message from UI
    const currentParsedMessage: ParsedMessage = {
      channelType: 'web', // Or 'local_test', depending on how you identify this channel
      senderId: lastMessageFromHistory.role === 'user' ? (lastMessageFromHistory as any).name || 'local_user' : 'unknown_sender', // Attempt to get a name or use a default
      recipientId: 'chatbot_ui',
      timestamp: new Date(),
      text: lastMessageFromHistory.content,
      messageId: String(Date.now()), // Simple unique ID for this message turn
      originalPayload: body 
    };

    // Initialize ConversationContext
    // For a web UI, chatHistory can be the full history sent from the client.
    // The `routeInteraction` will push the current user message to this history again if needed (current logic does this).
    // To avoid duplication, routeInteraction should ideally take the full history and the current message separately.
    // For now, let's pass the history *up to but not including* the current message for context.chatHistory,
    // and the current message as ParsedMessage.
    
    const historyForContext = incomingHistory.slice(0, -1); // History *before* the current user message

    const context: ConversationContext = {
      userId: currentParsedMessage.senderId, // Or a more persistent session/user ID from your UI
      currentMode: 'IdleMode', // Or load from a persisted session state for this userId
      chatHistory: historyForContext, // Pass the history *before* the current message
      // lastUserIntent and mode-specific states will be managed by routeInteraction
    };
    // The `routeInteraction` function will add the current user message to context.chatHistory internally.

    console.log("[API Route - /api/chat] Calling routeInteraction with ParsedMessage and Context");
    const { finalBotResponse, updatedContext } = await routeInteraction(currentParsedMessage, context);
    
    console.log("[API Route - /api/chat] routeInteraction result - BotResponse:", JSON.stringify(finalBotResponse, null, 2));
    console.log("[API Route - /api/chat] routeInteraction result - UpdatedContext History:", JSON.stringify(updatedContext.chatHistory, null, 2));
    
    // The UI expects the full updated history back
    return NextResponse.json({ history: updatedContext.chatHistory });

  } catch (err) {
    console.error("[API Route - /api/chat] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to process chat", details: errorMessage },
      { status: 500 }
    );
  }
}

// (optional) GET  → simple health-check / placeholder
export function GET() {
  return NextResponse.json({ message: "Placeholder for /api/chat GET" });
}
