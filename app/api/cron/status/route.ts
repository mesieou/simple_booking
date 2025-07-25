import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint helps check if the cron job is working
  // without needing authentication and without actually running the cron
  
  const now = new Date();
  const utcTime = now.toISOString();
  const melbourneTime = now.toLocaleString('en-AU', { 
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Calculate next 14:00 UTC (when cron should run - midnight Melbourne time)
  const nextCronRun = new Date();
  const currentHour = nextCronRun.getUTCHours();
  
  // If it's already past 14:00 UTC today, schedule for tomorrow
  if (currentHour >= 14) {
    nextCronRun.setUTCDate(nextCronRun.getUTCDate() + 1);
  }
  nextCronRun.setUTCHours(14, 0, 0, 0);
  
  const nextCronMelbourne = nextCronRun.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
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
      melbourne: melbourneTime
    },
    nextScheduledRun: {
      utc: nextCronRun.toISOString(),
      melbourne: nextCronMelbourne,
      description: 'Next cron job will run at 14:00 UTC (midnight Melbourne time)'
    },
    cronSchedule: '0 14 * * * (daily at 14:00 UTC - midnight Melbourne)',
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