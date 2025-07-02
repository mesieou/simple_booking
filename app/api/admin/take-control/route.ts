import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";
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

    // Get user's business ID to verify they can access this session
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.businessId) {
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }
    
    console.log(`[TakeControl] User Business ID: ${userData.businessId}`);

    // Verify the chat session belongs to the staff's business
    const { data: sessionData, error: sessionError } = await supabase
      .from("chatSessions")
      .select("businessId")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    if (sessionData.businessId !== userData.businessId) {
      return NextResponse.json({ error: "You can only manage chats from your business" }, { status: 403 });
    }

    // Find the pending notification for this session
    const { data: notificationData, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("chatSessionId", sessionId)
      .eq("status", "pending")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notificationError) {
      return NextResponse.json({ error: "Error checking notifications" }, { status: 500 });
    }

    if (!notificationData) {
      return NextResponse.json({ error: "No pending escalation found for this chat" }, { status: 404 });
    }

    // Update notification status to indicate staff is attending
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ status: "attending" })
      .eq("id", notificationData.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to take control of chat" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "You are now in control of this chat",
      notificationId: notificationData.id 
    });

  } catch (error) {
    console.error("[TakeControl] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 