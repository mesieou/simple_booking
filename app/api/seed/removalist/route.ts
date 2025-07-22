import { NextRequest, NextResponse } from 'next/server';
import { createRemovalistTestBusiness, createRemovalistBusinessForProduction } from '@/lib/database/seed/create-removalist-test-business';

export async function POST(req: NextRequest) {
  try {
    // Check if this is a production request
    const body = await req.json().catch(() => ({}));
    const isProductionRequest = body.production === true;
    
    if (isProductionRequest) {
      console.log('🚚 Starting removalist business seed for PRODUCTION...');
      
      const result = await createRemovalistBusinessForProduction(body.businessConfig);
      
      return NextResponse.json({
        success: true,
        message: '✅ Timos Removals business created successfully in PRODUCTION!',
        data: {
          businessId: result.businessId,
          ownerProviderId: result.ownerProviderId,
          serviceCount: result.serviceIds.length,
          calendarSettingsId: result.calendarSettingsId,
          documentCount: result.documentIds.length
        },
        instructions: {
          whatsappNumber: '+61 466 502 512',
          testMessage: 'Try asking about removalist services to test per-minute pricing quotes!',
          environment: 'PRODUCTION'
        }
      });
    } else {
      console.log('🚚 Starting removalist business seed for DEVELOPMENT...');
      
      const result = await createRemovalistTestBusiness();
      
      return NextResponse.json({
        success: true,
        message: '✅ Removalist business seed completed successfully!',
        data: {
          businessId: result.businessId,
          ownerProviderId: result.ownerProviderId,
          serviceCount: result.serviceIds.length,
          calendarSettingsId: result.calendarSettingsId,
          documentCount: result.documentIds.length
        },
        instructions: {
          whatsappNumber: '+61 466 502 512',
          testMessage: 'Try asking about removalist services to test per-minute pricing quotes!',
          environment: 'DEVELOPMENT'
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      fullError: error
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run the removalist business seed',
    warning: '⚠️  Development: Creates a FAKE business for testing only',
    production: '✅ Production: Use POST with {"production": true} to create REAL business',
    whatsappNumber: '+61 466 502 512',
    examples: {
      development: 'POST {} (empty body)',
      production: 'POST {"production": true}',
      customConfig: 'POST {"production": true, "businessConfig": {"name": "Custom Name"}}'
    }
  });
} 