import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input) {
    return NextResponse.json({ error: 'A search term is required' }, { status: 400 });
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&language=en`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_message || 'Error fetching suggestions');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in autocomplete:', error);
    return NextResponse.json(
      { error: error.message || 'Error processing the request' },
      { status: 500 }
    );
  }
} 