import { NextRequest, NextResponse } from 'next/server';
import { StripePaymentService } from '@/lib/payments/stripe-utils';

export const runtime = 'nodejs';

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

      case 'create_production_onboarding_link':
        // Force production environment for real Stripe onboarding
        console.log('[PRODUCTION ONBOARDING] Creating real onboarding link for business:', businessId);
        console.log('[PRODUCTION ONBOARDING] Using production Stripe keys from Vercel');
        
        const productionOnboardingResult = await StripePaymentService.createOnboardingLink(businessId);
        if (!productionOnboardingResult.success) {
          return NextResponse.json(
            { error: productionOnboardingResult.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          onboardingUrl: productionOnboardingResult.url,
          environment: 'production',
          message: 'Real onboarding link created with production Stripe keys'
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

      case 'create_fresh_account':
        const freshAccountResult = await StripePaymentService.createExpressAccount(businessId, true);
        if (!freshAccountResult.success) {
          return NextResponse.json(
            { error: freshAccountResult.error },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          accountId: freshAccountResult.accountId
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create_onboarding_link, create_production_onboarding_link, check_status, create_account, or create_fresh_account' },
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