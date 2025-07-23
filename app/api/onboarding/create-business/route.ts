import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServiceRoleClient } from '@/lib/database/supabase/environment';
import { Business } from '@/lib/database/models/business';
import { User } from '@/lib/database/models/user';
import { Service } from '@/lib/database/models/service';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { StripePaymentService } from '@/lib/payments/stripe-utils';
import { getBusinessTemplate } from '@/lib/config/business-templates';
import { computeAggregatedAvailability } from '@/lib/general-helpers/availability/index';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';

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

    // Validate provider data
    const numberOfProviders = onboardingData.numberOfProviders || 1;
    const providerNames = onboardingData.providerNames || [];
    
    if (numberOfProviders < 1 || numberOfProviders > 10) {
      return NextResponse.json(
        { error: 'Number of providers must be between 1 and 10' },
        { status: 400 }
      );
    }

    console.log(`[Onboarding] Creating business with ${numberOfProviders} providers, owner role: ${userRole}`);

    // --- Step 1: Create Auth User for Owner ---
    console.log('[Onboarding] Creating owner auth user...');
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

    console.log(`[Onboarding] Owner auth user created with ID: ${authData.user.id}`);

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
      numberOfProviders: numberOfProviders, // Track the number of providers
      depositPercentage: onboardingData.depositPercentage || 25,
      stripeConnectAccountId: undefined, // To be created later
      stripeAccountStatus: 'pending' as const,
      preferredPaymentMethod: onboardingData.preferredPaymentMethod || 'cash'
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

    // --- Step 3: Create Owner User Profile ---
    console.log(`[Onboarding] Creating owner user profile with role: ${userRole}`);
    const ownerUser = new User(
      onboardingData.ownerFirstName,
      onboardingData.ownerLastName,
      userRole,
      business.id,
      onboardingData.email,
      onboardingData.phone ? onboardingData.phone.replace(/[^\d]/g, '') : undefined,
      onboardingData.whatsappNumber ? onboardingData.whatsappNumber.replace(/[^\d]/g, '') : undefined
    );

    // Set the auth user ID for the owner
    ownerUser.id = authData.user.id;

    const ownerUserResult = await ownerUser.add({
      email: onboardingData.email,
      password: onboardingData.password,
      whatsappNumber: onboardingData.whatsappNumber,
      skipProviderValidation: true,
      supabaseClient: adminSupa
    });

    if (!ownerUserResult) {
      console.error('[Onboarding] Owner user profile creation failed');
      // Clean up auth user and business if user creation fails
      await adminSupa.auth.admin.deleteUser(authData.user.id);
      await Business.delete(business.id);
      return NextResponse.json(
        { error: 'Failed to create owner user profile' },
        { status: 500 }
      );
    }

    console.log(`[Onboarding] Owner user profile created with ID: ${ownerUser.id}`);

    // --- Step 4: Create Additional Provider User Accounts ---
    const allProviderUsers: User[] = [ownerUser]; // Start with owner
    const createdAuthUsers: string[] = [authData.user.id]; // Track for cleanup

    try {
      // Create additional providers (if any)
      for (let i = 1; i < numberOfProviders; i++) {
        const providerName = providerNames[i - 1] || `Provider ${i + 1}`;
        const [firstName, ...lastNameParts] = providerName.trim().split(' ');
        const lastName = lastNameParts.join(' ') || 'Provider';
        
        console.log(`[Onboarding] Creating provider ${i + 1}: ${firstName} ${lastName}`);
        
        // Generate a unique email for this provider
        const timestamp = Date.now();
        const providerEmail = `provider${i}-${timestamp}@${onboardingData.email.split('@')[1]}`;
        const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'; // Temporary secure password
        
        // Create auth user for this provider
        const { data: providerAuthData, error: providerAuthError } = await adminSupa.auth.admin.createUser({
          email: providerEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            firstName,
            lastName,
            role: 'provider',
            isOnboarding: true,
            isAdditionalProvider: true,
            parentBusinessId: business.id
          }
        });

        if (providerAuthError || !providerAuthData.user) {
          console.error(`[Onboarding] Failed to create auth user for provider ${i + 1}:`, providerAuthError);
          throw new Error(`Failed to create provider ${i + 1} auth account`);
        }

        createdAuthUsers.push(providerAuthData.user.id);

        // Create user profile for this provider
        const providerUser = new User(
          firstName,
          lastName,
          'provider',
          business.id,
          providerEmail
        );

        providerUser.id = providerAuthData.user.id;

        const providerUserResult = await providerUser.add({
          email: providerEmail,
          password: tempPassword,
          skipProviderValidation: true,
          supabaseClient: adminSupa
        });

        if (!providerUserResult) {
          throw new Error(`Failed to create provider ${i + 1} user profile`);
        }

        allProviderUsers.push(providerUser);
        console.log(`[Onboarding] Provider ${i + 1} user profile created with ID: ${providerUser.id}`);
      }

      console.log(`[Onboarding] Successfully created ${allProviderUsers.length} total providers`);

    } catch (error) {
      console.error('[Onboarding] Error creating additional providers:', error);
      
      // Clean up all created auth users
      for (const authUserId of createdAuthUsers) {
        try {
          await adminSupa.auth.admin.deleteUser(authUserId);
        } catch (cleanupError) {
          console.error(`[Onboarding] Failed to cleanup auth user ${authUserId}:`, cleanupError);
        }
      }
      
      // Clean up business
      try {
        await Business.delete(business.id);
      } catch (cleanupError) {
        console.error('[Onboarding] Failed to cleanup business:', cleanupError);
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to create providers' },
        { status: 500 }
      );
    }

    // --- Step 5: Create Default Services (based on business template) ---
    console.log('[Onboarding] Creating default services...');
    const template = getBusinessTemplate(onboardingData.businessCategory);
    const serviceIds: string[] = [];

    if (template && template.services) {
      for (const serviceTemplate of template.services) {
        try {
          // Use form data services if provided, otherwise use template
          const formServices = onboardingData.services || [];
          const serviceData = formServices.length > 0 ? formServices.find((s: any) => s.name === serviceTemplate.name) || serviceTemplate : serviceTemplate;
          
          const service = new Service({
            businessId: business.id,
            name: serviceData.name,
            description: serviceData.description,
            fixedPrice: serviceData.fixedPrice,
            baseCharge: serviceData.baseCharge,
            ratePerMinute: serviceData.ratePerMinute,
            durationEstimate: serviceData.durationEstimate || 60,
            pricingType: serviceData.pricingType || 'fixed',
            mobile: serviceData.mobile
          });

          const serviceResult = await service.add({ supabaseClient: adminSupa });
          if (serviceResult && service.id) {
            serviceIds.push(service.id);
            console.log(`[Onboarding] Created service: ${serviceData.name}`);
          }
        } catch (error) {
          console.error(`[Onboarding] Failed to create service ${serviceTemplate.name}:`, error);
          // Continue with other services even if one fails
        }
      }
    }

    // --- Step 6: Create Provider Calendar Settings ---
    console.log('[Onboarding] Creating provider calendar settings...');
    const workingHours = onboardingData.workingHours || {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: null,
      sun: null
    };

    const calendarSettings = {
      timezone: onboardingData.timeZone || 'Australia/Sydney',
      bufferTime: onboardingData.bufferTime || 15
    };

    const createdCalendarSettings: CalendarSettings[] = [];

    try {
      for (let i = 0; i < allProviderUsers.length; i++) {
        const provider = allProviderUsers[i];
        const providerName = i === 0 
          ? `${onboardingData.ownerFirstName} ${onboardingData.ownerLastName}`.trim()
          : (providerNames[i] || `Provider ${i + 1}`);

        console.log(`[Onboarding] Creating calendar settings for provider ${i}: ${providerName} (${provider.role})`);

        // Only create calendar settings for users who actually provide services
        if (provider.role === 'admin/provider' || provider.role === 'provider') {
          console.log(`[Onboarding] Provider ${i} qualifies for calendar settings, proceeding...`);
          const calendarSettingsData = {
            userId: provider.id, // Database uses userId field
            businessId: business.id,
            workingHours: workingHours,
            manageCalendar: false,
            settings: {
              bufferTime: onboardingData.bufferTime || 15, // Use form value or default to 15 minutes
              timezone: onboardingData.timeZone || 'Australia/Sydney'
            }
          };

          console.log(`[Onboarding] Calling CalendarSettings.save with data:`, calendarSettingsData);
          
          const result = await CalendarSettings.save(undefined, calendarSettingsData, { 
            useServiceRole: true, 
            supabaseClient: adminSupa 
          });
          
          console.log(`[Onboarding] CalendarSettings.save returned:`, result);
          
          if (result) {
            createdCalendarSettings.push(result);
            console.log(`[Onboarding] Created calendar settings for ${providerName} (ID: ${result.id})`);
          } else {
            console.log(`[Onboarding] No result returned from CalendarSettings.save for ${providerName}`);
          }
        } else {
          console.log(`[Onboarding] Skipping calendar settings for ${providerName} - admin only (no service provision)`);
        }
      }

      console.log(`[Onboarding] Successfully created ${createdCalendarSettings.length} calendar settings`);

    } catch (error) {
      console.error('[Onboarding] Error creating calendar settings:', error);
      console.error('[Onboarding] Calendar settings error details:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : null,
        providers: allProviderUsers.length,
        businessId: business.id
      });
      // Non-critical, continue without some calendar settings
    }

    // Legacy calendar settings creation removed - using single calendar settings approach now

    // --- Step 8: Generate Initial Aggregated Availability ---
    console.log('[Onboarding] Generating initial aggregated availability...');
    let availabilityGenerated = false;
    try {
      const today = new Date();
      const availabilitySlots = await computeAggregatedAvailability(
        business.id,
        today,
        30, // Generate 30 days of availability
        { supabaseClient: adminSupa }
      );

      console.log(`[Onboarding] Generated ${availabilitySlots.length} days of aggregated availability`);

      // Save all availability slots
      for (const slot of availabilitySlots) {
        try {
          await slot.add({ useServiceRole: true, supabaseClient: adminSupa });
        } catch (error) {
          console.error(`[Onboarding] Failed to save availability for ${slot.date}:`, error);
        }
      }

      availabilityGenerated = availabilitySlots.length > 0;
      console.log(`[Onboarding] Successfully saved ${availabilitySlots.length} availability slot records`);

    } catch (error) {
      console.error('[Onboarding] Error generating initial availability:', error);
      // Non-critical, continue without initial availability (can be generated later by cron)
    }

    // --- Step 9: Create Stripe Connect Account (if payment setup requested) ---
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

    console.log('[Onboarding] Multi-provider business onboarding completed successfully!');

    // Return success response
    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name
      },
      owner: {
        id: ownerUser.id,
        role: userRole,
        firstName: ownerUser.firstName,
        lastName: ownerUser.lastName
      },
      providers: allProviderUsers.map((provider, index) => ({
        id: provider.id,
        name: index === 0 
          ? `${onboardingData.ownerFirstName} ${onboardingData.ownerLastName}`.trim()
          : (providerNames[index] || `Provider ${index + 1}`),
        role: provider.role,
        index: index
      })),
      onboarding: {
        authUserIds: createdAuthUsers,
        serviceIds,
        calendarSettingsIds: createdCalendarSettings.map(cs => cs.id),
        stripeAccountId,
        availabilityGenerated,
        totalProviders: allProviderUsers.length
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