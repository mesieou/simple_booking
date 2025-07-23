import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';
import { AvailabilitySlots } from '@/lib/database/models/availability-slots';

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

    // Find the business ID for this provider
    const supabase = await getEnvironmentServerClient();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('businessId')
      .eq('id', providerId)
      .single();

    if (userError || !userData?.businessId) {
      console.error(`[API] Could not find business for provider ${providerId}:`, userError);
      return NextResponse.json({ error: 'Provider not found or not associated with a business' }, { status: 404 });
    }

    // Get availability using the new business-based system
    const availabilityData = await AvailabilitySlots.getByBusinessAndDate(
      userData.businessId, 
      date
    );

    if (!availabilityData) {
      // Return empty slots structure for consistency with old API
      return NextResponse.json([]);
    }

    // Return data in the format expected by existing components
    return NextResponse.json([{
      slots: availabilityData.slots,
      date: availabilityData.date,
      businessId: availabilityData.businessId
    }]);

  } catch (error) {
    console.error('[API] Error in provider slots endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error fetching slots';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 