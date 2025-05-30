import { CalendarSettings } from "./../models/calendar-settings";
import { User } from "../models/user";
import { Booking } from "../models/booking";
import { AvailabilitySlots } from "../models/availability-slots";
import { DateTime } from "luxon";
import { Business } from "../models/business";
import { Quote } from "../models/quote";

// Standard duration intervals in minutes
const DURATION_INTERVALS = [60, 90, 120, 150, 180, 240, 300, 360]; // 1h, 1.5h, 2h, 2.5h, 3h, 4h, 5h, 6h

// Compute initial availability for a new provider
export async function computeInitialAvailability(
  user: User,
  fromDate: Date,
  days: number,
  business: Business
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
      user.businessId
    );

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
        slotStart = slotStart.plus({ minutes: 30 });
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

  // Fetch all quotes for the existing bookings
  const bookingQuotes = await Promise.all(
    existingBookings.map(async (booking: Booking) => {
      const quote = await Quote.getById(booking.quoteId);
      return { booking, quote };
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

      slotStart = slotStart.plus({ minutes: 30 });
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

// Roll availability forward by adding one day and removing the first day
export async function rollAvailability(
  user: User,
  business: Business
): Promise<void> {
  // Get calendar settings to determine provider's timezone
  const calendarSettings = await CalendarSettings.getByUserAndBusiness(
    user.id,
    user.businessId
  );
  const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';

  // Calculate dates in provider's timezone
  const today = DateTime.now().setZone(providerTZ);
  const yesterday = today.minus({ days: 1 });
  const day30 = today.plus({ days: 30 });

  // Delete yesterday's availability (oldest day)
  await AvailabilitySlots.delete(
    user.id,
    yesterday.toFormat("yyyy-MM-dd")
  );

  // Create new availability for day 30
  const newAvailability = await computeInitialAvailability(
    user,
    day30.toJSDate(),
    1,
    business
  );

  // Add the new availability
  if (newAvailability.length > 0) {
    await newAvailability[0].add();
  }
}

// Roll availability forward for all providers
export async function rollAllProvidersAvailability(): Promise<void> {
  // Get all providers
  const providers = await User.getAllProviders();
  
  // Roll availability for each provider
  for (const provider of providers) {
    try {
      const business = await Business.getById(provider.businessId);
      if (!business) {
        console.error(`Business not found for provider ${provider.id}`);
        continue;
      }
      
      await rollAvailability(provider, business);
    } catch (error) {
      console.error(`Failed to roll availability for provider ${provider.id}:`, error);
      // Continue with next provider even if one fails
      continue;
    }
  }
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
  console.log("findAvailableDates called (dummy implementation)", { providerId, businessId, jobDurationMinutes, startDate: startDate.toISOString(), numberOfDatesToSuggest, searchRangeInDays });
  const roundedJobDuration = roundDurationUpTo30(jobDurationMinutes);
  console.log(`Rounded job duration for availability check: ${roundedJobDuration} minutes`);

  const suggestedDates: string[] = [];
  let currentSearchDate = DateTime.fromJSDate(startDate);

  // Dummy logic: Suggest next 5 days, skipping weekends for slight realism
  while (suggestedDates.length < numberOfDatesToSuggest && searchRangeInDays > 0) {
    // Skip weekends (Saturday: 6, Sunday: 7 in Luxon)
    if (currentSearchDate.weekday !== 6 && currentSearchDate.weekday !== 7) {
      suggestedDates.push(currentSearchDate.toFormat("yyyy-MM-dd"));
    }
    currentSearchDate = currentSearchDate.plus({ days: 1 });
    searchRangeInDays--; // Decrement to avoid infinite loop if no dates are found
  }
  
  // If not enough dates found by skipping weekends, fill with subsequent days
  while (suggestedDates.length < numberOfDatesToSuggest && searchRangeInDays > 0) {
     // Ensure currentSearchDate is not already added if the previous loop exited early
    if (currentSearchDate.weekday !== 6 && currentSearchDate.weekday !== 7 && !suggestedDates.includes(currentSearchDate.toFormat("yyyy-MM-dd"))) {
        suggestedDates.push(currentSearchDate.toFormat("yyyy-MM-dd"));
    } else if (currentSearchDate.weekday === 6 || currentSearchDate.weekday === 7) {
        // if it is a weekend, and we still need to fill, we search for next non-weekend
         while(currentSearchDate.weekday === 6 || currentSearchDate.weekday === 7) {
            currentSearchDate = currentSearchDate.plus({ days: 1 });
            searchRangeInDays--;
         }
         if (searchRangeInDays > 0 && !suggestedDates.includes(currentSearchDate.toFormat("yyyy-MM-dd"))) {
            suggestedDates.push(currentSearchDate.toFormat("yyyy-MM-dd"));
         }
    }
    if (suggestedDates.length >= numberOfDatesToSuggest) break;
    currentSearchDate = currentSearchDate.plus({ days: 1 });
    searchRangeInDays--;
  }


  console.log("findAvailableDates (dummy) returning:", suggestedDates);
  return suggestedDates;
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
  targetDateISO: string // Expecting "yyyy-MM-dd"
): Promise<string[]> {
  console.log("getSlotsForDate called (dummy implementation)", { providerId, businessId, jobDurationMinutes, targetDateISO });
  const roundedJobDuration = roundDurationUpTo30(jobDurationMinutes);
  console.log(`Rounded job duration for slot check: ${roundedJobDuration} minutes`);

  const targetDate = DateTime.fromISO(targetDateISO);
  if (!targetDate.isValid) {
    console.error(`getSlotsForDate: Invalid targetDateISO: ${targetDateISO}`);
    return [];
  }

  // Dummy slots, e.g., 9:00, 10:30, 14:00 for any roundedJobDuration
  const availableSlots: string[] = ["09:00", "10:30", "14:00"]; 
  
  // More advanced dummy slots based on a 9-5 day with 30-min intervals
  // const availableSlots: string[] = [];
  // let slot = targetDate.set({ hour: 9, minute: 0});
  // const endOfDay = targetDate.set({ hour: 17, minute: 0});
  // while(slot.plus({minutes: roundedJobDuration}) <= endOfDay) {
  //   availableSlots.push(slot.toFormat("HH:mm"));
  //   slot = slot.plus({ minutes: 30 }); // Check every 30 mins
  //   if(slot.hour === 12 || slot.hour === 13) slot = slot.set({hour: 14, minute: 0}); // Skip lunch
  // }

  console.log("getSlotsForDate (dummy) returning for", targetDateISO, ":", availableSlots);
  return availableSlots;
}
