import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";

export async function POST(req: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication with server verification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Get user's business ID and role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId, role")
      .eq("id", user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }

    const isSuperAdmin = userData?.role === 'super_admin';
    const userBusinessId = userData?.businessId;

    // Verify the chat session belongs to the staff's business
    // Use service role client to bypass RLS for session queries
    const supaServiceRole = getEnvironmentServiceRoleClient();
    const { data: sessionData, error: sessionError } = await supaServiceRole
      .from("chatSessions")
      .select("businessId")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    // For superadmins, allow access to any session
    // For regular users, verify the session belongs to their business
    if (!isSuperAdmin) {
      if (!userBusinessId) {
        return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
      }
      
      if (sessionData.businessId !== userBusinessId) {
        return NextResponse.json({ error: "You can only manage chats from your business" }, { status: 403 });
      }
    }

    // Find the attending notification for this session
    // Use conditional filtering based on user role for security
    let notificationQuery = supaServiceRole
      .from("notifications")
      .select("*")
      .eq("chatSessionId", sessionId)
      .eq("status", "attending");

    // For regular users, add business filter for security
    // For superadmins, allow access to notifications from any business
    if (!isSuperAdmin) {
      notificationQuery = notificationQuery.eq("businessId", userBusinessId);
    }

    const { data: notificationData, error: notificationError } = await notificationQuery
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notificationError) {
      return NextResponse.json({ error: "Error checking notifications" }, { status: 500 });
    }

    if (!notificationData) {
      return NextResponse.json({ error: "No active assistance session found for this chat" }, { status: 404 });
    }

    // Update notification status to 'provided_help' to indicate assistance is complete
    const { error: updateError } = await supaServiceRole
      .from("notifications")
      .update({ status: "provided_help" })
      .eq("id", notificationData.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to finish assistance" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Assistance completed. The bot will now resume normal operation.",
      notificationId: notificationData.id 
    });

  } catch (error) {
    console.error("[FinishAssistance] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 