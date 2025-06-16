import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint helps check if the cron job is working
  // without needing authentication and without actually running the cron
  
  const now = new Date();
  const utcTime = now.toISOString();
  const sydneyTime = now.toLocaleString('en-AU', { 
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Calculate next midnight UTC (when cron should run)
  const nextMidnightUTC = new Date();
  nextMidnightUTC.setUTCDate(nextMidnightUTC.getUTCDate() + 1);
  nextMidnightUTC.setUTCHours(0, 0, 0, 0);
  
  const nextMidnightSydney = nextMidnightUTC.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return NextResponse.json({
    status: 'healthy',
    message: 'Cron job endpoint is accessible',
    currentTime: {
      utc: utcTime,
      sydney: sydneyTime
    },
    nextScheduledRun: {
      utc: nextMidnightUTC.toISOString(),
      sydney: nextMidnightSydney,
      description: 'Next cron job will run at 00:00 UTC (10:00 AM Sydney time)'
    },
    cronSchedule: '0 0 * * * (daily at midnight UTC)',
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasCronSecret: !!process.env.CRON_SECRET,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    instructions: {
      testCron: 'Use: curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/daily-roll-availability',
      checkProvider: 'Use: /api/debug/test-availability-roll?providerId=YOUR_ID'
    }
  });
} 