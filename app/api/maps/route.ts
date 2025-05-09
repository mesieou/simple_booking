import { NextRequest, NextResponse } from 'next/server';

interface DistanceApiResponse {
  status: string;
  rows: {
    elements: {
      status: string;
      distance: { text: string; value: number };
      duration: { text: string };
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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = "https://maps.googleapis.com/maps/api/distancematrix/json";

  if (!origen || !destino) {
    return NextResponse.json({ error: "Se deben proporcionar origen y destino." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API key no configurada." }, { status: 500 });
  }

  const params = new URLSearchParams({
    origins: origen,
    destinations: destino,
    mode: "driving",
    language: "es",
    units: "metric",
    key: apiKey,
  });

  try {
    const fullUrl = `${url}?${params.toString()}`;
    console.log('URL de la petición:', fullUrl);
    
    const response = await fetch(fullUrl);
    const responseText = await response.text();
    console.log('Respuesta del servidor:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data: DistanceApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error al parsear JSON:', parseError);
      throw new Error('Error al procesar la respuesta del servidor');
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching distance:", error.message);
    return NextResponse.json({ error: error.message || "Ocurrió un error al calcular la distancia." }, { status: 500 });
  }
} 