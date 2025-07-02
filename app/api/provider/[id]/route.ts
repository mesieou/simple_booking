import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await getEnvironmentServerClient();
    const { data, error } = await supabase
      .from('users')
      .select('firstName, lastName')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching provider data' },
      { status: 500 }
    );
  }
} 