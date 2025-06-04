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
  const address = searchParams.get('address');
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!address) {
    return NextResponse.json({ error: "An address must be provided." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured." }, { status: 500 });
  }

  const params = new URLSearchParams({
    address: address,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`API response error: ${response.status}`);
    }

    const data: GeocodeResponse = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ error: "No results found for this address." }, { status: 404 });
    }

    if (data.status !== 'OK') {
      throw new Error(data.error_message || `Geocoding error: ${data.status}`);
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ error: "No results found for this address." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in geocoding:", error.message);
    return NextResponse.json(
      { error: error.message || "Error geocoding the address" },
      { status: 500 }
    );
  }
} 