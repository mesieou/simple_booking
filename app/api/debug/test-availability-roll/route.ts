import { NextResponse } from 'next/server';
import { rollAllProvidersAvailability } from '@/lib/general-helpers/availability';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { DateTime } from 'luxon';

export async function GET() {
  const debugResults = {
    providers: [] as any[],
    errors: [] as any[],
    success: false,
    message: ''
  };

  try {
    console.log('[DEBUG] Starting availability roll debug...');

    // Step 1: Check providers
    const providers = await User.getAllProviders();
    console.log(`[DEBUG] Found ${providers.length} providers`);
    
    if (providers.length === 0) {
      debugResults.message = 'No providers found in database';
      return NextResponse.json(debugResults);
    }

    // Step 2: Check each provider's setup
    for (const provider of providers) {
      const providerDebug = {
        id: provider.id,
        name: `${provider.firstName} ${provider.lastName}`,
        role: provider.role,
        businessId: provider.businessId,
        business: null as any,
        calendarSettings: null as any,
        currentAvailability: 0,
        error: null as any
      };

      try {
        // Check business
        const business = await Business.getById(provider.businessId);
        providerDebug.business = {
          id: business.id,
          name: business.name,
          timezone: business.timeZone
        };

        // Check calendar settings
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(
          provider.id, 
          provider.businessId
        );
        
        if (!calendarSettings) {
          providerDebug.error = 'No calendar settings found';
        } else {
          providerDebug.calendarSettings = {
            timezone: calendarSettings.settings?.timezone,
            bufferTime: calendarSettings.settings?.bufferTime,
            hasWorkingHours: Object.values(calendarSettings.workingHours).some(day => day !== null)
          };

          // Check current availability
          const today = DateTime.now().toFormat("yyyy-MM-dd");
          const future = DateTime.now().plus({ days: 30 }).toFormat("yyyy-MM-dd");
          const availability = await AvailabilitySlots.getByProviderAndDateRange(
            provider.id,
            today,
            future
          );
          providerDebug.currentAvailability = availability.length;
        }

      } catch (error) {
        providerDebug.error = error instanceof Error ? error.message : 'Unknown error';
        debugResults.errors.push({
          providerId: provider.id,
          error: providerDebug.error
        });
      }

      debugResults.providers.push(providerDebug);
    }

    // Step 3: Try to run the actual function
    console.log('[DEBUG] Testing rollAllProvidersAvailability...');
    await rollAllProvidersAvailability();
    
    debugResults.success = true;
    debugResults.message = 'Availability roll completed successfully';
    
    return NextResponse.json(debugResults);

  } catch (error) {
    console.error('[DEBUG] Error in availability roll:', error);
    debugResults.errors.push({
      type: 'rollAllProvidersAvailability',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    debugResults.message = 'Failed to roll availability';
    
    return NextResponse.json(debugResults, { status: 500 });
  }
} 