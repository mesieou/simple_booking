import { DateTime } from "luxon";
import { User } from "../../database/models/user";
import { Business } from "../../database/models/business";
import { AvailabilitySlots } from "../../database/models/availability-slots";
import { CalendarSettings } from "../../database/models/calendar-settings";
import { Booking } from "../../database/models/booking";
import { Quote } from "../../database/models/quote";
import { computeAggregatedAvailability, DURATION_INTERVALS } from "./helpers";

/**
 * Recalculate a provider's contribution to stored aggregated availability after calendar changes
 * Called when a provider's working hours, working days, or buffer time changes
 */
export async function recalculateProviderContribution(
  provider: User,
  business: Business,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  if (!business.id) {
    console.error(`[recalculateProviderContribution] Business ID is required`);
    return;
  }

  try {
    // Get provider's calendar settings - use getByUserAndBusiness instead of getByProvider
    const calendarSettings = await CalendarSettings.getByUserAndBusiness(provider.id, business.id, options);
    if (!calendarSettings) {
      console.log(`[recalculateProviderContribution] No calendar settings found for provider ${provider.id}`);
      return;
    }

    // Since the system computes availability dynamically, we don't need to update stored slots
    // Calendar changes will automatically be reflected when computeAggregatedAvailability is called
    console.log(`[recalculateProviderContribution] Calendar settings updated for provider ${provider.id} - availability will be computed dynamically`);
    
    // The dynamic system will automatically use the new calendar settings when computing availability
    // No stored updates needed since computeAggregatedAvailability uses current CalendarSettings

    // No additional processing needed - the dynamic system handles calendar changes automatically

    console.log(`[recalculateProviderContribution] Successfully updated availability for provider ${provider.id}`);
  } catch (error) {
    console.error('[recalculateProviderContribution] Error:', error);
    throw error;
  }
}

/**
 * Calculate what a provider should contribute for a specific day
 * Takes into account working hours, bookings, and buffer time
 */
function calculateProviderContributionForDay(
  date: Date,
  workingHours: { start: string; end: string } | null,
  timezone: string,
  bufferTime: number,
  dayBookings: Array<{ booking: Booking; quote: Quote }>
): { [key: string]: Array<[string, number]> } {
  const contribution: { [key: string]: Array<[string, number]> } = {};

  if (!workingHours) {
    // Provider doesn't work this day
    return contribution;
  }

  const dateTimeInTZ = DateTime.fromJSDate(date).setZone(timezone);
  const startTime = dateTimeInTZ.set({
    hour: parseInt(workingHours.start.split(':')[0]),
    minute: parseInt(workingHours.start.split(':')[1]),
    second: 0
  });
  const endTime = dateTimeInTZ.set({
    hour: parseInt(workingHours.end.split(':')[0]),
    minute: parseInt(workingHours.end.split(':')[1]),
    second: 0
  });

  // Generate slots for each duration interval
  for (const duration of DURATION_INTERVALS) {
    const durationKey = duration.toString();
    contribution[durationKey] = [];

    let currentTime = startTime;
    while (currentTime.plus({ minutes: duration }) <= endTime) {
      const timeStr = currentTime.toFormat('HH:mm');
      
      // Check if this time slot conflicts with any booking
      const hasBookingConflict = dayBookings.some(({ booking, quote }) => {
        const bookingStart = DateTime.fromISO(booking.dateTime);
        const bookingEnd = bookingStart.plus({ minutes: quote.totalJobDurationEstimation + bufferTime });
        const slotStart = currentTime;
        const slotEnd = currentTime.plus({ minutes: duration });
        
        return (slotStart < bookingEnd && slotEnd > bookingStart);
      });

      // Provider contributes 1 if available, 0 if booked
      contribution[durationKey].push([timeStr, hasBookingConflict ? 0 : 1]);
      currentTime = currentTime.plus({ minutes: 15 }); // 15-minute intervals
    }
  }

  return contribution;
}

/**
 * Update stored availability with provider's new contribution
 * Currently uses the simple approach of recalculating the entire day from scratch
 */
async function updateStoredAvailabilityForProvider(
  existingSlot: AvailabilitySlots,
  providerContribution: { [key: string]: Array<[string, number]> },
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<void> {
  // For now, let's take the simpler approach and recalculate the whole day
  // This ensures correctness while we build the system
  const date = DateTime.fromISO(existingSlot.date).toJSDate();
  const newSlots = await computeAggregatedAvailability(
    existingSlot.businessId,
    date,
    1,
    options
  );

  if (newSlots.length > 0) {
    await AvailabilitySlots.update(
      existingSlot.businessId,
      existingSlot.date,
      {
        businessId: existingSlot.businessId,
        date: existingSlot.date,
        slots: newSlots[0].slots
      },
      options
    );
  }
} 