import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { Business } from '@/lib/database/models/business';
import { rollAvailability } from '@/lib/general-helpers/availability';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';
import { DateTime } from 'luxon';

export async function POST() {
  try {
    console.log('[TEST] Testing FIXED rollover logic...');
    
    const allProviders = await User.getAllProviders();
    const luisa = allProviders.find(p => 
      p.firstName === 'Luisa' && p.lastName === 'Bernal'
    );
    
    if (!luisa) {
      return NextResponse.json({ error: 'Luisa not found' }, { status: 404 });
    }
    
    const business = await Business.getById(luisa.businessId);
    
    // Check availability BEFORE
    const beforeAvailability = await AvailabilitySlots.getByProviderAndDateRange(
      luisa.id,
      '2025-01-01',
      '2025-12-31'
    );
    
    console.log(`[TEST] BEFORE rollover: ${beforeAvailability.length} days`);
    console.log(`[TEST] Date range BEFORE: ${beforeAvailability[0]?.date} to ${beforeAvailability[beforeAvailability.length - 1]?.date}`);
    
    // Test the FIXED rollover
    await rollAvailability(luisa, business);
    
    // Check availability AFTER
    const afterAvailability = await AvailabilitySlots.getByProviderAndDateRange(
      luisa.id,
      '2025-01-01',
      '2025-12-31'
    );
    
    console.log(`[TEST] AFTER rollover: ${afterAvailability.length} days`);
    console.log(`[TEST] Date range AFTER: ${afterAvailability[0]?.date} to ${afterAvailability[afterAvailability.length - 1]?.date}`);
    
    // Calculate what should have been deleted
    const today = DateTime.now().setZone(business.timeZone);
    const sevenDaysAgo = today.minus({ days: 7 });
    
    return NextResponse.json({
      success: true,
      message: 'Fixed rollover test completed',
      today: today.toISODate(),
      sevenDaysAgo: sevenDaysAgo.toISODate(),
      before: {
        days: beforeAvailability.length,
        firstDate: beforeAvailability[0]?.date,
        lastDate: beforeAvailability[beforeAvailability.length - 1]?.date
      },
      after: {
        days: afterAvailability.length,
        firstDate: afterAvailability[0]?.date,
        lastDate: afterAvailability[afterAvailability.length - 1]?.date
      }
    });

  } catch (error) {
    console.error('[TEST] Error testing fixed rollover:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test fixed rollover',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 