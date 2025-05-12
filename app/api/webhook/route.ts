// app/api/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WABA_API;


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


export async function POST(req: NextRequest) {
    const body = await req.json()
    console.dir(body, { depth: null })  
    return new Response("EVENT_RECEIVED", { status: 200 })
  }
  