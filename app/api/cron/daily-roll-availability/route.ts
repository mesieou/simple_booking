import { NextResponse } from 'next/server';
import { rollAllProvidersAvailability } from '@/lib/general-helpers/availability';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedAuthHeader = `Bearer ${process.env.CRON_SECRET}`;

  // --- SAFE DEBUGGING LOGS ---
  console.log(`[CRON-AUTH] Received auth header length: ${authHeader?.length || 0}`);
  console.log(`[CRON-AUTH] Expected auth header length: ${expectedAuthHeader?.length || 0}`);
  const receivedSecret = authHeader?.substring(7);
  const expectedSecret = process.env.CRON_SECRET;
  console.log(`[CRON-AUTH] Received secret length: ${receivedSecret?.length || 0}`);
  console.log(`[CRON-AUTH] Expected secret length: ${expectedSecret?.length || 0}`);
  console.log(`[CRON-AUTH] Do secrets match? ${receivedSecret === expectedSecret}`);
  // --- END DEBUGGING LOGS ---

  if (authHeader !== expectedAuthHeader) {
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