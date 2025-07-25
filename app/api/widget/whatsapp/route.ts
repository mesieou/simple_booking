import { NextRequest, NextResponse } from 'next/server';
import { Business } from '@/lib/database/models/business';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // Get business by ID
    let business;
    try {
      business = await Business.getById(businessId);
    } catch (error) {
      console.error('[Widget API] Business not found:', businessId);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }
    
    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Return only the data needed for the widget
    return NextResponse.json({
      businessName: business.name,
      whatsappNumber: business.whatsappNumber,
      success: true
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('[Widget API] Error fetching business data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enable CORS for widget embedding
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 