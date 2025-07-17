import { CalendarSettings } from "../database/models/calendar-settings";
import { User } from "../database/models/user";
import { Booking } from "../database/models/booking";
import { AvailabilitySlots } from "../database/models/availability-slots";
import { DateTime } from "luxon";
import { Business } from "../database/models/business";
import { Quote } from "../database/models/quote";

// Standard duration intervals in minutes
const DURATION_INTERVALS = [60, 90, 120, 150, 180, 240, 300, 360]; // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h

// Helper function to generate availability slots for a single day
const generateDaySlots = (
  workStart: DateTime,
  workEnd: DateTime
): { [key: string]: string[] } => {
  const availableSlots: { [key: string]: string[] } = {};
  
  for (const duration of DURATION_INTERVALS) {
    let slotStart = workStart;
    const times: string[] = [];

    while (slotStart.plus({ minutes: duration }).toMillis() <= workEnd.toMillis()) {
      times.push(slotStart.toFormat("HH:mm"));
      slotStart = slotStart.plus({ minutes: 60 });
    }

    if (times.length > 0) {
      availableSlots[duration.toString()] = times;
    }
  }

  return availableSlots;
};

// Compute initial availability for a new provider
export async function computeInitialAvailability(
  user: User,
  fromDate: Date,
  days: number,
  business: Business,
  options?: { supabaseClient?: any }
): Promise<AvailabilitySlots[]> {
  const slots: AvailabilitySlots[] = [];

  // Fetch all existing bookings for the date range
  const existingBookings = await Booking.getByProviderAndDateRange(
    user.id,
    fromDate,
    new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000)
  );

  // Fetch all quotes for the existing bookings
  const bookingQuotes = await Promise.all(
    existingBookings.map(async (booking: Booking) => {
      const quote = await Quote.getById(booking.quoteId);
      return { booking, quote };
    })
  );

  for (let i = 0; i < days; i++) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + i);

    // Get calendar settings
    const calendarSettings = await CalendarSettings.getByUserAndBusiness(
      user.id,
      user.businessId,
      options
    );
    
    if (!calendarSettings) {
        throw new Error(`[computeInitialAvailability] Could not find calendar settings for provider ${user.id}`);
    }

    const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';
    const bufferTime = calendarSettings.settings?.bufferTime ?? 0;

    const dateInProviderTZ = DateTime.fromJSDate(date)
      .setZone(providerTZ, { keepLocalTime: true });

    const dayKey = dateInProviderTZ.toFormat("ccc").toLowerCase() as keyof CalendarSettings["workingHours"];
    const workingHours = calendarSettings.workingHours[dayKey];
    if (!workingHours) continue;

    const [startHour, startMin] = workingHours.start.split(":").map(Number);
    const [endHour, endMin] = workingHours.end.split(":").map(Number);

    const workStart = dateInProviderTZ.set({
      hour: startHour,
      minute: startMin,
      second: 0,
      millisecond: 0
    });
    
    const workEnd = dateInProviderTZ.set({
      hour: endHour,
      minute: endMin,
      second: 0,
      millisecond: 0
    });

    // Calculate available slots for each duration
    const availableSlots: { [key: string]: string[] } = {};
    
    for (const duration of DURATION_INTERVALS) {
      let slotStart = workStart;
      const times: string[] = [];

      // Generate slots for the entire day
      while (slotStart.plus({ minutes: duration }).toMillis() <= workEnd.toMillis()) {
        const slotEnd = slotStart.plus({ minutes: duration });
        const slotStartUTC = slotStart.toUTC();
        const slotEndUTC = slotEnd.toUTC();

        // Check if this slot overlaps with any existing bookings
        const overlaps = bookingQuotes.some(
          ({ booking, quote: bookingQuote }: { booking: Booking; quote: Quote }) => {
            const bookingDateTime = DateTime.fromISO(booking.dateTime);
            const bookingEnd = bookingDateTime.plus({ minutes: bookingQuote.totalJobDurationEstimation });
            const bookingEndWithBuffer = bookingEnd.plus({ minutes: bufferTime });
            
            // A slot overlaps if:
            // 1. It starts before the booking ends (including buffer)
            // 2. It ends after the booking starts
            return slotStartUTC.toMillis() < bookingEndWithBuffer.toMillis() && 
                   slotEndUTC.toMillis() > bookingDateTime.toMillis();
          }
        );

        if (!overlaps) {
          times.push(slotStart.toFormat("HH:mm"));
        }

        // Move to next slot
        slotStart = slotStart.plus({ minutes: 60 });
      }

      // Only add duration if there are available slots
      if (times.length > 0) {
        availableSlots[duration.toString()] = times;
      }
    }

    // Only add day if there are available slots
    if (Object.keys(availableSlots).length > 0) {
      slots.push(new AvailabilitySlots({
        providerId: user.id,
        date: dateInProviderTZ.toFormat("yyyy-MM-dd"),
        slots: availableSlots
      }));
    }
  }

  return slots;
}

