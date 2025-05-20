// app/api/webhook/route.ts

import { NextRequest } from "next/server";

const VERIFY_TOKEN = process.env.WABA_API;

// Handle incoming customer messages
async function handleCustomerMessage(message: string) {
    // For now, just logging the message
    console.log("Received customer message:", message);
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get("hub.mode")
    const token = searchParams.get("hub.verify_token")
    const challenge = searchParams.get("hub.challenge")

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified");
        return new Response(challenge, { status: 200 })
    }

    return new Response("Error, wrong validation token", { status: 403 })
}

// Receives messages from WhatsApp webhook and calls handleCustomerMessage with the message content
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Extract message from WhatsApp webhook payload
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
        
        if (message) {
            // Log the full webhook payload for debugging
            console.log("Webhook payload:", JSON.stringify(body, null, 2));
            
            // Handle the message
            await handleCustomerMessage(message);
        } else {
            console.log("Received webhook without message content:", JSON.stringify(body, null, 2));
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response("Error processing webhook", { status: 500 });
    }
}
  