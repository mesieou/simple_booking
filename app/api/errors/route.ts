import { NextRequest, NextResponse } from 'next/server';
import { productionErrorTracker } from '@/lib/general-helpers/error-handling/production-error-tracker';
import { ErrorLevel } from '@/lib/database/models/error-log';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.errorLevel || !body.errorType || !body.errorMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: errorLevel, errorType, errorMessage' },
        { status: 400 }
      );
    }

    // Validate error level
    if (!['error', 'warn', 'critical'].includes(body.errorLevel)) {
      return NextResponse.json(
        { error: 'Invalid errorLevel. Must be: error, warn, or critical' },
        { status: 400 }
      );
    }

    // Extract context from request if not provided
    const context = {
      userId: body.userId,
      businessId: body.businessId,
      chatSessionId: body.chatSessionId,
      url: body.url || req.url,
      method: body.method || req.method,
      userAgent: body.userAgent || req.headers.get('user-agent') || undefined,
      ipAddress: getClientIP(req),
      requestBody: body.requestBody,
      queryParams: body.queryParams,
      additionalContext: body.additionalContext
    };

    // Log the error using our error tracking system
    await productionErrorTracker.logError(
      body.errorLevel as ErrorLevel,
      body.errorType,
      body.errorMessage,
      context
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Error logged successfully' 
    });

  } catch (error) {
    console.error('[ErrorAPI] Failed to log error:', error);
    
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    );
  }
}

/**
 * Get recent errors (for dashboard)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const level = searchParams.get('level') as ErrorLevel | null;
    const resolved = searchParams.get('resolved') === 'true' ? true : 
                    searchParams.get('resolved') === 'false' ? false : undefined;
    const businessId = searchParams.get('businessId') || undefined;

    const result = await productionErrorTracker.getRecentErrors({
      limit: Math.min(limit, 100), // Cap at 100
      offset,
      level: level || undefined,
      resolved,
      businessId
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[ErrorAPI] Failed to fetch errors:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch errors' },
      { status: 500 }
    );
  }
}

/**
 * Helper to extract client IP
 */
const getClientIP = (req: NextRequest): string | undefined => {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const xRealIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIp) {
    return xRealIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  return undefined;
}; 