// Update availability for a specific day after a booking
export async function updateDayAvailability(
  user: User,
  existingBookings: Booking[],
  date: Date,
  business: Business,
  quote: Quote
): Promise<AvailabilitySlots | null> {
  // Get calendar settings
  const calendarSettings = await CalendarSettings.getByUserAndBusiness(
    user.id,
    user.businessId
  );

  if (!calendarSettings) {
    // This should ideally not be hit if called from a valid booking context, but it's a safe-guard.
    throw new Error(`[updateDayAvailability] Could not find calendar settings for provider ${user.id}`);
  }

  const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';
  const bufferTime = calendarSettings.settings?.bufferTime ?? 0;

  const dateInProviderTZ = DateTime.fromJSDate(date)
    .setZone(providerTZ, { keepLocalTime: true });

  const dayKey = dateInProviderTZ.toFormat("ccc").toLowerCase() as keyof CalendarSettings["workingHours"];
  const workingHours = calendarSettings.workingHours[dayKey];
  if (!workingHours) return null;

  const [startHour, startMin] = workingHours.start.split(":").map(Number);
  const [endHour, endMin] = workingHours.end.split(":").map(Number);

  const workStart = dateInProviderTZ.set({
    hour: startHour,
    minute: startMin,
    second: 0,
    millisecond: 0
  });
  
  const workEnd = dateInProviderTZ.set({
    hour: endHour,
    minute: endMin,
    second: 0,
    millisecond: 0
  });

  // Consolidate the new booking with its quote, and fetch quotes for all other existing bookings
  const bookingQuotes = await Promise.all(
    existingBookings.map(async (booking: Booking) => {
      // If the booking in the list is the one that was just created, we already have the quote.
      if (booking.quoteId === quote.id) {
        return { booking, quote };
      }
      // Otherwise, fetch the quote for the other bookings.
      const bookingQuote = await Quote.getById(booking.quoteId);
      return { booking, quote: bookingQuote };
    })
  );

  // Get existing availability for this day
  const existingAvailabilityData = await AvailabilitySlots.getByProviderAndDate(
    user.id,
    dateInProviderTZ.toFormat("yyyy-MM-dd")
  );

  if (!existingAvailabilityData) {
    return null;
  }

  // Calculate available slots for all durations
  const updatedSlots: { [key: string]: string[] } = {};
  
  for (const duration of DURATION_INTERVALS) {
    let slotStart = workStart;
    const times: string[] = [];

    while (slotStart.plus({ minutes: duration }).toMillis() <= workEnd.toMillis()) {
      const slotEnd = slotStart.plus({ minutes: duration });
      const slotStartUTC = slotStart.toUTC();
      const slotEndUTC = slotEnd.toUTC();

      // Check if this slot overlaps with any existing bookings
      const overlaps = bookingQuotes.some(
        ({ booking, quote: bookingQuote }: { booking: Booking; quote: Quote | null }) => {
          if (!bookingQuote) return false; // Skip if a quote is missing for some reason
          
          const bookingDateTime = DateTime.fromISO(booking.dateTime, { zone: providerTZ });
          const bookingEnd = bookingDateTime.plus({ minutes: bookingQuote.totalJobDurationEstimation });
          const bookingEndWithBuffer = bookingEnd.plus({ minutes: bufferTime });

          return slotStartUTC.toMillis() < bookingEndWithBuffer.toMillis() && 
                 slotEndUTC.toMillis() > bookingDateTime.toMillis();
        }
      );

      if (!overlaps) {
        times.push(slotStart.toFormat("HH:mm"));
      }

      slotStart = slotStart.plus({ minutes: 60 });
    }

    // Only add duration if there are available slots
    if (times.length > 0) {
      updatedSlots[duration.toString()] = times;
    }
  }

  // Update the existing availability record
  if (Object.keys(updatedSlots).length > 0) {
    const updatedAvailability = new AvailabilitySlots({
      providerId: existingAvailabilityData.providerId,
      date: existingAvailabilityData.date,
      slots: updatedSlots
    });
    
    return await AvailabilitySlots.update(
      user.id,
      dateInProviderTZ.toFormat("yyyy-MM-dd"),
      updatedAvailability
    );
  } else {
    // If no slots available, delete the record
    await AvailabilitySlots.delete(
      user.id,
      dateInProviderTZ.toFormat("yyyy-MM-dd")
    );
    return null;
  }
}

