import { NextRequest, NextResponse } from 'next/server';

interface GeocodeResponse {
  results: {
    formatted_address: string;
    address_components: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
  }[];
  status: string;
  error_message?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const direccion = searchParams.get('direccion');
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!direccion) {
    return NextResponse.json({ error: "Se debe proporcionar una dirección." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API key no configurada." }, { status: 500 });
  }

  const params = new URLSearchParams({
    address: direccion,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`Error en la respuesta de la API: ${response.status}`);
    }

    const data: GeocodeResponse = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ error: "No se encontraron resultados para esta dirección." }, { status: 404 });
    }

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Error en la geocodificación: ${data.status}`);
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: "No se encontraron resultados para esta dirección." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error en geocoding:", error.message);
    return NextResponse.json(
      { error: error.message || "Error al geocodificar la dirección" },
      { status: 500 }
    );
  }
} 