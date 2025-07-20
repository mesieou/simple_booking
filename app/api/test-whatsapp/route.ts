import { NextRequest, NextResponse } from "next/server";
import { getWhatsappHeaders } from "@/lib/bot-engine/channels/whatsapp/whatsapp-headers";

export const dynamic = "force-dynamic";

// Test endpoint to send WhatsApp template messages
export async function POST(req: NextRequest) {
  console.log("[Test WhatsApp] Received test request");
  
  try {
    const body = await req.json();
    const { phoneNumber, templateName = "hello_world", languageCode = "en_US" } = body;
    
    // Use a hardcoded number if none provided (replace with your test number)
    const targetNumber = phoneNumber || "34612345678"; // Replace with your test WhatsApp number
    
    const WHATSAPP_CONFIG = {
      API_VERSION: process.env.WHATSAPP_API_VERSION || "v23.0",
      PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    };
    
    if (!WHATSAPP_CONFIG.PHONE_NUMBER_ID) {
      return NextResponse.json({ 
        error: "WHATSAPP_PHONE_NUMBER_ID not configured" 
      }, { status: 500 });
    }
    
    const apiUrl = `https://graph.facebook.com/${WHATSAPP_CONFIG.API_VERSION}/${WHATSAPP_CONFIG.PHONE_NUMBER_ID}/messages`;
    
    // Template message payload
    const payload = {
      messaging_product: "whatsapp",
      to: targetNumber,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode
        }
      }
    };
    
    console.log("[Test WhatsApp] Sending payload:", JSON.stringify(payload, null, 2));
    
    const headers = getWhatsappHeaders();
    console.log("[Test WhatsApp] Using headers:", headers);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    const responseData = await response.text();
    console.log("[Test WhatsApp] Response status:", response.status);
    console.log("[Test WhatsApp] Response data:", responseData);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: `WhatsApp API error: ${response.status}`,
        details: responseData
      }, { status: response.status });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Template message sent successfully",
      response: JSON.parse(responseData)
    });
    
  } catch (error) {
    console.error("[Test WhatsApp] Error:", error);
    return NextResponse.json({ 
      error: "Failed to send template message",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// GET endpoint to test the API configuration
export async function GET(req: NextRequest) {
  console.log("[Test WhatsApp] Received GET request");
  
  const config = {
    apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    hasPermanentToken: !!process.env.WHATSAPP_PERMANENT_TOKEN,
    hasWebhookVerifyToken: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    useWabaWebhook: process.env.USE_WABA_WEBHOOK === "true",
  };
  
  return NextResponse.json({
    message: "WhatsApp API Test Endpoint",
    config,
    endpoints: {
      sendTemplate: "POST /api/test-whatsapp",
      webhook: "POST /api/whatsapp-webhook",
      webhookVerify: "GET /api/whatsapp-webhook"
    },
    usage: {
      sendTemplate: {
        method: "POST",
        body: {
          phoneNumber: "34612345678", // Optional, will use default if not provided
          templateName: "hello_world", // Optional, defaults to hello_world
          languageCode: "en_US" // Optional, defaults to en_US
        }
      }
    }
  });
} 