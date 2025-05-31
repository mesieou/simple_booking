import { NextRequest, NextResponse } from 'next/server';
import { fetchDirectGoogleMapsDistance, DistanceApiResponse, DistanceApiError } from '@/lib/general-helpers/google-distance-calculator';

export async function GET(request: NextRequest): Promise<NextResponse<DistanceApiResponse | DistanceApiError>> {
  const { searchParams } = new URL(request.url);
  const origen = searchParams.get('origen');
  const destino = searchParams.get('destino');

  if (!origen || !destino) {
    return NextResponse.json(
      { error: 'Se requieren los parámetros origen y destino' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchDirectGoogleMapsDistance(origen, destino);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/maps/mapsdistance:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
} 