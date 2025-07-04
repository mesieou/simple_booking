import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { WhatsappSender } from "@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender";
import { Business } from "@/lib/database/models/business";

export async function POST(req: NextRequest) {
  try {
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication with server verification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, message } = await req.json();
    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "Session ID and message are required" }, { status: 400 });
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

    // Get chat session data and verify ownership (removed businessPhoneNumberId from query)
    const supaServiceRole = getEnvironmentServiceRoleClient();
    const { data: sessionData, error: sessionError } = await supaServiceRole
      .from("chatSessions")
      .select("businessId, channelUserId, allMessages")
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

    // Verify that staff is currently attending this session
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
      return NextResponse.json({ error: "Error checking attendance status" }, { status: 500 });
    }

    if (!notificationData) {
      return NextResponse.json({ error: "You must take control of this chat before sending messages" }, { status: 403 });
    }

    // Get businessPhoneNumberId using intelligent multi-approach strategy
    let businessPhoneNumberId: string | null | undefined;

    // Approach 1: Get from business data (most reliable for multi-tenant)
    const business = await Business.getById(sessionData.businessId);
    if (business?.whatsappPhoneNumberId) {
      businessPhoneNumberId = business.whatsappPhoneNumberId;
      console.log("[SendMessage] Using business-specific WhatsApp Phone Number ID");
    } else if (business?.whatsappNumber) {
      // Approach 2: Try to get by WhatsApp number (in case it was auto-mapped elsewhere)
      businessPhoneNumberId = await Business.getWhatsappPhoneNumberId(business.whatsappNumber);
      if (businessPhoneNumberId) {
        console.log("[SendMessage] Found Phone Number ID via WhatsApp number lookup");
      }
    }

    // Approach 3: Fallback to environment variable (for single-business setups)
    if (!businessPhoneNumberId) {
      businessPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      console.log("[SendMessage] Using environment variable for WhatsApp Phone Number ID");
    }

    if (!businessPhoneNumberId) {
      return NextResponse.json({ 
        error: "WhatsApp integration not configured for your business. Please ensure your WhatsApp Business number is properly set up." 
      }, { status: 500 });
    }

    // Send message via WhatsApp
    const whatsappSender = new WhatsappSender();
    const customerPhoneNumber = sessionData.channelUserId;

    try {
      await whatsappSender.sendMessage(
        customerPhoneNumber, 
        { text: message.trim() }, 
        businessPhoneNumberId
      );
    } catch (whatsappError) {
      console.error("[SendMessage] WhatsApp sending failed:", whatsappError);
      return NextResponse.json({ error: "Failed to send message via WhatsApp" }, { status: 500 });
    }

    // Update chat history with the staff message
    const currentMessages = sessionData.allMessages || [];
    const newMessage = {
      role: "staff",
      content: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    const updatedMessages = [...currentMessages, newMessage];

    const { error: updateError } = await supaServiceRole
      .from("chatSessions")
      .update({ 
        allMessages: updatedMessages,
        updatedAt: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[SendMessage] Failed to update chat history:", updateError);
      // Message was sent but not saved to history - this is logged but not returned as error
    }

    return NextResponse.json({ 
      success: true, 
      message: "Message sent successfully" 
    });

  } catch (error) {
    console.error("[SendMessage] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 