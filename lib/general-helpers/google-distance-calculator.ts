export interface DistanceApiResponseElement {
  status: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  duration_in_traffic?: { text: string; value: number };
}

export interface DistanceApiResponseRow {
  elements: DistanceApiResponseElement[];
}

export interface DistanceApiResponse {
  status: string;
  rows: DistanceApiResponseRow[];
  origin_addresses: string[];
  destination_addresses: string[];
  error_message?: string;
}

export interface DistanceApiError {
  error: string;
}

export const fetchDirectGoogleMapsDistance = async (origen: string, destino: string): Promise<DistanceApiResponse> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Google Maps API key is not configured.");
    throw new Error("Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY environment variable.");
  }

  const today = new Date();
  const targetTime = new Date(today);
  targetTime.setHours(17, 0, 0, 0); // 5 PM

  if (today.getTime() > targetTime.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const departureTime = Math.floor(targetTime.getTime() / 1000);

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