import { DateTime } from "luxon";
import { AvailabilitySlots } from "../../database/models/availability-slots";
import { DURATION_INTERVALS } from "./helpers";

/**
 * Update aggregated availability for a specific day after a booking
 * Reduces provider counts for time slots that overlap with the new booking
 */
export async function updateDayAggregatedAvailability(
  businessId: string,
  date: Date,
  bookingDateTime: string,
  serviceDurationMinutes: number,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<AvailabilitySlots | null> {
  try {
    // Get existing availability for this business and date
    const existingAvailability = await AvailabilitySlots.getByBusinessAndDate(
      businessId, 
      date.toISOString().split('T')[0],
      options
    );
    
    if (!existingAvailability) {
      console.log(`[updateDayAggregatedAvailability] No existing availability found for ${date.toISOString().split('T')[0]}`);
      return null;
    }

    // Create a new availability object to modify
    const updatedAvailability = new AvailabilitySlots(existingAvailability);
    
    // Calculate which time slots are affected by this booking
    const bookingStart = DateTime.fromISO(bookingDateTime);
    const bookingEnd = bookingStart.plus({ minutes: serviceDurationMinutes });
    
    console.log(`[updateDayAggregatedAvailability] Booking: ${bookingStart.toFormat('HH:mm')} - ${bookingEnd.toFormat('HH:mm')} (${serviceDurationMinutes} min)`);
    
    // For each duration interval, check which slots overlap with the booking
    let slotsAffected = 0;
    for (const duration of DURATION_INTERVALS) {
      const durationKey = duration.toString();
      const slots = updatedAvailability.slots[durationKey] || [];
      
      for (let i = 0; i < slots.length; i++) {
        const [slotTime, providerCount] = slots[i];
        const slotStart = DateTime.fromISO(`${date.toISOString().split('T')[0]}T${slotTime}`);
        const slotEnd = slotStart.plus({ minutes: duration });
        
        // Check if this slot overlaps with the booking
        if (slotStart.toMillis() < bookingEnd.toMillis() && slotEnd.toMillis() > bookingStart.toMillis()) {
          console.log(`[updateDayAggregatedAvailability] Reducing providers for ${durationKey}min slot at ${slotTime} from ${providerCount} to ${providerCount - 1}`);
          
          if (providerCount > 1) {
            slots[i] = [slotTime, providerCount - 1]; // Decrease provider count
          } else {
            slots.splice(i, 1); // Remove slot if no providers left
            i--; // Adjust index after removal
          }
          slotsAffected++;
        }
      }
    }
    
    console.log(`[updateDayAggregatedAvailability] Updated ${slotsAffected} slot intervals`);
    
    // Update the database with the new availability
    const updateData = {
      businessId: updatedAvailability.businessId,
      date: updatedAvailability.date,
      slots: updatedAvailability.slots
    };
    
    return await AvailabilitySlots.update(
      businessId,
      date.toISOString().split('T')[0],
      updateData,
      options
    );
    
  } catch (error) {
    console.error('[updateDayAggregatedAvailability] Error updating availability:', error);
    throw error;
  }
} 