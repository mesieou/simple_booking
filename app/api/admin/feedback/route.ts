import { NextRequest, NextResponse } from 'next/server';
import { ChatSession } from '@/lib/database/models/chat-session';
import { createClient } from '@/lib/database/supabase/server';
import { getServiceRoleClient } from '@/lib/database/supabase/service-role';
import { WhatsappSender } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-sender';
import { Business } from '@/lib/database/models/business';

interface FeedbackRequest {
  sessionId: string;
  messageContent: string;
  feedbackType: 'thumbs_up' | 'thumbs_down';
  feedbackText: string | null;
  timestamp: string;
}

// Admin numbers for negative feedback notifications
const ADMIN_NOTIFICATION_NUMBERS = [
  '+61450549485',
  '+61473164581',
];

// Helper function to get admin notification numbers
function getAdminNotificationNumbers(): string[] {
  // You can add logic here to fetch admin numbers from database in the future
  // For now, return the static list
  return ADMIN_NOTIFICATION_NUMBERS.filter(num => num && num.length > 0);
}

async function sendNegativeFeedbackNotification(
  sessionId: string,
  messageContent: string,
  feedbackText: string | null,
  customerPhoneNumber: string,
  businessId: string
) {
  try {
    console.log('[Feedback Notification] Sending negative feedback alert to admins');

    // Get business WhatsApp configuration
    const business = await Business.getById(businessId);
    let businessPhoneNumberId = business?.whatsappPhoneNumberId;
    
    // Fallback to environment variable if no business-specific config
    if (!businessPhoneNumberId) {
      businessPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    }

    if (!businessPhoneNumberId) {
      console.error('[Feedback Notification] No WhatsApp Phone Number ID configured');
      return;
    }

    // Create notification message
    const notificationMessage = `🚨 *NEGATIVE BOT FEEDBACK ALERT* 🚨

📱 *Customer:* ${customerPhoneNumber}
📝 *Session ID:* ${sessionId}
🏢 *Business ID:* ${businessId}

🤖 *Bot Message:*
"${messageContent}"

${feedbackText ? `💬 *Admin Feedback:*
"${feedbackText}"` : ''}

⏰ *Time:* ${new Date().toLocaleString()}

🔗 *Action Required:* Please review this conversation in the admin dashboard to improve bot responses.

---
This is an automated alert for negative bot feedback.`;

    const whatsappSender = new WhatsappSender();
    const adminNumbers = getAdminNotificationNumbers();
    
    console.log(`[Feedback Notification] Sending to ${adminNumbers.length} admin(s):`, adminNumbers);

    // Send notification to all admin numbers
    const notificationPromises = adminNumbers.map(async (adminNumber) => {
      try {
        console.log(`[Feedback Notification] Sending alert to admin: ${adminNumber}`);
        await whatsappSender.sendMessage(
          adminNumber,
          { text: notificationMessage },
          businessPhoneNumberId!
        );
        console.log(`[Feedback Notification] Alert sent successfully to ${adminNumber}`);
      } catch (error) {
        console.error(`[Feedback Notification] Failed to send alert to ${adminNumber}:`, error);
      }
    });

    await Promise.allSettled(notificationPromises);
    console.log('[Feedback Notification] Notification process completed');

  } catch (error) {
    console.error('[Feedback Notification] Error in notification system:', error);
    // Don't throw - notification failure shouldn't block feedback saving
  }
}

export async function GET(request: NextRequest) {
  console.log('[Feedback API] Received feedback retrieval request');
  
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      console.error('[Feedback API] Missing sessionId parameter');
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    console.log('[Feedback API] Fetching feedbacks for session:', sessionId);

    // Get current session data
    const session = await ChatSession.getById(sessionId);
    
    if (!session) {
      console.error('[Feedback API] Session not found:', sessionId);
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Extract feedbacks from the session
    const feedbackData = session.feedbackDataAveraged || { feedbacks: [] };
    const feedbacks = feedbackData.feedbacks || [];

    console.log('[Feedback API] Found', feedbacks.length, 'existing feedbacks');

    return NextResponse.json({
      success: true,
      feedbacks: feedbacks,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('[Feedback API] Unexpected error in GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[Feedback API] Received feedback submission request');
  
  try {
    const body: FeedbackRequest = await request.json();
    const { sessionId, messageContent, feedbackType, feedbackText, timestamp } = body;

    console.log('[Feedback API] Processing feedback:', {
      sessionId,
      feedbackType,
      messageLength: messageContent?.length || 0,
      hasFeedbackText: !!feedbackText
    });

    // Validate required fields
    if (!sessionId || !messageContent || !feedbackType || !timestamp) {
      console.error('[Feedback API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, messageContent, feedbackType, timestamp' },
        { status: 400 }
      );
    }

    // Validate feedbackType
    if (!['thumbs_up', 'thumbs_down'].includes(feedbackType)) {
      console.error('[Feedback API] Invalid feedback type:', feedbackType);
      return NextResponse.json(
        { error: 'Invalid feedbackType. Must be thumbs_up or thumbs_down' },
        { status: 400 }
      );
    }

    // Get current session data
    console.log('[Feedback API] Fetching session:', sessionId);
    const session = await ChatSession.getById(sessionId);
    
    if (!session) {
      console.error('[Feedback API] Session not found:', sessionId);
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    console.log('[Feedback API] Found session for business:', session.businessId);

    // Create new feedback entry
    const newFeedback = {
      messageContent,
      feedbackType,
      feedbackText,
      timestamp
    };

    console.log('[Feedback API] Creating new feedback entry');

    // Get existing feedback data or initialize new structure
    let feedbackData = session.feedbackDataAveraged || { feedbacks: [] };
    
    // Ensure feedbacks array exists
    if (!feedbackData.feedbacks) {
      feedbackData.feedbacks = [];
    }

    // Add new feedback to the array
    feedbackData.feedbacks.push(newFeedback);

    console.log('[Feedback API] Updated feedback data:', {
      totalFeedbacks: feedbackData.feedbacks.length,
      newFeedbackType: feedbackType
    });

    // Update the session with new feedback data
    const updatedSession = await ChatSession.update(sessionId, {
      feedbackDataAveraged: feedbackData
    });

    if (!updatedSession) {
      console.error('[Feedback API] Failed to update session');
      return NextResponse.json(
        { error: 'Failed to update chat session' },
        { status: 500 }
      );
    }

    console.log('[Feedback API] Successfully saved feedback to database');
    console.log('[Feedback API] Session updated at:', updatedSession.updatedAt);

    // Send notification for negative feedback
    if (feedbackType === 'thumbs_down') {
      console.log('[Feedback API] Negative feedback detected, sending admin notifications');
      await sendNegativeFeedbackNotification(
        sessionId,
        messageContent,
        feedbackText,
        session.channelUserId, // Customer phone number
        session.businessId
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully',
      feedbackCount: feedbackData.feedbacks.length,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('[Feedback API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 