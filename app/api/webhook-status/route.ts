import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = {
    timestamp: new Date().toISOString(),
    endpoint: "/api/webhook2",
    fullUrl: "https://skedy.io/api/webhook2",
    environment: {
      USE_WABA_WEBHOOK: process.env.USE_WABA_WEBHOOK,
      WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || "v23.0",
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? "configured" : "not configured",
      WHATSAPP_PERMANENT_TOKEN: process.env.WHATSAPP_PERMANENT_TOKEN ? "configured" : "not configured",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? "configured" : "not configured",
      WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ? "configured" : "not configured",
    },
    headers: {
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type'),
      accept: req.headers.get('accept'),
    },
    requestInfo: {
      method: req.method,
      url: req.url,
      pathname: req.nextUrl.pathname,
    }
  };

  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  // Echo back the request for debugging
  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const echo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers,
    body: body.substring(0, 1000), // Limit body size for logging
    bodyLength: body.length,
  };

  console.log("[Webhook Status] Echo request:", JSON.stringify(echo, null, 2));

  return NextResponse.json({
    message: "Webhook status endpoint - request echoed back",
    echo
  });
} 