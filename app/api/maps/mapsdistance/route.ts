import { NextRequest, NextResponse } from 'next/server';

interface DistanceApiResponseElement {
  status: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number }; // Added value for duration
  duration_in_traffic?: { text: string; value: number }; // Added value and optional
}

interface DistanceApiResponseRow {
  elements: DistanceApiResponseElement[];
}

interface DistanceApiResponse {
  status: string;
  rows: DistanceApiResponseRow[];
  origin_addresses: string[];
  destination_addresses: string[];
  error_message?: string; // Added for better error handling
}

interface DistanceApiError {
  error: string;
}

export const fetchDirectGoogleMapsDistance = async (origen: string, destino: string): Promise<DistanceApiResponse> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Google Maps API key is not configured.");
    throw new Error("Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
  }

  // Create a date for today at 5 PM
  const today = new Date();
  const targetTime = new Date(today);
  targetTime.setHours(17, 0, 0, 0); // 5 PM

  // If the current time is after 5 PM, use 5 PM of the next day
  if (today.getTime() > targetTime.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const departureTime = Math.floor(targetTime.getTime() / 1000); // Convert to Unix timestamp

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origen)}&destinations=${encodeURIComponent(destino)}&key=${apiKey}&mode=driving&departure_time=${departureTime}&traffic_model=pessimistic`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error_message || data?.error?.message || 'Error fetching distance from Google Maps';
    console.error(`Google Maps API HTTP error: ${response.status}`, data);
    throw new Error(errorMessage);
  }

  if (data.status !== 'OK') {
    const errorMessage = data?.error_message || `Google Maps API returned status: ${data.status}`;
    console.error(`Google Maps API non-OK status: ${data.status}`, data);
    throw new Error(errorMessage);
  }

  return data as DistanceApiResponse;
};

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