// Optimized version of rollAvailability that reduces DB queries
export async function rollAvailabilityOptimized(
  user: User,
  business: Business,
  calendarSettings: CalendarSettings
): Promise<void> {
  const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';
  const today = DateTime.now().setZone(providerTZ);
  const todayStr = today.toFormat("yyyy-MM-dd");

  console.log(`[CRON-ROLLOVER] Provider: ${user.id} (${user.firstName} ${user.lastName}), Timezone: ${providerTZ}`);
  console.log(`[CRON-ROLLOVER] Today is ${today.toISODate()}. Rolling availability forward one day.`);

  // 1. Delete ALL past availability (< today) - this is safe since past slots are useless
  await AvailabilitySlots.deleteBefore(user.id, todayStr);

  // 2. Check if we need to add the NEW day (today + 30)
  const newDay = today.plus({ days: 30 });
  const newDayStr = newDay.toFormat("yyyy-MM-dd");
  const dayKey = newDay.toFormat("ccc").toLowerCase() as keyof CalendarSettings["workingHours"];
  const workingHours = calendarSettings.workingHours[dayKey];

  console.log(`[CRON-ROLLOVER] Checking if need to add availability for ${newDayStr} (${dayKey})`);

  // 3. Only add the new day if provider works on that day and it doesn't already exist
  if (workingHours) {
    const existingAvailability = await AvailabilitySlots.getByProviderAndDate(user.id, newDayStr);
    
    if (!existingAvailability) {
      const [startHour, startMin] = workingHours.start.split(":").map(Number);
      const [endHour, endMin] = workingHours.end.split(":").map(Number);

      const workStart = newDay.set({
        hour: startHour,
        minute: startMin,
        second: 0,
        millisecond: 0
      });
      
      const workEnd = newDay.set({
        hour: endHour,
        minute: endMin,
        second: 0,
        millisecond: 0
      });

      const availableSlots = generateDaySlots(workStart, workEnd);

      // Create the new availability slot for just this one day
      if (Object.keys(availableSlots).length > 0) {
        const newAvailabilitySlot = new AvailabilitySlots({
          providerId: user.id,
          date: newDayStr,
          slots: availableSlots
        });
        
        await newAvailabilitySlot.add({ useServiceRole: true });
        console.log(`[CRON-ROLLOVER] Added availability for ${newDayStr} (${dayKey})`);
      }
    } else {
      console.log(`[CRON-ROLLOVER] Availability for ${newDayStr} already exists, skipping`);
    }
  } else {
    console.log(`[CRON-ROLLOVER] Provider doesn't work on ${dayKey}, skipping ${newDayStr}`);
  }

  console.log(`[CRON-ROLLOVER] Completed availability roll for provider ${user.id}.`);
}

