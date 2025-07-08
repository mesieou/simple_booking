import { NextRequest, NextResponse } from 'next/server';
import { createRemovalistTestBusiness } from '@/lib/database/seed/create-removalist-test-business';

export async function POST(req: NextRequest) {
  try {
    console.log('🚚 Starting removalist business seed via API...');
    
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
        whatsappNumber: '+61 411 851 098',
        testMessage: 'Try asking about removalist services to test per-minute pricing quotes!'
      }
    });
    
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
    warning: '⚠️  This will create a FAKE business for development testing only',
    whatsappNumber: '+61 411 851 098'
  });
} 