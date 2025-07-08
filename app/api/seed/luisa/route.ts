import { NextRequest, NextResponse } from 'next/server';
import { createLuisaTestBusiness } from '@/lib/database/seed/create-luisa-test-business';

export async function POST(req: NextRequest) {
  try {
    console.log('💄 Starting Luisa business seed via API...');
    
    const result = await createLuisaTestBusiness();
    
    return NextResponse.json({
      success: true,
      message: '✅ Luisa business seed completed successfully!',
      data: {
        businessId: result.businessId,
        ownerProviderId: result.ownerProviderId,
        serviceCount: result.serviceIds.length,
        calendarSettingsId: result.calendarSettingsId,
        documentCount: result.documentIds.length
      },
      instructions: {
        whatsappNumber: '+61 411 851 098',
        testMessage: 'Try asking about beauty services to test fixed pricing quotes!'
      }
    });
    
  } catch (error) {
    console.error('❌ Luisa seed failed:', error);
    
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      fullError: error
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run Luisa business seed',
    warning: '💄 This will create Beauty Asiul business for development testing',
    whatsappNumber: '+61 411 851 098'
  });
} 