// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST  →  chat endpoint used by the UI
export async function POST(req: NextRequest) {
  console.log("[API Route - /api/chat] Received POST request to disabled chat.");
  return NextResponse.json({ message: "chat needs to be activated from code" });
}

// (optional) GET  → simple health-check / placeholder
export function GET() {
  return NextResponse.json({ message: "Placeholder for /api/chat GET" });
}
