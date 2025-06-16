import { NextResponse } from 'next/server';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { DateTime } from 'luxon';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId') || '17302676-0dd3-43b0-b835-84c64f2f7b5c';

  try {
    // Get availability for a wide date range
    const startDate = DateTime.now().minus({ days: 5 }).toFormat('yyyy-MM-dd');
    const endDate = DateTime.now().plus({ days: 35 }).toFormat('yyyy-MM-dd');
    
    console.log(`[DEBUG-DATES] Checking dates for provider ${providerId} from ${startDate} to ${endDate}`);
    
    const availability = await AvailabilitySlots.getByProviderAndDateRange(
      providerId,
      startDate,
      endDate
    );

    // Sort by date
    const sortedAvailability = availability
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(slot => ({
        date: slot.date,
        dayOfWeek: DateTime.fromISO(slot.date).toFormat('ccc'),
        slotsCount: Object.keys(slot.slots).length
      }));

    // Calculate current timezone info
    const nowUTC = DateTime.now().setZone('UTC');
    const nowSydney = DateTime.now().setZone('Australia/Sydney');
    
    // Calculate what the 30-day window should be from today
    const todaySydney = nowSydney.startOf('day');
    const day30Sydney = todaySydney.plus({ days: 29 }); // 30 days including today
    
    return NextResponse.json({
      success: true,
      providerId,
      query: {
        startDate,
        endDate,
        totalDaysFound: availability.length
      },
      timezone: {
        nowUTC: nowUTC.toISO(),
        nowSydney: nowSydney.toISO(),
        todaySydney: todaySydney.toFormat('yyyy-MM-dd'),
        day30Sydney: day30Sydney.toFormat('yyyy-MM-dd'),
        expectedRange: `${todaySydney.toFormat('yyyy-MM-dd')} to ${day30Sydney.toFormat('yyyy-MM-dd')}`
      },
      availability: sortedAvailability,
      analysis: {
        firstDate: sortedAvailability[0]?.date,
        lastDate: sortedAvailability[sortedAvailability.length - 1]?.date,
        hasJuly15: sortedAvailability.some(slot => slot.date === '2025-07-15'),
        hasJuly16: sortedAvailability.some(slot => slot.date === '2025-07-16'),
        missingDates: getMissingDates(sortedAvailability, todaySydney, day30Sydney)
      }
    });

  } catch (error) {
    console.error('[DEBUG-DATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getMissingDates(availability: any[], startDate: DateTime, endDate: DateTime): string[] {
  const availableDates = new Set(availability.map(slot => slot.date));
  const missing: string[] = [];
  
  let current = startDate;
  while (current <= endDate) {
    const dateStr = current.toFormat('yyyy-MM-dd');
    if (!availableDates.has(dateStr)) {
      missing.push(dateStr);
    }
    current = current.plus({ days: 1 });
  }
  
  return missing;
} 