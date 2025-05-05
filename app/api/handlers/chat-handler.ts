import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/lib/bot/chatLogic";

export async function handleChatRequest(req: NextRequest) {
  try {
    const { history = [] } = await req.json();
    const newHistory = await handleChat(history);
    return NextResponse.json({ history: newHistory });
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}

export function handleHealthCheck() {
  return NextResponse.json({ message: "Placeholder" });
} 