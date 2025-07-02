import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/database/supabase/server';
import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Testing notifications table access...');

    // Get current user for security validation
    const supabase = getEnvironmentServerClient();
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

    const businessId = userData.businessId;
    console.log('👤 [DEBUG] User businessId:', businessId);

    const results: any = {
      userBusinessId: businessId,
      tests: {},
      summary: ''
    };

    // Test 1: Service Role Client (should bypass RLS)
    console.log('🧪 [DEBUG] Test 1: Service Role Client');
    try {
      const serviceSupabase = getServiceRoleClient();
      const { data: serviceNotifications, error: serviceError } = await serviceSupabase
        .from('notifications')
        .select('*')
        .eq('businessId', businessId);

      results.tests.serviceRole = {
        success: !serviceError,
        error: serviceError?.message || null,
        count: serviceNotifications?.length || 0,
        data: serviceNotifications || []
      };
      console.log('✅ [DEBUG] Service role result:', !serviceError ? 'SUCCESS' : 'FAILED', serviceError?.message);
    } catch (err) {
      results.tests.serviceRole = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        count: 0,
        data: []
      };
      console.log('❌ [DEBUG] Service role exception:', err);
    }

    // Test 2: Regular client (with RLS)
    console.log('🧪 [DEBUG] Test 2: Regular Client with RLS');
    try {
      const { data: regularNotifications, error: regularError } = await supabase
        .from('notifications')
        .select('*')
        .eq('businessId', businessId);

      results.tests.regularClient = {
        success: !regularError,
        error: regularError?.message || null,
        count: regularNotifications?.length || 0,
        data: regularNotifications || []
      };
      console.log('✅ [DEBUG] Regular client result:', !regularError ? 'SUCCESS' : 'FAILED', regularError?.message);
    } catch (err) {
      results.tests.regularClient = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        count: 0,
        data: []
      };
      console.log('❌ [DEBUG] Regular client exception:', err);
    }

    // Test 3: Check if there are ANY notifications in the table (admin view)
    console.log('🧪 [DEBUG] Test 3: Count all notifications (service role)');
    try {
      const serviceSupabase = getServiceRoleClient();
      const { count, error: countError } = await serviceSupabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });

      results.tests.totalCount = {
        success: !countError,
        error: countError?.message || null,
        totalNotifications: count || 0
      };
      console.log('✅ [DEBUG] Total notifications in table:', count);
    } catch (err) {
      results.tests.totalCount = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        totalNotifications: 0
      };
      console.log('❌ [DEBUG] Count exception:', err);
    }

    // Test 4: Check active notifications specifically
    console.log('🧪 [DEBUG] Test 4: Active notifications (pending/attending)');
    try {
      const serviceSupabase = getServiceRoleClient();
      const { data: activeNotifications, error: activeError } = await serviceSupabase
        .from('notifications')
        .select('*')
        .eq('businessId', businessId)
        .in('status', ['pending', 'attending']);

      results.tests.activeNotifications = {
        success: !activeError,
        error: activeError?.message || null,
        count: activeNotifications?.length || 0,
        data: activeNotifications || []
      };
      console.log('✅ [DEBUG] Active notifications result:', !activeError ? 'SUCCESS' : 'FAILED', activeError?.message);
    } catch (err) {
      results.tests.activeNotifications = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        count: 0,
        data: []
      };
      console.log('❌ [DEBUG] Active notifications exception:', err);
    }

    // Test 5: Check chat sessions for this business
    console.log('🧪 [DEBUG] Test 5: Chat sessions for business');
    try {
      const serviceSupabase = getServiceRoleClient();
      const { data: chatSessions, error: sessionsError } = await serviceSupabase
        .from('chatSessions')
        .select('id, channelUserId, businessId, updatedAt')
        .eq('businessId', businessId)
        .order('updatedAt', { ascending: false })
        .limit(5);

      results.tests.chatSessions = {
        success: !sessionsError,
        error: sessionsError?.message || null,
        count: chatSessions?.length || 0,
        data: chatSessions || []
      };
      console.log('✅ [DEBUG] Chat sessions result:', !sessionsError ? 'SUCCESS' : 'FAILED', sessionsError?.message);
    } catch (err) {
      results.tests.chatSessions = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        count: 0,
        data: []
      };
      console.log('❌ [DEBUG] Chat sessions exception:', err);
    }

    // Generate summary
    const hasActiveNotifications = results.tests.activeNotifications?.count > 0;
    const hasChatSessions = results.tests.chatSessions?.count > 0;
    const serviceRoleWorks = results.tests.serviceRole?.success;

    if (!serviceRoleWorks) {
      results.summary = '❌ CRITICAL: Service role client cannot access notifications table. This is a database configuration issue.';
    } else if (results.tests.totalCount?.totalNotifications === 0) {
      results.summary = '⚠️ No notifications exist in the database. The highlights won\'t show because there are no escalations.';
    } else if (!hasActiveNotifications && hasChatSessions) {
      results.summary = '⚠️ No active escalations found for this business, but chat sessions exist. This could be normal if all escalations were resolved.';
    } else if (hasActiveNotifications) {
      results.summary = '✅ Active notifications found! If highlights aren\'t showing, the issue is in the frontend components or data flow.';
    } else if (!hasChatSessions) {
      results.summary = '⚠️ No chat sessions found for this business. Cannot have escalations without chat sessions.';
    } else {
      results.summary = '🤔 Inconclusive results. Check individual test details.';
    }

    console.log('📋 [DEBUG] Summary:', results.summary);

    return NextResponse.json(results);

  } catch (error) {
    console.error('💥 [DEBUG] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 