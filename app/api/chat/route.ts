// app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { processIncomingMessage } from "@/lib/chatbot-handlers/central-conversation-flow-decider";   // <— your helper

// POST  →  chat endpoint used by the UI
export async function POST(req: NextRequest) {
  console.log("[API Route - /api/chat] Received POST request from webhook/internal call"); 
  try {
    const { history = [] } = await req.json();        // expects { history:[...] }
    console.log("[API Route - /api/chat] Calling processIncomingMessage with history:", JSON.stringify(history, null, 2)); 
    const result = await processIncomingMessage(history);     // call bot logic
    console.log("[API Route - /api/chat] processIncomingMessage result:", JSON.stringify(result, null, 2)); 
    return NextResponse.json({ history: result.messages }); // Use result.messages
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}

// (optional) GET  → simple health-check / placeholder
export function GET() {
  return NextResponse.json({ message: "Placeholder" });
}
