// app/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/lib/chatbot-handlers/central-chatbot-processor";   // <— your helper

// POST  →  chat endpoint used by the UI
export async function POST(req: NextRequest) {
  try {
    const { history = [] } = await req.json();        // expects { history:[...] }
    const newHistory = await handleChat(history);     // call bot logic
    return NextResponse.json({ history: newHistory });
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
