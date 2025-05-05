// app/api/chat/route.ts

import { NextRequest } from "next/server";
import { handleChatRequest, handleHealthCheck } from "../handlers/chat-handler";

// POST  →  chat endpoint used by the UI
export async function POST(req: NextRequest) {
  return handleChatRequest(req);
}

// (optional) GET  → simple health-check / placeholder
export function GET() {
  return handleHealthCheck();
}
