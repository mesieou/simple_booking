import { NextRequest, NextResponse } from 'next/server';
import { getEnvironmentServerClient } from '@/lib/database/supabase/environment';
import { User } from '@/lib/database/models/user';

/**
 * List Providers API
 * Returns all providers for the current user's business
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication
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

    // Only allow admins to view providers
    if (!['admin', 'admin/provider', 'super_admin'].includes(userData?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    console.log(`[ListProviders] User ${user.id} requesting provider list for business ${userData.businessId}`);

    // Get all providers for this business
    const allUsers = await User.getByBusiness(userData.businessId);
    const providers = allUsers.filter(user => ['admin/provider', 'provider'].includes(user.role));

    const providerList = providers.map(provider => ({
      id: provider.id,
      firstName: provider.firstName,
      lastName: provider.lastName,
      email: provider.email,
      role: provider.role,
      isOwner: provider.role === 'admin/provider' || provider.role === 'admin',
      canRemove: provider.role === 'provider' // Can't remove owner/admin
    }));

    return NextResponse.json({
      success: true,
      providers: providerList,
      totalProviders: providerList.length
    });

  } catch (error) {
    console.error('[ListProviders] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 