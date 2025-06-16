import { NextResponse } from 'next/server';
import { rollAvailability } from '@/lib/general-helpers/availability';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId');

  try {
    console.log('[DEBUG] Starting availability roll debug...');
    
    // Get all providers if no specific provider ID is provided
    const providers = providerId 
      ? [await User.getById(providerId)]
      : await User.getAllProviders();

    const results = [];
    
    for (const provider of providers.filter(Boolean)) {
      console.log(`[DEBUG] Checking provider: ${provider!.id}`);
      
      const result = {
        providerId: provider!.id,
        name: `${provider!.firstName} ${provider!.lastName}`,
        role: provider!.role,
        business: null as any,
        calendarSettings: null as any,
        currentAvailability: 0,
        error: null as string | null
      };

      try {
        // Get business
        const business = await Business.getById(provider!.businessId);
        if (!business) {
          result.error = 'Business not found';
          results.push(result);
          continue;
        }
        result.business = { name: business.name, timezone: business.timeZone };

        // Get calendar settings
        const calendarSettings = await CalendarSettings.getByUserAndBusiness(
          provider!.id,
          provider!.businessId
        );
        
        if (!calendarSettings) {
          result.error = 'No calendar settings found';
          results.push(result);
          continue;
        }
        
        result.calendarSettings = {
          timezone: calendarSettings.settings?.timezone,
          bufferTime: calendarSettings.settings?.bufferTime,
          workingDays: Object.keys(calendarSettings.workingHours).filter(
            day => calendarSettings.workingHours[day as keyof typeof calendarSettings.workingHours]
          )
        };

        // Count current availability days
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30);
        
        const currentAvailability = await AvailabilitySlots.getByProviderAndDateRange(
          provider!.id,
          today.toISOString().split('T')[0],
          futureDate.toISOString().split('T')[0]
        );
        
        result.currentAvailability = currentAvailability.length;

        // If this is the specific provider we're debugging, try to roll availability
        if (providerId === provider!.id) {
          console.log(`[DEBUG] Rolling availability for specific provider: ${provider!.id}`);
          await rollAvailability(provider!, business);
          
          // Check availability again after rolling
          const newAvailability = await AvailabilitySlots.getByProviderAndDateRange(
            provider!.id,
            today.toISOString().split('T')[0],
            futureDate.toISOString().split('T')[0]
          );
          
          result.currentAvailability = newAvailability.length;
        }

      } catch (error) {
        console.error(`[DEBUG] Error processing provider ${provider!.id}:`, error);
        result.error = error instanceof Error ? error.message : 'Unknown error';
      }

      results.push(result);
    }

    const errors = results.filter(r => r.error);
    const success = errors.length === 0;

    return NextResponse.json({
      success,
      message: success ? 'Debug completed successfully' : `Found ${errors.length} errors`,
      providers: results,
      errors: errors.map(r => ({ providerId: r.providerId, error: r.error }))
    });

  } catch (error) {
    console.error('[DEBUG] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      success: false, 
      message: 'Debug failed', 
      error: errorMessage 
    }, { status: 500 });
  }
} 