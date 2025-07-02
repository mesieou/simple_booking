import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";

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

    // Get user's business ID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.businessId) {
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }

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

    // Find the attending notification for this session
    const { data: notificationData, error: notificationError } = await supabase
      .from("notifications")
      .select("*")
      .eq("chatSessionId", sessionId)
      .eq("status", "attending")
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
    const { error: updateError } = await supabase
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