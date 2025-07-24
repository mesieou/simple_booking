import { AvailabilitySlots } from "../../database/models/availability-slots";
import { CalendarSettings } from "../../database/models/calendar-settings";
import { DURATION_INTERVALS, computeAggregatedAvailability } from "./helpers";

/**
 * Update ALL existing availability slots when business provider count changes
 * This is different from daily rollover - this updates provider counts across ALL existing days
 */
export async function updateBusinessProviderCount(
  businessId: string,
  oldProviderCount: number,
  newProviderCount: number,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  try {
    console.log(`[updateBusinessProviderCount] Updating provider count for business ${businessId}: ${oldProviderCount} → ${newProviderCount}`);
    
    const providerDifference = newProviderCount - oldProviderCount;
    
    if (providerDifference === 0) {
      console.log(`[updateBusinessProviderCount] No change in provider count, skipping update`);
      return;
    }
    
    // Get ALL existing availability slots for this business
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 30); // Get next 30 days of slots
    
    const existingSlots = await AvailabilitySlots.getByBusinessAndDateRange(
      businessId,
      today.toISOString().split('T')[0],
      futureDate.toISOString().split('T')[0]
    );
    
    console.log(`[updateBusinessProviderCount] Found ${existingSlots.length} existing availability slots to update`);
    
    if (existingSlots.length === 0) {
      console.log(`[updateBusinessProviderCount] No existing slots found, nothing to update`);
      return;
    }
    
    // Update each slot
    let updatedSlotsCount = 0;
    let removedSlotsCount = 0;
    
    for (const slot of existingSlots) {
      const updatedSlotData = updateSlotProviderCounts(slot.slots, providerDifference);
      
      // Check if slot has any availability left
      const hasAvailability = Object.values(updatedSlotData).some(
        timeSlots => Array.isArray(timeSlots) && timeSlots.length > 0
      );
      
      if (hasAvailability) {
        // Update the slot with new provider counts
        await AvailabilitySlots.update(
          businessId,
          slot.date,
          {
            businessId: slot.businessId,
            date: slot.date,
            slots: updatedSlotData
          },
          options
        );
        updatedSlotsCount++;
        console.log(`[updateBusinessProviderCount] Updated slot for ${slot.date}`);
      } else {
        // Remove the entire slot if no providers are available
        await AvailabilitySlots.delete(businessId, slot.date, options);
        removedSlotsCount++;
        console.log(`[updateBusinessProviderCount] Removed slot for ${slot.date} (no providers available)`);
      }
    }
    
    console.log(`[updateBusinessProviderCount] Completed: ${updatedSlotsCount} slots updated, ${removedSlotsCount} slots removed`);
    
  } catch (error) {
    console.error(`[updateBusinessProviderCount] Error updating provider count for business ${businessId}:`, error);
    throw error;
  }
}

/**
 * Update provider counts in a slot's time intervals
 */
function updateSlotProviderCounts(
  slots: { [key: string]: Array<[string, number]> },
  providerDifference: number
): { [key: string]: Array<[string, number]> } {
  const updatedSlots: { [key: string]: Array<[string, number]> } = {};
  
  for (const duration of DURATION_INTERVALS) {
    const durationKey = duration.toString();
    const timeSlots = slots[durationKey] || [];
    const updatedTimeSlots: Array<[string, number]> = [];
    
    for (const [time, currentProviderCount] of timeSlots) {
      const newProviderCount = currentProviderCount + providerDifference;
      
      // Only keep slots with at least 1 provider available
      if (newProviderCount > 0) {
        updatedTimeSlots.push([time, newProviderCount]);
      }
      // If newProviderCount <= 0, we skip adding this time slot (effectively removing it)
    }
    
    // Only include duration if it has available time slots
    if (updatedTimeSlots.length > 0) {
      updatedSlots[durationKey] = updatedTimeSlots;
    }
  }
  
  return updatedSlots;
}

/**
 * Regenerate ALL availability slots for a business from scratch
 * Use this when you want to completely recalculate based on current provider settings
 */
