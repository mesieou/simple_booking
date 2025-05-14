// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { handleCustomerMessage } from "@/lib/bot/chatLogic";


const WABA_API = process.env.WABA_API;
const WHATSAPP_PHONE_ID = process.env.WABA_PHONE_NUMBER_ID;


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get("hub.mode")
    const token = searchParams.get("hub.verify_token")
    const challenge = searchParams.get("hub.challenge")

    if (mode === "subscribe" && token === WABA_API) {
        console.log("Webhook verified");
        return new Response(challenge, { status: 200 })
    }

    return new Response("Error, wrong validation token", { status: 403 })
}

// Receives messages from WhatsApp webhook and calls handleCustomerMessage with the message content
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Extract message and sender from WhatsApp webhook payload
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
        const sender = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
        
        if (message && sender) {
            // Log the full webhook payload for debugging
            console.log("Webhook payload:", JSON.stringify(body, null, 2));
            
            // Handle the message and get the response
            const response = await handleCustomerMessage(message);
            
            // Send response back to WhatsApp
            const responseData = {
                messaging_product: "whatsapp",
                to: sender,
                type: "text",
                text: { body: response }
            };

            const waRes = await fetch(
                `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${WABA_API}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(responseData),
                }
            );
            const waResBody = await waRes.json().catch(() => ({}));
            console.log("WhatsApp API response status:", waRes.status);
            console.log("WhatsApp API response body:", waResBody);
        } else {
            console.log("Received webhook without message content:", JSON.stringify(body, null, 2));
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return new Response("Error processing webhook", { status: 500 });
    }
}
  