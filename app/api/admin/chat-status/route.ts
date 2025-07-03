import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";

export async function GET(req: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication with server verification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    
    console.log("[ChatStatus] Checking status for sessionId:", sessionId);
    
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Get user's business ID and role
    console.log("[ChatStatus] Getting business ID and role for user:", user.id);
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId, role")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("[ChatStatus] Error fetching user data:", userError);
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }

    const isSuperAdmin = userData?.role === 'super_admin';
    const userBusinessId = userData?.businessId;

    console.log("[ChatStatus] User role:", userData?.role, "isSuperAdmin:", isSuperAdmin, "businessId:", userBusinessId);

    // Verify the chat session belongs to the staff's business
    console.log("[ChatStatus] Verifying session ownership for sessionId:", sessionId);
    // Use service role client to bypass RLS for session queries (consistent with other admin endpoints)
    const supaServiceRole = getEnvironmentServiceRoleClient();
    const { data: sessionData, error: sessionError } = await supaServiceRole
      .from("chatSessions")
      .select("businessId")
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      console.error("[ChatStatus] Error fetching session data:", sessionError);
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    
    if (!sessionData) {
      console.error("[ChatStatus] No session data returned for sessionId:", sessionId);
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    console.log("[ChatStatus] Session businessId:", sessionData.businessId);

    // For superadmins, allow access to any session
    // For regular users, verify the session belongs to their business
    if (!isSuperAdmin) {
      if (!userBusinessId) {
        console.error("[ChatStatus] Regular user has no businessId:", userData);
        return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
      }
      
      if (sessionData.businessId !== userBusinessId) {
        console.error("[ChatStatus] Business ID mismatch. User:", userBusinessId, "Session:", sessionData.businessId);
        return NextResponse.json({ error: "You can only view chats from your business" }, { status: 403 });
      }
    }

    // Check for any notification for this session
    console.log("[ChatStatus] Checking notifications for sessionId:", sessionId);
    const { data: notificationData, error: notificationError } = await supaServiceRole
      .from("notifications")
      .select("*")
      .eq("chatSessionId", sessionId)
      .in("status", ["pending", "attending"])
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notificationError) {
      console.error("[ChatStatus] Error checking notifications:", notificationError);
      return NextResponse.json({ error: "Error checking notifications: " + notificationError.message }, { status: 500 });
    }

    console.log("[ChatStatus] Notification data:", notificationData);

    const status = {
      hasEscalation: !!notificationData,
      escalationStatus: notificationData?.status || null,
      canTakeControl: notificationData?.status === "pending",
      isAttending: notificationData?.status === "attending",
      canSendMessages: notificationData?.status === "attending",
      notificationId: notificationData?.id || null
    };

    console.log("[ChatStatus] Returning status:", status);
    return NextResponse.json({ status });

  } catch (error) {
    console.error("[ChatStatus] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: "Internal server error: " + errorMessage }, { status: 500 });
  }
} 