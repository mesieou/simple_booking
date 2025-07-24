import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';
import { removeProviderFromBusiness } from '@/lib/provider-management/provider-lifecycle';

/**
 * Simple Remove Provider API
 * User just provides the providerId, system handles everything else
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Check for CRON secret first (for testing)
    const authHeader = request.headers.get('authorization');
    const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    let businessId: string;
    
    if (isCronAuth) {
      // Testing mode - get businessId and providerId from request body
      const body = await request.json();
      businessId = body.businessId;
      const providerId = body.providerId;
      
      if (!businessId || !providerId) {
        return NextResponse.json({ error: "businessId and providerId are required when using CRON auth" }, { status: 400 });
      }
      
      console.log(`[RemoveProvider] CRON testing mode for business: ${businessId}`);
      
      const result = await removeProviderFromBusiness(businessId, {
        userId: providerId,
        reason: 'admin_removal'
      });
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Provider removed from business' : 'Failed to remove provider',
        error: result.error
      });
    }
    
    // Normal user authentication flow
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business and role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId, role")
      .eq("id", user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }

    // Only allow admins to remove providers
    if (!['admin', 'admin/provider', 'super_admin'].includes(userData?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { providerId } = await request.json();

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 400 });
    }

    console.log(`[RemoveProvider] User ${user.id} removing provider: ${providerId}`);

    const result = await removeProviderFromBusiness(userData.businessId, {
      userId: providerId,
      reason: 'admin_removal'
    });
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Provider removed from your team'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to remove provider'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[RemoveProvider] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 