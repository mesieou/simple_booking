import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('[TEST-ENV] NODE_ENV:', process.env.NODE_ENV);
    console.log('[TEST-ENV] Total env vars:', Object.keys(process.env).length);
    
    const stripeVars = Object.keys(process.env).filter(key => key.startsWith('STRIPE'));
    const nextVars = Object.keys(process.env).filter(key => key.startsWith('NEXT'));
    
    return NextResponse.json({
      success: true,
      nodeEnv: process.env.NODE_ENV,
      totalEnvVars: Object.keys(process.env).length,
      stripeVars: stripeVars,
      nextVars: nextVars,
      stripeSecretKeyExists: !!process.env.STRIPE_SECRET_KEY,
      stripeSecretKeyLength: process.env.STRIPE_SECRET_KEY?.length || 0,
      stripeSecretKeyPreview: process.env.STRIPE_SECRET_KEY?.substring(0, 15) + '...' || 'NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[TEST-ENV] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 