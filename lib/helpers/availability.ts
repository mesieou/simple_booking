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
            const bookingEnd = bookingDateTime.plus({ minutes: bookingQuote.totalDuration });
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

  // Calculate available slots for the quote duration
  const quoteDuration = quote.totalDuration;
  let slotStart = workStart;
  const times: string[] = [];

  while (slotStart.plus({ minutes: quoteDuration }).toMillis() <= workEnd.toMillis()) {
    const slotEnd = slotStart.plus({ minutes: quoteDuration });
    const slotStartUTC = slotStart.toUTC();
    const slotEndUTC = slotEnd.toUTC();

    // Check if this slot overlaps with any existing bookings
    const overlaps = bookingQuotes.some(
      ({ booking, quote: bookingQuote }: { booking: Booking; quote: Quote }) => {
        const bookingDateTime = DateTime.fromISO(booking.dateTime);
        const bookingEnd = bookingDateTime.plus({ minutes: bookingQuote.totalDuration });
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

  // Update the existing availability record
  if (times.length > 0) {
    existingAvailabilityData.slots[quoteDuration.toString()] = times;
    return await AvailabilitySlots.update(
      user.id,
      dateInProviderTZ.toFormat("yyyy-MM-dd"),
      existingAvailabilityData
    );
  } else {
    // If no slots available for this duration, remove it from the record
    delete existingAvailabilityData.slots[quoteDuration.toString()];
    if (Object.keys(existingAvailabilityData.slots).length === 0) {
      await AvailabilitySlots.delete(
        user.id,
        dateInProviderTZ.toFormat("yyyy-MM-dd")
      );
      return null;
    }
    return await AvailabilitySlots.update(
      user.id,
      dateInProviderTZ.toFormat("yyyy-MM-dd"),
      existingAvailabilityData
    );
  }
}

// Original function for computing availability with a specific quote
export async function computeAvailability(
  user: User,
  existingBookings: Booking[],
  fromDate: Date,
  days: number,
  business: Business,
  quote: Quote
): Promise<AvailabilitySlots[]> {
  const slots: AvailabilitySlots[] = [];

  // Fetch all quotes for the existing bookings
  const bookingQuotes = await Promise.all(
    existingBookings.map(async (booking: Booking) => {
      const quote = await Quote.getById(booking.quoteId);
      return { booking, quote };
    })
  );

  for (let i = 0; i < days; i++) {
    const quoteDurationMinutes = quote.totalDuration;
    const date = new Date(fromDate);
    date.setDate(date.getDate() + i);

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

    let slotStart = workStart;
    const availableTimes: string[] = [];

    while (slotStart.plus({ minutes: quoteDurationMinutes }).toMillis() <= workEnd.toMillis()) {
      const slotEnd = slotStart.plus({ minutes: quoteDurationMinutes });
      const slotStartUTC = slotStart.toUTC();
      const slotEndUTC = slotEnd.toUTC();

      const overlaps = bookingQuotes.some(
        ({ booking, quote: bookingQuote }: { booking: Booking; quote: Quote }) => {
          const bookingDateTime = DateTime.fromISO(booking.dateTime);
          const bookingEnd = bookingDateTime.plus({ minutes: bookingQuote.totalDuration });
          const bookingEndWithBuffer = bookingEnd.plus({ minutes: bufferTime });
          
          // A slot overlaps if:
          // 1. It starts before the booking ends (including buffer)
          // 2. It ends after the booking starts
          return slotStartUTC.toMillis() < bookingEndWithBuffer.toMillis() && 
                 slotEndUTC.toMillis() > bookingDateTime.toMillis();
        }
      );

      if (!overlaps) {
        availableTimes.push(slotStart.toFormat("HH:mm"));
      }

      slotStart = slotStart.plus({ minutes: 30 });
    }

    if (availableTimes.length > 0) {
      slots.push(new AvailabilitySlots({
        providerId: user.id,
        date: dateInProviderTZ.toFormat("yyyy-MM-dd"),
        slots: {
          [quoteDurationMinutes.toString()]: availableTimes
        }
      }));
    }
  }

  return slots;
}