// Roll availability forward by maintaining a window of today + 30 days
export async function rollAvailability(
  user: User,
  business: Business
): Promise<void> {
  // Get calendar settings for this specific provider
  const calendarSettings = await CalendarSettings.getByUserAndBusiness(
    user.id,
    user.businessId
  );

  // This should not happen if called from the coordinator, but safety check
  if (!calendarSettings) {
    throw new Error(`[rollAvailability] No calendar settings found for provider ${user.id}`);
  }

  const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';
  const today = DateTime.now().setZone(providerTZ);
  const todayStr = today.toFormat("yyyy-MM-dd");

  console.log(`[CRON-ROLLOVER] Provider: ${user.id} (${user.firstName} ${user.lastName}), Timezone: ${providerTZ}`);
  console.log(`[CRON-ROLLOVER] Today is ${today.toISODate()}. Cleaning up past availability and ensuring 30-day window.`);
  console.log(`[CRON-ROLLOVER] Business ID: ${user.businessId}`);

  // 1. Delete ALL past availability (< today) - this is safe since past slots are useless
  await AvailabilitySlots.deleteBefore(user.id, todayStr);

  // 2. Ensure we have 30 days of availability from today
  let daysAdded = 0;
  let currentDay = today;
  
  for (let i = 0; i < 30; i++) {
    const dayStr = currentDay.toFormat("yyyy-MM-dd");
    const dayKey = currentDay.toFormat("ccc").toLowerCase() as keyof CalendarSettings["workingHours"];
    const workingHours = calendarSettings.workingHours[dayKey];
    
    // Skip if provider doesn't work on this day
    if (!workingHours) {
      currentDay = currentDay.plus({ days: 1 });
      continue;
    }

    // Check if availability already exists for this day
    const existingAvailability = await AvailabilitySlots.getByProviderAndDate(user.id, dayStr);
    
    // Add availability if it doesn't exist for this working day
    if (!existingAvailability) {
      const [startHour, startMin] = workingHours.start.split(":").map(Number);
      const [endHour, endMin] = workingHours.end.split(":").map(Number);

      const workStart = currentDay.set({
        hour: startHour,
        minute: startMin,
        second: 0,
        millisecond: 0
      });
      
      const workEnd = currentDay.set({
        hour: endHour,
        minute: endMin,
        second: 0,
        millisecond: 0
      });

      const availableSlots = generateDaySlots(workStart, workEnd);

      // Create and save the new availability
      if (Object.keys(availableSlots).length > 0) {
        const newAvailabilitySlot = new AvailabilitySlots({
          providerId: user.id,
          date: dayStr,
          slots: availableSlots
        });
        
        await newAvailabilitySlot.add({ useServiceRole: true });
        daysAdded++;
        console.log(`[CRON-ROLLOVER] Added availability for ${dayStr} (${dayKey})`);
      }
    }

    currentDay = currentDay.plus({ days: 1 });
  }

  console.log(`[CRON-ROLLOVER] Completed availability roll for provider ${user.id}. Added ${daysAdded} new days.`);
}

// NEW FUNCTIONS FOR CHATBOT DATE/TIME SUGGESTION (Added [Current Date])

/**
 * Rounds a duration in minutes up to the nearest 30-minute interval.
 * @param duration The duration in minutes.
 * @returns The duration rounded up to the nearest 30 minutes.
 */
const roundDurationUpTo30 = (duration: number): number => {
  if (duration <= 0) return 0;
  return Math.ceil(duration / 30) * 30;
};

/**
 * Finds a list of suggested available dates for a given job duration.
 * NOTE: This is a SKELETON IMPLEMENTATION with DUMMY DATA.
 * TODO: Implement full logic as per requirements.
 */
export async function findAvailableDates(
  providerId: string,
  businessId: string,
  jobDurationMinutes: number,
  startDate: Date,
  numberOfDatesToSuggest: number = 5,
  searchRangeInDays: number = 60
): Promise<string[]> {
  console.log("findAvailableDates - TODO: Implement actual logic");
  
  // TODO: Replace with actual implementation that:
  // 1. Gets provider's calendar settings and timezone
  // 2. Fetches actual availability slots from database
  // 3. Filters by job duration requirements
  // 4. Returns real available dates
  
  return ["2024-01-15", "2024-01-16", "2024-01-17"]; // Dummy data
}

/**
 * Gets available time slots for a specific date and job duration.
 * NOTE: This is a SKELETON IMPLEMENTATION with DUMMY DATA.
 * TODO: Implement full logic as per requirements.
 */
export async function getSlotsForDate(
  providerId: string,
  businessId: string,
  jobDurationMinutes: number,
  targetDateISO: string
): Promise<string[]> {
  console.log("getSlotsForDate - TODO: Implement actual logic");
  
  // TODO: Replace with actual implementation that:
  // 1. Gets availability slots for the specific date
  // 2. Filters by job duration requirements
  // 3. Returns actual available time slots
  
  return ["09:00", "10:30", "14:00"]; // Dummy data
}