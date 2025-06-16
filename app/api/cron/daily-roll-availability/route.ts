import { NextResponse } from 'next/server';
import { rollAllProvidersAvailability } from '@/lib/general-helpers/availability';

// Simple in-memory log to track recent executions (survives across requests)
const recentExecutions: Array<{ 
  timestamp: string; 
  success: boolean; 
  duration: number; 
  error?: string;
  userAgent?: string;
  triggerType: 'cron' | 'manual';
}> = [];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  
  // Determine if this is automatic cron or manual trigger
  const triggerType = userAgent.includes('vercel-cron') ? 'cron' : 'manual';
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error(`[CRON-AUTH] Unauthorized access attempt. Trigger: ${triggerType}, User-Agent: ${userAgent}`);
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  const startTime = new Date();
  const executionId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[CRON-${executionId}] Starting daily roll of provider availability at ${startTime.toISOString()}...`);
    console.log(`[CRON-${executionId}] Trigger type: ${triggerType}`);
    console.log(`[CRON-${executionId}] User-Agent: ${userAgent}`);
    console.log(`[CRON-${executionId}] Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`[CRON-${executionId}] Environment: ${process.env.NODE_ENV}`);
    
    await rollAllProvidersAvailability();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`[CRON-${executionId}] ✅ Successfully rolled availability for all providers in ${duration}ms`);
    console.log(`[CRON-${executionId}] Completed at ${endTime.toISOString()}`);
    
    // Store execution info
    recentExecutions.unshift({
      timestamp: startTime.toISOString(),
      success: true,
      duration,
      triggerType
    });
    
    // Keep only last 10 executions
    if (recentExecutions.length > 10) {
      recentExecutions.splice(10);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Availability rolled for all providers.',
      executionId,
      executionTime: duration,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      triggerType,
      recentExecutions: recentExecutions.slice(0, 5) // Return last 5 for debugging
    });
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[CRON-${executionId}] ❌ Error rolling availability:`, error);
    console.error(`[CRON-${executionId}] Duration before error: ${duration}ms`);
    
    // Store execution info
    recentExecutions.unshift({
      timestamp: startTime.toISOString(),
      success: false,
      duration,
      error: errorMessage,
      triggerType
    });
    
    // Keep only last 10 executions
    if (recentExecutions.length > 10) {
      recentExecutions.splice(10);
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to roll availability.', 
      executionId,
      error: errorMessage,
      stack: errorStack,
      duration,
      triggerType,
      recentExecutions: recentExecutions.slice(0, 5) // Return last 5 for debugging
    }, { status: 500 });
  }
} 