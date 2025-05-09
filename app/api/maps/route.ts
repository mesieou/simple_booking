import { NextRequest, NextResponse } from 'next/server';

interface DistanceApiResponse {
  status: string;
  rows: {
    elements: {
      status: string;
      distance: { text: string; value: number };
      duration: { text: string };
      duration_in_traffic: { text: string };
    }[];
  }[];
  origin_addresses: string[];
  destination_addresses: string[];
}

interface DistanceApiError {
  error: string;
}

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
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    // Crear una fecha para hoy a las 5 PM
    const today = new Date();
    today.setHours(17, 0, 0, 0); // 5 PM
    const departureTime = Math.floor(today.getTime() / 1000); // Convertir a timestamp Unix

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origen)}&destinations=${encodeURIComponent(destino)}&key=${apiKey}&mode=driving&departure_time=${departureTime}&traffic_model=pessimistic`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_message || 'Error al obtener la distancia');
    }

    if (data.status !== 'OK') {
      throw new Error(data.error_message || 'Error en la respuesta de la API');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error en distance matrix:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
} 