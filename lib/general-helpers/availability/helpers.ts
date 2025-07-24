import { CalendarSettings } from "../../database/models/calendar-settings";
import { User } from "../../database/models/user";
import { Booking } from "../../database/models/booking";
import { AvailabilitySlots } from "../../database/models/availability-slots";
import { DateTime } from "luxon";
import { Business } from "../../database/models/business";
import { Quote } from "../../database/models/quote";

// Standard duration intervals in minutes
export const DURATION_INTERVALS = [60, 90, 120, 150, 180, 240, 300, 360]; // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h

// Helper function to generate aggregated availability slots for multiple providers
export const generateAggregatedDaySlots = (
  providerSchedules: Array<{ workStart: DateTime; workEnd: DateTime }>
): { [key: string]: Array<[string, number]> } => {
  const aggregatedSlots: { [key: string]: Array<[string, number]> } = {};
  
  for (const duration of DURATION_INTERVALS) {
    const timeSlotCounts = new Map<string, number>();
    
    // For each provider, generate their time slots
    for (const { workStart, workEnd } of providerSchedules) {
      let slotStart = workStart;
      
      while (slotStart.plus({ minutes: duration }).toMillis() <= workEnd.toMillis()) {
        const timeSlot = slotStart.toFormat("HH:mm");
        timeSlotCounts.set(timeSlot, (timeSlotCounts.get(timeSlot) || 0) + 1);
        slotStart = slotStart.plus({ minutes: 60 });
      }
    }
    
    // Convert map to array of [time, count] tuples, sorted by time
    if (timeSlotCounts.size > 0) {
      aggregatedSlots[duration.toString()] = Array.from(timeSlotCounts.entries())
        .sort(([timeA], [timeB]) => timeA.localeCompare(timeB));
    }
  }

  return aggregatedSlots;
};

// Compute aggregated availability for a business based on all providers
export async function computeAggregatedAvailability(
  businessId: string,
  fromDate: Date,
  days: number,
  options?: { useServiceRole?: boolean; supabaseClient?: any }
): Promise<AvailabilitySlots[]> {
  const slots: AvailabilitySlots[] = [];

  // Get all provider calendar settings for the business
  const providerSettings = await CalendarSettings.getByBusiness(businessId, options);
  
  if (providerSettings.length === 0) {
    console.log(`[computeAggregatedAvailability] No providers found for business ${businessId}`);
    return [];
  }

  console.log(`[computeAggregatedAvailability] Found ${providerSettings.length} providers for business ${businessId}`);

  // Get all existing bookings for all providers in the date range
  // Use full day boundaries to ensure we capture all bookings regardless of timezone
  const startOfPeriod = new Date(fromDate);
  startOfPeriod.setHours(0, 0, 0, 0); // Start of day
  
  const endOfPeriod = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
  endOfPeriod.setHours(23, 59, 59, 999); // End of day
  
  const allBookings: Booking[] = [];
  for (const providerSetting of providerSettings) {
    const providerBookings = await Booking.getByProviderAndDateRange(
      providerSetting.providerId,
      startOfPeriod,
      endOfPeriod,
      options
    );
    allBookings.push(...providerBookings);
  }

  // Fetch quotes for all bookings
  const bookingQuotes = await Promise.all(
    allBookings.map(async (booking: Booking) => {
      const quote = await Quote.getById(booking.quoteId);
      return { booking, quote };
    })
  );

  for (let i = 0; i < days; i++) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    console.log(`[computeAggregatedAvailability] Processing day ${i + 1}/${days}: ${dateStr}`);
    
    const aggregatedAvailability = await computeDayAggregatedAvailability(
      businessId,
      date,
      providerSettings,
      bookingQuotes,
      options
    );
    
    if (aggregatedAvailability && Object.keys(aggregatedAvailability.slots).length > 0) {
      const slotCount = Object.keys(aggregatedAvailability.slots).reduce((total, duration) => {
        return total + aggregatedAvailability.slots[duration].length;
      }, 0);
      console.log(`[computeAggregatedAvailability] ✅ Day ${dateStr}: Generated ${slotCount} time slots across ${Object.keys(aggregatedAvailability.slots).length} duration intervals`);
      
      // Log detailed slot information
      for (const [duration, timeSlots] of Object.entries(aggregatedAvailability.slots)) {
        const slotTimes = timeSlots.map(([time, count]) => `${time}(${count})`).join(', ');
        console.log(`[computeAggregatedAvailability]   ${duration}min slots: ${slotTimes}`);
      }
      
      slots.push(aggregatedAvailability);
    } else {
      console.log(`[computeAggregatedAvailability] ❌ Day ${dateStr}: No available slots (no providers working or all booked)`);
    }
  }

  return slots;
}

