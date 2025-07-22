import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { Service } from '@/lib/database/models/service';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { StripePaymentService } from '@/lib/payments/stripe-utils';
import { getBusinessTemplate } from '@/lib/config/business-templates';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const adminSupa = getEnvironmentServiceRoleClient();
    
    // Parse request body
    const onboardingData = await request.json();
    
    // Validate required fields
    const requiredFields = ['businessName', 'ownerFirstName', 'ownerLastName', 'email', 'password', 'businessCategory'];
    for (const field of requiredFields) {
      if (!onboardingData[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate user role - must be either 'admin' or 'admin/provider'
    const userRole = onboardingData.userRole || 'admin/provider'; // Default to admin/provider
    if (!['admin', 'admin/provider'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Invalid user role. Must be either "admin" or "admin/provider"' },
        { status: 400 }
      );
    }

    console.log(`[Onboarding] Creating business with user role: ${userRole}`);

    // --- Step 1: Create Auth User ---
    console.log('[Onboarding] Creating auth user...');
    const { data: authData, error: authError } = await adminSupa.auth.admin.createUser({
      email: onboardingData.email,
      password: onboardingData.password,
      email_confirm: true,
      user_metadata: {
        firstName: onboardingData.ownerFirstName,
        lastName: onboardingData.ownerLastName,
        role: userRole,
        isOnboarding: true
      }
    });

    if (authError || !authData.user) {
      console.error('[Onboarding] Auth user creation failed:', authError);
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 400 }
      );
    }

    console.log(`[Onboarding] Auth user created with ID: ${authData.user.id}`);

    // --- Step 2: Create Business ---
    console.log('[Onboarding] Creating business...');
    const businessData = {
      name: onboardingData.businessName,
      email: onboardingData.email,
      phone: onboardingData.phone || '',
      timeZone: onboardingData.timeZone || 'Australia/Sydney',
      interfaceType: 'whatsapp' as const,
      whatsappNumber: onboardingData.whatsappNumber || '',
      whatsappPhoneNumberId: '', // To be configured later
      businessAddress: onboardingData.businessAddress || '',
      websiteUrl: onboardingData.websiteUrl || '',
      businessCategory: onboardingData.businessCategory as any,
      depositPercentage: 25, // Default 25%
      stripeConnectAccountId: undefined, // To be created later
      stripeAccountStatus: 'pending' as const,
      preferredPaymentMethod: 'card'
    };
    
    const business = new Business(businessData);

    const businessResult = await business.addWithClient(adminSupa);
    if (!businessResult || !business.id) {
      console.error('[Onboarding] Business creation failed');
      // Clean up auth user if business creation fails
      await adminSupa.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Failed to create business' },
        { status: 500 }
      );
    }

    console.log(`[Onboarding] Business created with ID: ${business.id}`);

    // --- Step 3: Create User Profile ---
    console.log(`[Onboarding] Creating user profile with role: ${userRole}`);
    const user = new User(
      onboardingData.ownerFirstName,
      onboardingData.ownerLastName,
      userRole,
      business.id,
      onboardingData.email,
      onboardingData.phone ? onboardingData.phone.replace(/[^\d]/g, '') : undefined,
      onboardingData.whatsappNumber ? onboardingData.whatsappNumber.replace(/[^\d]/g, '') : undefined
    );

    const userResult = await user.add({
      email: onboardingData.email,
      password: onboardingData.password,
      whatsappNumber: onboardingData.whatsappNumber,
      skipProviderValidation: true,
      supabaseClient: adminSupa
    });

    if (!userResult) {
      console.error('[Onboarding] User profile creation failed');
      // Clean up auth user and business if user creation fails
      await adminSupa.auth.admin.deleteUser(authData.user.id);
      await Business.delete(business.id);
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    console.log(`[Onboarding] User profile created with ID: ${user.id}`);

    // --- Step 4: Create Default Services (based on business template) ---
    console.log('[Onboarding] Creating default services...');
    const template = getBusinessTemplate(onboardingData.businessCategory);
    const serviceIds: string[] = [];

    if (template && template.services) {
      for (const serviceTemplate of template.services) {
        try {
          const serviceData = {
            businessId: business.id,
            name: serviceTemplate.name,
            description: serviceTemplate.description,
            fixedPrice: serviceTemplate.fixedPrice,
            baseCharge: serviceTemplate.baseCharge,
            ratePerMinute: serviceTemplate.ratePerMinute,
            durationEstimate: serviceTemplate.durationEstimate || 60,
            pricingType: serviceTemplate.pricingType || 'fixed',
            mobile: serviceTemplate.mobile
          };
          
          const service = new Service(serviceData);

          const serviceResult = await service.add({ supabaseClient: adminSupa });
          if (serviceResult && service.id) {
            serviceIds.push(service.id);
            console.log(`[Onboarding] Created service: ${serviceTemplate.name}`);
          }
        } catch (error) {
          console.error(`[Onboarding] Failed to create service ${serviceTemplate.name}:`, error);
          // Continue with other services even if one fails
        }
      }
    }

    // --- Step 5: Create Calendar Settings ---
    console.log('[Onboarding] Creating calendar settings...');
    const calendarData = {
      userId: user.id,
      businessId: business.id,
      workingHours: {
        mon: { start: '09:00', end: '17:00' },
        tue: { start: '09:00', end: '17:00' },
        wed: { start: '09:00', end: '17:00' },
        thu: { start: '09:00', end: '17:00' },
        fri: { start: '09:00', end: '17:00' },
        sat: null,
        sun: null
      },
      manageCalendar: false,
      settings: {
        bufferTime: 15,
        timezone: onboardingData.timeZone || 'Australia/Sydney'
      }
    };
    
    let calendarSettingsId = null;
    try {
      const calendarResult = await CalendarSettings.save(undefined, calendarData, { supabaseClient: adminSupa });
      if (calendarResult && calendarResult.id) {
        calendarSettingsId = calendarResult.id;
        console.log(`[Onboarding] Calendar settings created with ID: ${calendarSettingsId}`);
      }
    } catch (error) {
      console.error('[Onboarding] Failed to create calendar settings:', error);
      // Non-critical, continue without calendar settings
    }

    // --- Step 6: Create Stripe Connect Account (if payment setup requested) ---
    let stripeAccountId = null;
    if (onboardingData.setupPayments) {
      console.log('[Onboarding] Creating Stripe Connect account...');
      try {
        const stripeResult = await StripePaymentService.createExpressAccount(business.id);
        if (stripeResult.success && stripeResult.accountId) {
          stripeAccountId = stripeResult.accountId;
          console.log(`[Onboarding] Stripe account created: ${stripeAccountId}`);
        }
      } catch (error) {
        console.error('[Onboarding] Failed to create Stripe account:', error);
        // Non-critical, continue without Stripe setup
      }
    }

    console.log('[Onboarding] Business onboarding completed successfully!');

    // Return success response
    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name
      },
      user: {
        id: user.id,
        role: userRole,
        firstName: user.firstName,
        lastName: user.lastName
      },
      onboarding: {
        authUserId: authData.user.id,
        serviceIds,
        calendarSettingsId,
        stripeAccountId
      }
    });

  } catch (error) {
    console.error('[Onboarding] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error during onboarding' },
      { status: 500 }
    );
  }
}