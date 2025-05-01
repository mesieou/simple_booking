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

  const params = new URLSearchParams({
    origins: origen,
    destinations: destino,
    mode: "driving",
    language: "es",
    units: "metric",
    key: apiKey as string,
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: DistanceApiResponse = await response.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching distance:", error.message);
    return NextResponse.json({ error: "Ocurrió un error al calcular la distancia." }, { status: 500 });
  }
}