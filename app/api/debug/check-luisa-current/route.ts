import { NextResponse } from 'next/server';
import { User } from '@/lib/database/models/user';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';

export async function GET() {
  try {
    const allProviders = await User.getAllProviders();
    const luisa = allProviders.find(p => 
      p.firstName === 'Luisa' && p.lastName === 'Bernal'
    );
    
    if (!luisa) {
      return NextResponse.json({ error: 'Luisa not found' });
    }
    
    const availability = await AvailabilitySlots.getByProviderAndDateRange(
      luisa.id,
      '2025-01-01',
      '2025-12-31'
    );
    
    availability.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return NextResponse.json({
      luisaId: luisa.id,
      totalDays: availability.length,
      dateRange: {
        first: availability[0]?.date,
        last: availability[availability.length - 1]?.date
      },
      allDates: availability.map(a => a.date)
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
} 