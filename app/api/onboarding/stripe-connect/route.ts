import { NextRequest, NextResponse } from 'next/server';
import { StripePaymentService } from '@/lib/payments/stripe-utils';

export async function POST(request: NextRequest) {
  try {
    const { businessId, action } = await request.json();

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'create_onboarding_link':
        const onboardingResult = await StripePaymentService.createOnboardingLink(businessId);
        if (!onboardingResult.success) {
          return NextResponse.json(
            { error: onboardingResult.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          onboardingUrl: onboardingResult.url
        });

      case 'check_status':
        const statusResult = await StripePaymentService.updateAccountStatus(businessId);
        if (!statusResult.success) {
          return NextResponse.json(
            { error: statusResult.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          status: statusResult.status
        });

      case 'create_account':
        const accountResult = await StripePaymentService.createExpressAccount(businessId);
        if (!accountResult.success) {
          return NextResponse.json(
            { error: accountResult.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          accountId: accountResult.accountId
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create_onboarding_link, check_status, or create_account' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in Stripe Connect onboarding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    const statusResult = await StripePaymentService.updateAccountStatus(businessId);
    if (!statusResult.success) {
      return NextResponse.json(
        { error: statusResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: statusResult.status
    });
  } catch (error) {
    console.error('Error getting Stripe Connect status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 