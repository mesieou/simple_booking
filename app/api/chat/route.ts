// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/lib/bot/chatLogic";   // <─ add this line

export async function POST(req: NextRequest) {
  try {
    const { history = [] } = await req.json();      // expect { history: [...] }
    const newHistory = await handleChat(history);   // <─ call your bot logic
    return NextResponse.json({ history: newHistory });
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