// Compute aggregated availability for a single day
export async function computeDayAggregatedAvailability(
  businessId: string,
  date: Date,
  providerSettings?: CalendarSettings[],
  existingBookingQuotes?: Array<{ booking: Booking; quote: Quote }>,
  options?: { supabaseClient?: any }
): Promise<AvailabilitySlots | null> {
  // Get provider settings if not provided
  if (!providerSettings) {
    providerSettings = await CalendarSettings.getByBusiness(businessId, options);
  }
  
  if (providerSettings.length === 0) {
    return null;
  }

  const firstProvider = providerSettings[0];
  if (!firstProvider?.settings?.timezone) {
    console.error(`[computeBusinessAvailabilityForDate] No timezone found for business ${businessId}`);
    return null;
  }

  // Get bookings for this specific date if not provided
  if (!existingBookingQuotes) {
    const allBookings: Booking[] = [];
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 1);
    
    for (const providerSetting of providerSettings) {
      const providerBookings = await Booking.getByProviderAndDateRange(
        providerSetting.providerId,
        date,
        endDate
      );
      allBookings.push(...providerBookings);
    }

    existingBookingQuotes = await Promise.all(
      allBookings.map(async (booking: Booking) => {
        const quote = await Quote.getById(booking.quoteId);
        return { booking, quote };
      })
    );
  }

  const dateInTimezone = DateTime.fromJSDate(date).setZone(
    firstProvider.settings.timezone, // Use first provider's timezone as reference
    { keepLocalTime: true }
  );

  const dayKey = dateInTimezone.toFormat("ccc").toLowerCase() as keyof CalendarSettings["workingHours"];
  console.log(`[computeDayAggregatedAvailability] ${dateInTimezone.toFormat('yyyy-MM-dd (cccc)')}: Checking ${providerSettings.length} providers for availability`);
  
  // Collect working schedules for all providers on this day
  const providerSchedules: Array<{ workStart: DateTime; workEnd: DateTime; providerId: string }> = [];
  
  for (const providerSetting of providerSettings) {
    const workingHours = providerSetting.workingHours[dayKey];
    if (!workingHours) {
      console.log(`[computeDayAggregatedAvailability]   Provider ${providerSetting.providerId}: Not working on ${dayKey}`);
      continue; // Provider doesn't work on this day
    }

    const [startHour, startMin] = workingHours.start.split(":").map(Number);
    const [endHour, endMin] = workingHours.end.split(":").map(Number);

    const workStart = dateInTimezone.set({
      hour: startHour,
      minute: startMin,
      second: 0,
      millisecond: 0
    });
    
    const workEnd = dateInTimezone.set({
      hour: endHour,
      minute: endMin,
      second: 0,
      millisecond: 0
    });

    console.log(`[computeDayAggregatedAvailability]   Provider ${providerSetting.providerId}: Working ${workStart.toFormat('HH:mm')} - ${workEnd.toFormat('HH:mm')}`);
    providerSchedules.push({ workStart, workEnd, providerId: providerSetting.providerId });
  }

  if (providerSchedules.length === 0) {
    console.log(`[computeDayAggregatedAvailability]   No providers working on ${dayKey}, skipping day`);
    return null; // No providers work on this day
  }

  // Generate aggregated base availability
  console.log(`[computeDayAggregatedAvailability]   Generating base slots for ${providerSchedules.length} working providers...`);
  const baseSlots = generateAggregatedDaySlots(
    providerSchedules.map(({ workStart, workEnd }) => ({ workStart, workEnd }))
  );
  
  // Log base slot summary
  const baseSlotsCount = Object.keys(baseSlots).reduce((total, duration) => {
    return total + baseSlots[duration].length;
  }, 0);
  console.log(`[computeDayAggregatedAvailability]   Generated ${baseSlotsCount} base time slots before booking conflicts`);
  
  // Log existing bookings for this day
  const dayBookings = existingBookingQuotes.filter(({ booking }) => {
    const bookingDate = DateTime.fromISO(booking.dateTime).toFormat('yyyy-MM-dd');
    return bookingDate === dateInTimezone.toFormat('yyyy-MM-dd');
  });
  
  if (dayBookings.length > 0) {
    console.log(`[computeDayAggregatedAvailability]   Found ${dayBookings.length} existing bookings for this day:`);
    dayBookings.forEach(({ booking, quote }) => {
      const bookingStart = DateTime.fromISO(booking.dateTime);
      const bookingEnd = bookingStart.plus({ minutes: quote.totalJobDurationEstimation });
      console.log(`[computeDayAggregatedAvailability]     - Provider ${booking.providerId}: ${bookingStart.toFormat('HH:mm')}-${bookingEnd.toFormat('HH:mm')} (${quote.totalJobDurationEstimation}min)`);
    });
  } else {
    console.log(`[computeDayAggregatedAvailability]   No existing bookings for this day`);
  }

  // Apply booking conflicts - reduce provider counts
  console.log(`[computeDayAggregatedAvailability]   Adjusting slots for booking conflicts...`);
  const adjustedSlots: { [key: string]: Array<[string, number]> } = {};
  
  for (const duration of DURATION_INTERVALS) {
    const durationKey = duration.toString();
    const baseTimeslots = baseSlots[durationKey] || [];
    const adjustedTimeslots: Array<[string, number]> = [];
    
    for (const [timeSlot, baseCount] of baseTimeslots) {
      let availableCount = baseCount;
      
      // Track which providers are busy during this time slot (not how many bookings)
      const busyProviders = new Set<string>();
      
      for (const { booking, quote } of existingBookingQuotes) {
        if (!quote) continue;
        
        const bookingDateTime = DateTime.fromISO(booking.dateTime);
        const bookingEnd = bookingDateTime.plus({ minutes: quote.totalJobDurationEstimation });
        const bufferTime = providerSettings.find(p => p.providerId === booking.providerId)?.settings?.bufferTime || 0;
        const bookingEndWithBuffer = bookingEnd.plus({ minutes: bufferTime });
        
        // Create the slot datetime for comparison
        const slotStart = DateTime.fromISO(`${dateInTimezone.toISODate()}T${timeSlot}`, { 
          zone: firstProvider.settings.timezone 
        });
        const slotEnd = slotStart.plus({ minutes: duration });
        
        // Check if this booking overlaps with the slot
        const hasOverlap = slotStart.toMillis() < bookingEndWithBuffer.toMillis() && 
                          slotEnd.toMillis() > bookingDateTime.toMillis();
        
        if (hasOverlap) {
          // Mark this provider as busy (multiple bookings from same provider = still just 1 busy provider)
          busyProviders.add(booking.providerId);
        }
      }
      
      // Reduce available count by number of unique busy providers
      availableCount -= busyProviders.size;
      
      // Only include slots with available providers
      if (availableCount > 0) {
        adjustedTimeslots.push([timeSlot, availableCount]);
      }
    }
    
    if (adjustedTimeslots.length > 0) {
      adjustedSlots[durationKey] = adjustedTimeslots;
    }
  }

  if (Object.keys(adjustedSlots).length === 0) {
    console.log(`[computeDayAggregatedAvailability]   No available slots after applying booking conflicts`);
    return null; // No available slots
  }

  // Log final results
  const finalSlotsCount = Object.keys(adjustedSlots).reduce((total, duration) => {
    return total + adjustedSlots[duration].length;
  }, 0);
  console.log(`[computeDayAggregatedAvailability]   Final result: ${finalSlotsCount} available slots after conflicts`);
  
  // Log final slot details
  for (const [duration, timeSlots] of Object.entries(adjustedSlots)) {
    const slotTimes = timeSlots.map(([time, count]) => `${time}(${count})`).join(', ');
    console.log(`[computeDayAggregatedAvailability]     ${duration}min: ${slotTimes}`);
  }

  return new AvailabilitySlots({
    businessId: businessId,
    date: dateInTimezone.toFormat("yyyy-MM-dd"),
    slots: adjustedSlots
  });
}

// Utility functions for future chatbot functionality

/**
 * Rounds a duration in minutes up to the nearest 30-minute interval.
 */
export const roundDurationUpTo30 = (duration: number): number => {
  if (duration <= 0) return 0;
  return Math.ceil(duration / 30) * 30;
}; 