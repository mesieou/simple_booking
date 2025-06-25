import { NextRequest, NextResponse } from "next/server";
import { StripePaymentService } from "@/lib/payments/stripe-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] No signature header found');
      return NextResponse.json(
        { error: "No signature header" },
        { status: 400 }
      );
    }

    console.log('[Stripe Webhook] Received webhook request');

    // Verify the webhook signature
    const event = StripePaymentService.verifyStripeWebhookSignature(body, signature);
    
    if (!event) {
      console.error('[Stripe Webhook] Invalid signature');
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Processing event: ${event.type}`);

    // Handle the webhook event
    await StripePaymentService.handleStripeWebhook(event);

    console.log(`[Stripe Webhook] Successfully processed event: ${event.type}`);

    return NextResponse.json({
      success: true,
      eventType: event.type,
      processed: true
    });

  } catch (error) {
    console.error("[Stripe Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: "Stripe Webhook Handler",
    description: "Handles Stripe webhook events for payment processing",
    supportedEvents: [
      "checkout.session.completed",
      "payment_intent.payment_failed",
      "checkout.session.expired",
      "account.updated"
    ],
    environment: {
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
} 