import { DateTime } from "luxon";
import { AvailabilitySlots } from "../../database/models/availability-slots";
import { CalendarSettings } from "../../database/models/calendar-settings";
import { computeDayAggregatedAvailability } from "./helpers";
import { User } from "../../database/models/user";
import { Business } from "../../database/models/business";

/**
 * Roll availability for a single provider (backward compatibility)
 * This function maintains compatibility with existing tests
 */
export async function rollAvailability(
  provider: User,
  business: Business,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  if (!business.id) {
    console.error(`[rollAvailability] Business ID is required`);
    return;
  }

  try {
    console.log(`[rollAvailability] Rolling availability for provider ${provider.id} in business ${business.id}`);
    
    // For now, just delegate to the business-level rollover
    // This ensures the aggregated availability is updated correctly
    await rollAggregatedAvailability(business.id, options);
    
    console.log(`[rollAvailability] Completed for provider ${provider.id}`);
  } catch (error) {
    console.error(`[rollAvailability] Error for provider ${provider.id}:`, error);
    throw error;
  }
}

/**
 * Roll aggregated availability for a business (all providers)
 * Daily cron job to maintain 30-day availability window
 */
export async function rollAggregatedAvailability(
  businessId: string,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  try {
    console.log(`[rollAggregatedAvailability] Rolling availability for business ${businessId}`);
    
    // Get all provider settings for this business
    const providerSettings = await CalendarSettings.getByBusiness(businessId, options);
    
    if (providerSettings.length === 0) {
      console.log(`[rollAggregatedAvailability] No providers found for business ${businessId}`);
      return;
    }

    const firstProvider = providerSettings[0];
    if (!firstProvider?.settings?.timezone) {
      console.error(`[rollAggregatedAvailability] No timezone found for business ${businessId}`);
      return;
    }
    
    const businessTimezone = firstProvider.settings.timezone; // Use first provider's timezone
    const today = DateTime.now().setZone(businessTimezone);
    const todayStr = today.toFormat("yyyy-MM-dd");
    
    console.log(`[rollAggregatedAvailability] Business timezone: ${businessTimezone}, today: ${todayStr}`);
    
    // 1. Delete past availability
    await AvailabilitySlots.deleteBefore(businessId, todayStr, options);
    
    // 2. Ensure complete 30-day availability window exists (today through today+30)
    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const targetDay = today.plus({ days: dayOffset });
      const targetDayStr = targetDay.toFormat("yyyy-MM-dd");
      
      // Check if we already have availability for this day
      const existingAvailability = await AvailabilitySlots.getByBusinessAndDate(businessId, targetDayStr, options);
      
      if (!existingAvailability) {
        const dayAvailability = await computeDayAggregatedAvailability(
          businessId,
          targetDay.toJSDate(),
          providerSettings,
          [], // No existing bookings for future day (will be fetched inside computeDayAggregatedAvailability)
          options
        );
        
        if (dayAvailability) {
          await dayAvailability.add(options);
          console.log(`[rollAggregatedAvailability] Added availability for ${targetDayStr}`);
        } else {
          console.log(`[rollAggregatedAvailability] No providers work on ${targetDayStr}`);
        }
      }
    }
    
    console.log(`[rollAggregatedAvailability] Completed for business ${businessId}`);
    
  } catch (error) {
    console.error(`[rollAggregatedAvailability] Error for business ${businessId}:`, error);
    throw error;
  }
} 