import { NextRequest, NextResponse } from "next/server";
import { StripePaymentService } from "@/lib/payments/stripe-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "Quote ID is required" },
        { status: 400 }
      );
    }

    console.log(`[Payment API] Creating payment link for quote: ${quoteId}`);

    const result = await StripePaymentService.createPaymentLinkForQuote(quoteId);

    if (!result.success) {
      console.error(`[Payment API] Failed to create payment link: ${result.error}`);
      return NextResponse.json(
        { error: result.error || "Failed to create payment link" },
        { status: 500 }
      );
    }

    console.log(`[Payment API] Successfully created payment link for quote: ${quoteId}`);
    
    return NextResponse.json({
      success: true,
      paymentLink: result.paymentLink,
      quoteId
    });

  } catch (error) {
    console.error("[Payment API] Error creating payment link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: "Payment Link Creation API",
    usage: {
      method: "POST",
      body: {
        quoteId: "string - Required. The ID of the quote to create payment for"
      },
      response: {
        success: "boolean",
        paymentLink: "string - Stripe payment link URL",
        quoteId: "string - Quote ID that was processed"
      }
    },
    environment: {
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET
    }
  });
} 