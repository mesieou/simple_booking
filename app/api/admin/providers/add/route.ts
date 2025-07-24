import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';
import { addProviderToBusiness } from '@/lib/provider-management/provider-lifecycle';

/**
 * Simple Add Provider API
 * User just provides firstName/lastName, system handles everything else
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Check for CRON secret first (for testing)
    const authHeader = request.headers.get('authorization');
    const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    let businessId: string;
    
    if (isCronAuth) {
      // Testing mode - get businessId from request body
      const body = await request.json();
      businessId = body.businessId;
      
      if (!businessId) {
        return NextResponse.json({ error: "businessId is required when using CRON auth" }, { status: 400 });
      }
      
      console.log(`[AddProvider] CRON testing mode for business: ${businessId}`);
      
      const { firstName, lastName, email } = body;
      
      if (!firstName || !lastName) {
        return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
      }
      
      const result = await addProviderToBusiness(businessId, {
        firstName,
        lastName,
        email
      });
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? `${firstName} ${lastName} added to business` : 'Failed to add provider',
        providerId: result.userId,
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

    // Only allow admins to add providers
    if (!['admin', 'admin/provider', 'super_admin'].includes(userData?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { firstName, lastName, email } = await request.json();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
    }

    console.log(`[AddProvider] User ${user.id} adding provider: ${firstName} ${lastName}`);

    const result = await addProviderToBusiness(userData.businessId, {
      firstName,
      lastName,
      email
    });
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${firstName} ${lastName} added to your team`,
        providerId: result.userId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to add provider'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[AddProvider] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 