export async function regenerateAllBusinessAvailability(
  businessId: string,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  try {
    console.log(`[regenerateAllBusinessAvailability] Regenerating all availability for business ${businessId}`);
    
    // Get provider settings to determine current provider count
    const providerSettings = await CalendarSettings.getByBusiness(businessId, options);
    
    console.log(`[regenerateAllBusinessAvailability] Found ${providerSettings.length} providers in CalendarSettings`);
    console.log(`[regenerateAllBusinessAvailability] Provider IDs:`, providerSettings.map(p => p.userId));
    
    if (providerSettings.length === 0) {
      console.log(`[regenerateAllBusinessAvailability] No providers found, skipping availability generation`);
      return;
    }
    
    // Delete ALL existing availability slots for this business
    console.log(`[regenerateAllBusinessAvailability] Deleting all existing slots for business`);
    
    // Get a wide date range to capture all existing slots
    const currentDate = new Date();
    const pastDate = new Date();
    pastDate.setDate(currentDate.getDate() - 30); // 30 days ago
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + 60); // 60 days ahead
    
    const existingSlots = await AvailabilitySlots.getByBusinessAndDateRange(
      businessId,
      pastDate.toISOString().split('T')[0],
      futureDate.toISOString().split('T')[0]
    );
    console.log(`[regenerateAllBusinessAvailability] Found ${existingSlots.length} existing slots to delete`);
    
    // Delete in smaller batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < existingSlots.length; i += batchSize) {
      const batch = existingSlots.slice(i, i + batchSize);
      console.log(`[regenerateAllBusinessAvailability] Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(existingSlots.length/batchSize)} (${batch.length} slots)`);
      
      await Promise.all(batch.map(async (slot) => {
        try {
          await AvailabilitySlots.delete(businessId, slot.date, options);
        } catch (error) {
          console.error(`[regenerateAllBusinessAvailability] Error deleting slot ${slot.date}:`, error);
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < existingSlots.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Longer wait for database commits to complete
    console.log(`[regenerateAllBusinessAvailability] All slots deleted, waiting 3 seconds for DB commit...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate new availability with current provider count
    console.log(`[regenerateAllBusinessAvailability] Generating new availability with ${providerSettings.length} providers`);
    const today = new Date();
    const newSlots = await computeAggregatedAvailability(
      businessId,
      today,
      30, // Generate 30 days
      options
    );
    
    console.log(`[regenerateAllBusinessAvailability] Generated ${newSlots.length} new availability slots`);
    
    // Save new slots with robust duplicate handling
    let successCount = 0;
    let skipCount = 0;
    
    for (const slot of newSlots) {
      try {
        await slot.add(options);
        successCount++;
        if (successCount % 5 === 0) {
          console.log(`[regenerateAllBusinessAvailability] ✅ Created ${successCount}/${newSlots.length} slots`);
        }
      } catch (error) {
        // Check for duplicate constraint violations at multiple levels
        let isDuplicate = false;
        let errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check raw error message
        if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
          isDuplicate = true;
        }
        
        // Check if it's a ModelError with wrapped database error
        if (error && typeof error === 'object' && 'originalError' in error) {
          const originalError = (error as any).originalError;
          if (originalError && typeof originalError === 'object') {
            const originalMessage = originalError.message || '';
            if (originalMessage.includes('duplicate key') || originalMessage.includes('already exists')) {
              isDuplicate = true;
            }
          }
        }
        
        if (isDuplicate) {
          skipCount++;
          console.log(`[regenerateAllBusinessAvailability] ⚠️ Skipped duplicate slot for ${slot.date} (${skipCount} total skipped)`);
        } else {
          console.error(`[regenerateAllBusinessAvailability] ❌ Failed to create slot for ${slot.date}:`, error);
          // Don't throw - continue with other slots
        }
      }
    }
    
    console.log(`[regenerateAllBusinessAvailability] ✅ Completed: ${successCount} created, ${skipCount} skipped, ${newSlots.length - successCount - skipCount} failed`);
    
    // Consider it successful if most slots were created
    if (successCount > newSlots.length * 0.8) {
      console.log(`[regenerateAllBusinessAvailability] ✅ Successfully regenerated availability (${successCount}/${newSlots.length} slots)`);
    } else {
      console.warn(`[regenerateAllBusinessAvailability] ⚠️ Partial success: only ${successCount}/${newSlots.length} slots created`);
    }

  } catch (error) {
    console.error(`[regenerateAllBusinessAvailability] Error regenerating availability for business ${businessId}:`, error);
    // Don't throw - let the provider creation succeed even if availability fails
    // Availability can be fixed later by the daily cron job
  }
} 