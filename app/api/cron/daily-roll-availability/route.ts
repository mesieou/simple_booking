import { NextResponse } from 'next/server';
import { rollAllProvidersAvailability } from '@/lib/general-helpers/availability';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  try {
    console.log('[CRON] Starting daily roll of provider availability...');
    await rollAllProvidersAvailability();
    console.log('[CRON] Successfully rolled availability for all providers.');
    return NextResponse.json({ success: true, message: 'Availability rolled for all providers.' });
  } catch (error) {
    console.error('[CRON] Error rolling availability:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, message: 'Failed to roll availability.', error: errorMessage }, { status: 500 });
  }
} 