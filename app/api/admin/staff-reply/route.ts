import { NextRequest, NextResponse } from "next/server";
import { getEnvironmentServerClient, getEnvironmentServiceRoleClient } from "@/lib/database/supabase/environment";
import { WhatsappSender } from "@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender";
import { Business } from "@/lib/database/models/business";
import { ModelError } from "@/lib/general-helpers/error";

export async function POST(req: NextRequest) {
  try {
    console.log("[StaffReply] Starting staff reply process");
    const supabase = getEnvironmentServerClient();
    
    // Verify user authentication with server verification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[StaffReply] Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[StaffReply] User authenticated:", user.id);

    const { sessionId, message } = await req.json();
    if (!sessionId || !message?.trim()) {
      console.error("[StaffReply] Missing required fields - sessionId:", !!sessionId, "message:", !!message?.trim());
      return NextResponse.json({ error: "Session ID and message are required" }, { status: 400 });
    }

    console.log("[StaffReply] Processing message for session:", sessionId);

    // Get user's business ID and role
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("businessId, role")
      .eq("id", user.id)
      .single();

    if (userError) {
      console.error("[StaffReply] Failed to fetch user data:", userError);
      return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
    }

    const isSuperAdmin = userData?.role === 'super_admin';
    const userBusinessId = userData?.businessId;
    console.log("[StaffReply] User role:", userData?.role, "businessId:", userBusinessId);

    // Get chat session data and verify ownership
    const supaServiceRole = getEnvironmentServiceRoleClient();
    const { data: sessionData, error: sessionError } = await supaServiceRole
      .from("chatSessions")
      .select("businessId, channelUserId, allMessages")
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      console.error("[StaffReply] Failed to fetch session data:", sessionError);
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }

    console.log("[StaffReply] Session found for business:", sessionData.businessId);

    // For superadmins, allow access to any session
    // For regular users, verify the session belongs to their business
    if (!isSuperAdmin) {
      if (!userBusinessId) {
        console.error("[StaffReply] Regular user has no businessId");
        return NextResponse.json({ error: "Could not identify your business" }, { status: 403 });
      }
      
      if (sessionData.businessId !== userBusinessId) {
        console.error("[StaffReply] Business mismatch - user:", userBusinessId, "session:", sessionData.businessId);
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
      console.error("[StaffReply] Failed to check attendance status:", notificationError);
      return NextResponse.json({ error: "Error checking attendance status" }, { status: 500 });
    }

    if (!notificationData) {
      console.error("[StaffReply] No attending notification found for session:", sessionId);
      return NextResponse.json({ error: "You must take control of this chat before sending messages" }, { status: 403 });
    }

    console.log("[StaffReply] Staff is attending session, proceeding with message");

    // Get businessPhoneNumberId using intelligent multi-approach strategy
    let businessPhoneNumberId: string | null | undefined;

    try {
      console.log("[StaffReply] Fetching business data for ID:", sessionData.businessId);
      
      // Approach 1: Get from business data (most reliable for multi-tenant)
      // Use service role for super_admin to bypass RLS issues
      const business = isSuperAdmin 
        ? await Business.getByIdWithServiceRole(sessionData.businessId)
        : await Business.getById(sessionData.businessId);
      console.log("[StaffReply] Business found:", business.name, "whatsappPhoneNumberId:", business.whatsappPhoneNumberId);
      
      if (business?.whatsappPhoneNumberId) {
        businessPhoneNumberId = business.whatsappPhoneNumberId;
        console.log("[StaffReply] Using business-specific WhatsApp Phone Number ID");
      } else if (business?.whatsappNumber) {
        console.log("[StaffReply] Trying to get Phone Number ID via WhatsApp number:", business.whatsappNumber);
        // Approach 2: Try to get by WhatsApp number (in case it was auto-mapped elsewhere)
        businessPhoneNumberId = await Business.getWhatsappPhoneNumberId(business.whatsappNumber);
        if (businessPhoneNumberId) {
          console.log("[StaffReply] Found Phone Number ID via WhatsApp number lookup:", businessPhoneNumberId);
        }
      }
    } catch (error) {
      if (error instanceof ModelError) {
        console.error("[StaffReply] Business model error:", error.message, error.originalError);
        return NextResponse.json({ 
          error: `Failed to fetch business configuration: ${error.message}` 
        }, { status: 500 });
      } else {
        console.error("[StaffReply] Unexpected error fetching business:", error);
        throw error; // Re-throw non-ModelError exceptions
      }
    }

    // Approach 3: Fallback to environment variable (for single-business setups)
    if (!businessPhoneNumberId) {
      businessPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      console.log("[StaffReply] Using environment variable for WhatsApp Phone Number ID:", !!businessPhoneNumberId);
    }

    if (!businessPhoneNumberId) {
      console.error("[StaffReply] No WhatsApp Phone Number ID found for business:", sessionData.businessId);
      return NextResponse.json({ 
        error: "WhatsApp integration not configured for your business. Please ensure your WhatsApp Business number is properly set up." 
      }, { status: 500 });
    }

    // Send message via WhatsApp
    console.log("[StaffReply] Preparing to send WhatsApp message to:", sessionData.channelUserId);
    const whatsappSender = new WhatsappSender();
    const customerPhoneNumber = sessionData.channelUserId;

    try {
      await whatsappSender.sendMessage(
        customerPhoneNumber, 
        { text: message.trim() }, 
        businessPhoneNumberId
      );
      console.log("[StaffReply] WhatsApp message sent successfully");
    } catch (whatsappError) {
      console.error("[StaffReply] WhatsApp sending failed:", whatsappError);
      
      // Provide more specific error information
      const errorMessage = whatsappError instanceof Error ? whatsappError.message : "Unknown WhatsApp error";
      return NextResponse.json({ 
        error: `Failed to send message via WhatsApp: ${errorMessage}` 
      }, { status: 500 });
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
      console.error("[StaffReply] Failed to update chat history:", updateError);
      // Message was sent but not saved to history - this is logged but not returned as error
    } else {
      console.log("[StaffReply] Chat history updated successfully");
    }

    console.log("[StaffReply] Staff reply process completed successfully");
    return NextResponse.json({ 
      success: true, 
      message: "Message sent successfully" 
    });

  } catch (error) {
    console.error("[StaffReply] Unexpected error in staff reply:", error);
    
    // Provide more detailed error information in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json({ 
      error: "Internal server error",
      ...(isDevelopment && { details: errorMessage, stack: error instanceof Error ? error.stack : undefined })
    }, { status: 500 });
  }
} 