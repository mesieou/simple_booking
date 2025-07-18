import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { Notification } from "@/lib/database/models/notification";

export async function POST(req: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication with server verification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[TakeControl] User ${user.id} attempting to take control.`);

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Get user's business ID and role to verify they can access this session
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
    
    console.log(`[TakeControl] User Role: ${userData?.role}, isSuperAdmin: ${isSuperAdmin}, Business ID: ${userBusinessId}`);

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

    // Check if session is already under admin control
    const { data: currentSession, error: sessionCheckError } = await supaServiceRole
      .from("chatSessions")
      .select("controlledByUserId, controlTakenAt")
      .eq("id", sessionId)
      .single();

    if (sessionCheckError) {
      return NextResponse.json({ error: "Error checking session control status" }, { status: 500 });
    }

    if (currentSession.controlledByUserId && currentSession.controlledByUserId !== user.id) {
      return NextResponse.json({ 
        error: "This chat is already under control by another admin",
        controlledBy: currentSession.controlledByUserId 
      }, { status: 409 });
    }

    // Take control by updating the chat session
    const { error: controlError } = await supaServiceRole
      .from("chatSessions")
      .update({ 
        controlledByUserId: user.id,
        controlTakenAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (controlError) {
      console.error("[TakeControl] Failed to set session control:", controlError);
      return NextResponse.json({ error: "Failed to take control of chat session" }, { status: 500 });
    }

    // If there's an existing escalation notification, update it to attending
    const { data: escalationNotification } = await supaServiceRole
      .from("notifications")
      .select("id, status")
      .eq("chatSessionId", sessionId)
      .eq("status", "pending")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (escalationNotification) {
      await supaServiceRole
        .from("notifications")
        .update({ status: "attending" })
        .eq("id", escalationNotification.id);
    }

    console.log(`[TakeControl] User ${user.id} took control of session ${sessionId}`);

    return NextResponse.json({ 
      success: true, 
      message: "You are now in control of this chat"
    });

  } catch (error) {
    console.error("[TakeControl] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 