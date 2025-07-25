import { NextRequest, NextResponse } from 'next/server';
import { productionErrorTracker } from '@/lib/general-helpers/error-handling/production-error-tracker';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId') || undefined;

    const stats = await productionErrorTracker.getStats(businessId);

    return NextResponse.json(stats);

  } catch (error) {
    console.error('[ErrorStatsAPI] Failed to fetch error stats:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch error statistics' },
      { status: 500 }
    );
  }
} 