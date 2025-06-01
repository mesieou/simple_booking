/**
 * app/api/webhook/route.ts
 * 
 * WhatsApp Webhook API Route for Next.js.
 * 
 * - Handles GET requests for webhook verification (Meta/WhatsApp setup).
 * - Handles POST requests for incoming WhatsApp messages/events.
 * - Uses the logIncomingMessage helper to print payloads for debugging.
 * - Only enabled if USE_WABA_WEBHOOK="true" in environment variables.
 * 
 * This is the correct place for API routes in a Next.js app using the /app directory structure.
 */

import { NextRequest, NextResponse } from "next/server";
import { logIncomingMessage, WebhookAPIBody } from "@/lib/llm-actions/whatsapp/whatsapp-message-logger";

// Read environment variables for security and feature toggling
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";

// Handle incoming customer messages
async function handleCustomerMessage(message: string) {
    // For now, just logging the message
    console.log("Received customer message:", message);
}

/**
 * GET handler: Used by Meta/WhatsApp to verify the webhook endpoint.
 * Responds with the challenge if the verify token matches.
 */
export async function GET(req: NextRequest) {
  console.log(`Raw USE_WABA_WEBHOOK from env: '${rawUseWabaWebhook}'`);
  console.log(`Parsed USE_WABA_WEBHOOK: ${USE_WABA_WEBHOOK}`);

  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping GET request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  console.log("Webhook GET request received:");
  console.log("Mode:", hubMode);
  console.log("Challenge:", hubChallenge);
  console.log("Verify Token:", hubVerifyToken);
  console.log("Expected Token:", WHATSAPP_VERIFY_TOKEN);

  if (
    hubMode === "subscribe" &&
    hubVerifyToken === WHATSAPP_VERIFY_TOKEN &&
    hubChallenge
  ) {
    console.log("Webhook verified successfully.");
    return new NextResponse(hubChallenge, { status: 200 });
  } else {
    console.error("Webhook verification failed.");
    return NextResponse.json({ message: "Verification failed" }, { status: 403 });
  }
}

/**
 * POST handler: Receives WhatsApp webhook events (messages, status, etc).
 * Logs the payload using logIncomingMessage for debugging.
 */
export async function POST(req: NextRequest) {
  if (!USE_WABA_WEBHOOK) {
    console.log("WABA Webhook is disabled. Skipping POST request.");
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  try {
    const payload = (await req.json()) as WebhookAPIBody;
    console.log("Webhook POST request received. Processing payload...");
    logIncomingMessage(payload);
    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook POST request:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
  