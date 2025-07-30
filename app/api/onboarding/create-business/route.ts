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
import { DepositManager } from '@/lib/database/models/business';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Track created resources for cleanup on failure
  const createdResources = {
    authUsers: [] as string[],
    businessId: null as string | null,
    serviceIds: [] as string[],
    calendarSettingsIds: [] as string[],
    stripeAccountId: null as string | null
  };

  const cleanupOnError = async () => {
    console.log('[Onboarding] Error occurred, cleaning up created resources...');
    
    const adminSupa = getEnvironmentServiceRoleClient();
    
    // Clean up auth users
    for (const authUserId of createdResources.authUsers) {
      try {
        await adminSupa.auth.admin.deleteUser(authUserId);
        console.log(`[Onboarding] Cleaned up auth user: ${authUserId}`);
      } catch (error) {
        console.error(`[Onboarding] Failed to cleanup auth user ${authUserId}:`, error);
      }
    }
    
    // Clean up business (this will cascade to related records)
    if (createdResources.businessId) {
      try {
        await Business.delete(createdResources.businessId);
        console.log(`[Onboarding] Cleaned up business: ${createdResources.businessId}`);
      } catch (error) {
        console.error(`[Onboarding] Failed to cleanup business ${createdResources.businessId}:`, error);
      }
    }
    
    console.log('[Onboarding] Cleanup completed');
  };

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

    // Process uploaded FAQ document (optional)
    let customQandA: string | undefined;
    let faqDocumentProcessed = false;
    if (onboardingData.faqDocumentBase64 && onboardingData.faqDocumentName) {
      console.log(`[Onboarding] FAQ document provided: ${onboardingData.faqDocumentName} (${onboardingData.faqDocumentSize} bytes)`);
      
      try {
        // Extract text from base64 document
        // For now, we'll assume it's already text content
        // In production, you'd want to:
        // 1. Detect file type (PDF, Word, etc.)
        // 2. Extract text using appropriate library
        // 3. Parse Q&A format
        
        const base64Data = onboardingData.faqDocumentBase64.split(',')[1] || onboardingData.faqDocumentBase64;
        customQandA = Buffer.from(base64Data, 'base64').toString('utf-8');
        faqDocumentProcessed = true;
        console.log('[Onboarding] Custom Q&A extracted from uploaded document');
      } catch (error) {
        console.error('[Onboarding] Error processing FAQ document:', error);
        faqDocumentProcessed = false;
        // Don't fail the process, just skip the custom Q&A
      }
    }

    // Create knowledge base from form data + optional custom Q&A
    let knowledgeBaseContent = '';
    let knowledgeBaseSaved = false;
    try {
      const { createKnowledgeBase, saveKnowledgeBase } = await import('@/lib/knowledge-base');
      
      const knowledgeOptions = {
        businessName: onboardingData.businessName,
        businessCategory: onboardingData.businessCategory,
        ownerFirstName: onboardingData.ownerFirstName,
        ownerLastName: onboardingData.ownerLastName,
        email: onboardingData.email,
        phone: onboardingData.phone,
        whatsappNumber: onboardingData.whatsappNumber,
        businessAddress: onboardingData.businessAddress,
        services: onboardingData.services || [],
        numberOfProviders: numberOfProviders,
        depositType: onboardingData.depositType || 'percentage',
        depositPercentage: onboardingData.depositType === 'percentage' ? (onboardingData.depositPercentage || 0) : undefined,
        depositFixedAmount: onboardingData.depositType === 'fixed' ? (onboardingData.depositFixedAmount || 0) : undefined,
        preferredPaymentMethod: onboardingData.preferredPaymentMethod || 'online',
      };
      
      knowledgeBaseContent = createKnowledgeBase(knowledgeOptions, customQandA);
      console.log('[Onboarding] Knowledge base created successfully');
      console.log(`[Onboarding] Knowledge base length: ${knowledgeBaseContent.length} characters`);
      
    } catch (error) {
      console.error('[Onboarding] Error creating knowledge base:', error);
      // Don't fail the entire onboarding process for knowledge base issues
    }

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
    createdResources.authUsers.push(authData.user.id);

    // --- Step 2: Create Business ---
    console.log('[Onboarding] Creating business...');
    
    // Combine country codes with phone numbers
    const phoneCountryCode = onboardingData.phoneCountryCode || '+61';
    const whatsappCountryCode = onboardingData.whatsappCountryCode || '+61';
    const fullPhone = onboardingData.phone ? `${phoneCountryCode}${onboardingData.phone}` : '';
    const fullWhatsappNumber = onboardingData.whatsappNumber ? `${whatsappCountryCode}${onboardingData.whatsappNumber}` : '';
    
    const businessData = {
      name: onboardingData.businessName,
      email: onboardingData.email,
      phone: fullPhone,
      timeZone: onboardingData.timeZone || 'Australia/Sydney',
      interfaceType: 'whatsapp' as const,
      whatsappNumber: fullWhatsappNumber,
      whatsappPhoneNumberId: '', // To be configured later
      businessAddress: onboardingData.businessAddress || '',
      websiteUrl: onboardingData.websiteUrl || '',
      businessCategory: onboardingData.businessCategory as any,
      numberOfProviders: numberOfProviders, // Track the number of providers
      depositType: onboardingData.depositType || 'percentage',
      depositPercentage: onboardingData.depositType === 'percentage' ? (onboardingData.depositPercentage || 0) : undefined,
      depositFixedAmount: onboardingData.depositType === 'fixed' ? (onboardingData.depositFixedAmount || 0) : undefined,
      stripeConnectAccountId: undefined, // To be created later
      stripeAccountStatus: 'pending' as const,
      preferredPaymentMethod: onboardingData.preferredPaymentMethod || 'cash'
    };
    
    const business = new Business(businessData);

    const businessResult = await business.addWithClient(adminSupa);
    if (!businessResult || !business.id) {
      console.error('[Onboarding] Business creation failed');
      return NextResponse.json(
        { error: 'Failed to create business' },
        { status: 500 }
      );
    }

    console.log(`[Onboarding] Business created with ID: ${business.id}`);
    createdResources.businessId = business.id;

    // --- Step 2.5: Save Knowledge Base to Crawling System ---
    if (knowledgeBaseContent && knowledgeBaseContent.length > 0) {
      try {
        console.log('[Onboarding] Processing knowledge base through crawling system...');
        const { saveKnowledgeBase } = await import('@/lib/knowledge-base');
        knowledgeBaseSaved = await saveKnowledgeBase(business.id, knowledgeBaseContent);
        if (knowledgeBaseSaved) {
          console.log('[Onboarding] Knowledge base successfully processed and saved to database');
        } else {
          console.log('[Onboarding] Knowledge base processing failed but continuing onboarding');
        }
      } catch (error) {
        console.error('[Onboarding] Error processing knowledge base:', error);
        // Don't fail the entire onboarding process for knowledge base issues
      }
    }

    // --- Step 3: Create Owner User Profile ---
    console.log(`[Onboarding] Creating owner user profile with role: ${userRole}`);
    const ownerUser = new User(
      onboardingData.ownerFirstName,
      onboardingData.ownerLastName,
      userRole,
      business.id,
      onboardingData.email,
      fullPhone ? fullPhone.replace(/[^\d]/g, '') : undefined,
      fullWhatsappNumber ? fullWhatsappNumber.replace(/[^\d]/g, '') : undefined
    );

    // Set the auth user ID for the owner
    ownerUser.id = authData.user.id;

    const ownerUserResult = await ownerUser.add({
      email: onboardingData.email,
      password: onboardingData.password,
      whatsappNumber: fullWhatsappNumber,
      skipProviderValidation: true,
      supabaseClient: adminSupa
    });

    if (!ownerUserResult) {
      console.error('[Onboarding] Owner user profile creation failed');
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
      // Create additional providers based on user role
      // For admin/provider: create providers starting from index 1 (owner is index 0)
      // For admin: create all providers starting from index 0 (no owner provider)
      const startIndex = userRole === 'admin/provider' ? 1 : 0;
      
      for (let i = startIndex; i < numberOfProviders; i++) {
        // For admin/provider: providerNames[i-1] (skip owner at index 0)
        // For admin: providerNames[i] (all providers)
        const providerNameIndex = userRole === 'admin/provider' ? i - 1 : i;
        const providerName = providerNames[providerNameIndex] || `Provider ${i + 1}`;
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
        createdResources.authUsers.push(providerAuthData.user.id);

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
            createdResources.serviceIds.push(service.id);
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
    
    // Use individual provider calendar settings or fallback to defaults
    const providerCalendarSettings = onboardingData.providerCalendarSettings || [];
    
    // Fallback default working hours and buffer time if no provider settings provided
    const defaultWorkingHours = {
      mon: { start: '09:00', end: '17:00' },
      tue: { start: '09:00', end: '17:00' },
      wed: { start: '09:00', end: '17:00' },
      thu: { start: '09:00', end: '17:00' },
      fri: { start: '09:00', end: '17:00' },
      sat: null,
      sun: null
    };
    const defaultBufferTime = 15;

    const createdCalendarSettings: CalendarSettings[] = [];

    try {
      for (let i = 0; i < allProviderUsers.length; i++) {
        const provider = allProviderUsers[i];
        
        // Generate provider name based on role and index
        let providerName;
        if (i === 0 && userRole === 'admin/provider') {
          // First provider is the owner for admin/provider role
          providerName = `${onboardingData.ownerFirstName} ${onboardingData.ownerLastName}`.trim();
        } else {
          // For admin role: use providerNames[i]
          // For admin/provider role: use providerNames[i-1] for additional providers
          const providerNameIndex = userRole === 'admin/provider' ? i - 1 : i;
          providerName = providerNames[providerNameIndex] || `Provider ${i + 1}`;
        }

        console.log(`[Onboarding] Creating calendar settings for provider ${i}: ${providerName} (${provider.role})`);

        // Only create calendar settings for users who actually provide services
        if (provider.role === 'admin/provider' || provider.role === 'provider') {
          console.log(`[Onboarding] Provider ${i} qualifies for calendar settings, proceeding...`);
          
          // Get individual provider calendar settings or use defaults
          const providerCalendarData = providerCalendarSettings[i] || {
            workingHours: defaultWorkingHours,
            bufferTime: defaultBufferTime
          };
          
          const calendarSettingsData = {
            userId: provider.id, // Database uses userId field
            businessId: business.id,
            workingHours: providerCalendarData.workingHours,
            manageCalendar: false,
            settings: {
              bufferTime: providerCalendarData.bufferTime,
              timezone: onboardingData.timeZone || 'Australia/Sydney'
            }
          };

          console.log(`[Onboarding] Calling CalendarSettings.save with data for ${providerName}:`, {
            providerId: provider.id,
            bufferTime: providerCalendarData.bufferTime,
            workingHours: Object.keys(providerCalendarData.workingHours).filter(day => providerCalendarData.workingHours[day]).length + ' active days'
          });
          
          const result = await CalendarSettings.save(undefined, calendarSettingsData, { 
            useServiceRole: true, 
            supabaseClient: adminSupa 
          });
          
          console.log(`[Onboarding] CalendarSettings.save returned:`, result);
          
          if (result && result.id) {
            createdCalendarSettings.push(result);
            createdResources.calendarSettingsIds.push(result.id);
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
      let successfulSaves = 0;
      for (const slot of availabilitySlots) {
        try {
          await slot.add({ useServiceRole: true, supabaseClient: adminSupa });
          successfulSaves++;
          
          // Log details of each saved slot
          const slotCount = Object.keys(slot.slots).reduce((total, duration) => {
            return total + slot.slots[duration].length;
          }, 0);
          console.log(`[Onboarding] ✅ Saved availability for ${slot.date}: ${slotCount} time slots across ${Object.keys(slot.slots).length} durations`);
        } catch (error) {
          console.error(`[Onboarding] ❌ Failed to save availability for ${slot.date}:`, error);
        }
      }

      availabilityGenerated = successfulSaves > 0;
      console.log(`[Onboarding] Successfully saved ${successfulSaves}/${availabilitySlots.length} availability slot records`);

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
          createdResources.stripeAccountId = stripeResult.accountId;
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
      providers: allProviderUsers.map((provider, index) => {
        // Generate provider name based on role and index
        let providerName;
        if (index === 0 && userRole === 'admin/provider') {
          // First provider is the owner for admin/provider role
          providerName = `${onboardingData.ownerFirstName} ${onboardingData.ownerLastName}`.trim();
        } else {
          // For admin role: use providerNames[index]
          // For admin/provider role: use providerNames[index-1] for additional providers
          const providerNameIndex = userRole === 'admin/provider' ? index - 1 : index;
          providerName = providerNames[providerNameIndex] || `Provider ${index + 1}`;
        }
        
        return {
          id: provider.id,
          name: providerName,
          role: provider.role,
          index: index
        };
      }),
      onboarding: {
        authUserIds: createdAuthUsers,
        serviceIds,
        calendarSettingsIds: createdCalendarSettings.map(cs => cs.id),
        stripeAccountId,
        availabilityGenerated,
        totalProviders: allProviderUsers.length,
        faqDocumentProcessed,
        knowledgeBaseSaved
      }
    });

  } catch (error) {
    console.error('[Onboarding] Unexpected error:', error);
    
    // Clean up any created resources
    await cleanupOnError();
    
    return NextResponse.json(
      { error: 'Internal server error during onboarding. All created resources have been cleaned up.' },
      { status: 500 }
    );
  }
}