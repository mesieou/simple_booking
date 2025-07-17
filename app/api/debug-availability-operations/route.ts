import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { CalendarSettings } from '@/lib/database/models/calendar-settings';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { DateTime } from 'luxon';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const luisaId = 'f324a93f-8e0f-4595-9432-779da8d2d0a3';
  const results: any = {
    providerId: luisaId,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: Get User
    console.log('Testing User.getById...');
    results.tests.getUser = await testOperation(async () => {
      const user = await User.getById(luisaId);
      return { success: true, data: user ? { id: user.id, firstName: user.firstName, role: user.role } : null };
    });

    if (!results.tests.getUser.success) {
      return NextResponse.json(results);
    }

    const user = await User.getById(luisaId);

    // Test 2: Get Business  
    console.log('Testing Business.getById...');
    results.tests.getBusiness = await testOperation(async () => {
      const business = await Business.getById(user.businessId);
      return { success: true, data: business ? { id: business.id, name: business.name } : null };
    });

    // Test 3: Get Calendar Settings
    console.log('Testing CalendarSettings.getByUserAndBusiness...');
    results.tests.getCalendarSettings = await testOperation(async () => {
      const settings = await CalendarSettings.getByUserAndBusiness(user.id, user.businessId);
      return { 
        success: true, 
        data: settings ? { 
          timezone: settings.settings?.timezone, 
          hasWorkingHours: !!settings.workingHours 
        } : null 
      };
    });

    if (!results.tests.getCalendarSettings.success || !results.tests.getCalendarSettings.data) {
      return NextResponse.json(results);
    }

    const calendarSettings = await CalendarSettings.getByUserAndBusiness(user.id, user.businessId);
    const providerTZ = calendarSettings.settings?.timezone ?? 'UTC';
    const today = DateTime.now().setZone(providerTZ);
    const todayStr = today.toFormat("yyyy-MM-dd");
    const newDay = today.plus({ days: 30 });
    const newDayStr = newDay.toFormat("yyyy-MM-dd");

    results.dateInfo = {
      providerTZ,
      todayStr,
      newDayStr
    };

    // Test 4: Test deleteBefore (the problematic operation)
    console.log('Testing AvailabilitySlots.deleteBefore...');
    results.tests.deleteBefore = await testOperation(async () => {
      await AvailabilitySlots.deleteBefore(user.id, todayStr);
      return { success: true, message: 'Delete operation completed' };
    });

    // Test 5: Test getByProviderAndDate
    console.log('Testing AvailabilitySlots.getByProviderAndDate...');
    results.tests.getExistingAvailability = await testOperation(async () => {
      const existing = await AvailabilitySlots.getByProviderAndDate(user.id, newDayStr);
      return { success: true, exists: !!existing };
    });

    // Test 6: Test creating new availability slot
    console.log('Testing new AvailabilitySlots creation...');
    results.tests.createNewSlot = await testOperation(async () => {
      const testSlot = new AvailabilitySlots({
        providerId: user.id,
        date: newDayStr,
        slots: { "60": ["09:00", "10:00"] } // Simple test slot
      });
      await testSlot.add();
      return { success: true, message: 'New slot created successfully' };
    });

    return NextResponse.json(results);

  } catch (error) {
    results.globalError = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };
    return NextResponse.json(results, { status: 500 });
  }
}

async function testOperation(operation: () => Promise<any>) {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };
  }
} 