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

    // Check if current user has control of this session
    const { data: sessionControl, error: controlCheckError } = await supaServiceRole
      .from("chatSessions")
      .select("controlledByUserId")
      .eq("id", sessionId)
      .single();

    if (controlCheckError) {
      return NextResponse.json({ error: "Error checking session control" }, { status: 500 });
    }

    if (!sessionControl.controlledByUserId) {
      return NextResponse.json({ error: "No one currently has control of this chat session" }, { status: 404 });
    }

    if (sessionControl.controlledByUserId !== user.id) {
      return NextResponse.json({ error: "You don't have control of this chat session" }, { status: 403 });
    }

    // Release admin control
    const { error: releaseError } = await supaServiceRole
      .from("chatSessions")
      .update({ 
        controlledByUserId: null,
        controlTakenAt: null,
        updatedAt: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (releaseError) {
      return NextResponse.json({ error: "Failed to release control" }, { status: 500 });
    }

    // If there was an attending escalation notification, mark it as resolved
    const { data: escalationNotification } = await supaServiceRole
      .from("notifications")
      .select("id")
      .eq("chatSessionId", sessionId)
      .eq("status", "attending")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (escalationNotification) {
      await supaServiceRole
        .from("notifications")
        .update({ status: "provided_help" })
        .eq("id", escalationNotification.id);
    }

    console.log(`[FinishAssistance] User ${user.id} released control of session ${sessionId}`);

    return NextResponse.json({ 
      success: true, 
      message: "Control released. The bot will now resume normal operation."
    });

  } catch (error) {
    console.error("[FinishAssistance] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 