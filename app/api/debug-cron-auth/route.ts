import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // For security, only show partial values
  const authHeaderPartial = authHeader ? authHeader.substring(0, 20) + '...' : 'null';
  const cronSecretPartial = cronSecret ? cronSecret.substring(0, 20) + '...' : 'null';
  const expectedHeader = cronSecret ? `Bearer ${cronSecret}`.substring(0, 20) + '...' : 'null';
  
  return NextResponse.json({
    debug: {
      authHeaderReceived: authHeaderPartial,
      cronSecretInEnv: cronSecretPartial,
      expectedHeader: expectedHeader,
      authHeaderExists: !!authHeader,
      cronSecretExists: !!cronSecret,
      exactMatch: authHeader === `Bearer ${cronSecret}`,
      authHeaderLength: authHeader?.length || 0,
      expectedLength: cronSecret ? `Bearer ${cronSecret}`.length : 0,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    },
    message: "Debug endpoint - check auth header vs environment variable"
  });
} 