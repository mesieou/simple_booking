import { NextRequest, NextResponse } from 'next/server';
import { fetchDirectGoogleMapsDistance, DistanceApiResponse, DistanceApiError } from '@/lib/general-helpers/google-distance-calculator';

export async function GET(request: NextRequest): Promise<NextResponse<DistanceApiResponse | DistanceApiError>> {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get('origin');
  const destination = searchParams.get('destination');

  if (!origin || !destination) {
    return NextResponse.json(
      { error: 'The parameters origin and destination are required' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchDirectGoogleMapsDistance(origin, destination);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/maps/mapsdistance:', error);
    return NextResponse.json(
      { error: error.message || 'Error processing the request' },
      { status: 500 }
    );
  }
} 