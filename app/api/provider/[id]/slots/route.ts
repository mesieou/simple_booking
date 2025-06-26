import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/supabase/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const providerId = id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('availabilitySlots')
      .select('slots')
      .eq('providerId', providerId)
      .eq('date', date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error fetching slots';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 