import { NextRequest, NextResponse } from 'next/server';
import { createClient, getServiceRoleClient } from '@/lib/database/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, channelUserId } = await req.json();

    if (!sessionId || !channelUserId) {
      return NextResponse.json(
        { error: 'sessionId and channelUserId are required' },
        { status: 400 }
      );
    }

    // Get current user for security validation
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's business ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('businessId')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.businessId) {
      return NextResponse.json({ error: 'Could not identify your business' }, { status: 400 });
    }

    // Use service role client for database operations
    const serviceSupabase = getServiceRoleClient();

    // Verify that the session belongs to the user's business
    const { data: sessionData, error: sessionError } = await serviceSupabase
      .from('chatSessions')
      .select('businessId')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 });
    }

    if (sessionData.businessId !== userData.businessId) {
      return NextResponse.json({ error: 'You can only create escalations for your own business' }, { status: 403 });
    }

    // Check if there's already an active escalation for this session
    const { data: existingNotification, error: notificationCheckError } = await serviceSupabase
      .from('notifications')
      .select('id, status')
      .eq('chatSessionId', sessionId)
      .in('status', ['pending', 'attending'])
      .maybeSingle();

    if (notificationCheckError) {
      console.error('[CreateTestEscalation] Error checking existing notifications:', notificationCheckError);
      return NextResponse.json({ error: 'Error checking existing escalations' }, { status: 500 });
    }

    if (existingNotification) {
      return NextResponse.json({
        error: `There's already an active escalation for this session with status: ${existingNotification.status}`,
        existingEscalation: existingNotification
      }, { status: 409 });
    }

    // Create a test notification
    const { data: notification, error: createError } = await serviceSupabase
      .from('notifications')
      .insert({
        businessId: userData.businessId,
        chatSessionId: sessionId,
        message: `🧪 TEST ESCALATION - Customer ${channelUserId} requested human assistance (created via debug tool)`,
        status: 'pending'
      })
      .select()
      .single();

    if (createError) {
      console.error('[CreateTestEscalation] Error creating notification:', createError);
      return NextResponse.json({ error: 'Failed to create test escalation' }, { status: 500 });
    }

    console.log('[CreateTestEscalation] Test escalation created:', notification);

    return NextResponse.json({
      success: true,
      message: 'Test escalation created successfully',
      notification: {
        id: notification.id,
        sessionId: sessionId,
        channelUserId: channelUserId,
        status: notification.status,
        createdAt: notification.createdAt
      }
    });

  } catch (error) {
    console.error('[CreateTestEscalation] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 