import { NextRequest, NextResponse } from 'next/server';
import { ChatSession } from '@/lib/database/models/chat-session';
import { ScalableNotificationService } from '@/lib/bot-engine/services/scalable-notification-service';

const LOG_PREFIX = '[FeedbackAPI]';

export async function POST(request: NextRequest) {
  console.log(`${LOG_PREFIX} Feedback API endpoint called`);
  
  try {
    const { sessionId, messageContent, feedbackText, feedbackType = 'thumbs_down' } = await request.json();
    
    console.log(`${LOG_PREFIX} Received feedback:`, {
      sessionId,
      feedbackType,
      messageContent: messageContent?.substring(0, 100) + '...',
      feedbackText: feedbackText?.substring(0, 100) + '...'
    });

    // Validate required fields
    if (!sessionId || !messageContent || !feedbackText) {
      console.error(`${LOG_PREFIX} Missing required fields`);
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, messageContent, feedbackText' 
      }, { status: 400 });
    }

    // Get chat session to find business and customer info
    const chatSession = await ChatSession.getById(sessionId);
    if (!chatSession) {
      console.error(`${LOG_PREFIX} Chat session not found: ${sessionId}`);
      return NextResponse.json({ 
        error: 'Chat session not found' 
      }, { status: 404 });
    }

    // Get business info
    const { Business } = await import('@/lib/database/models/business');
    const business = await Business.getById(chatSession.businessId);
    if (!business) {
      console.error(`${LOG_PREFIX} Business not found: ${chatSession.businessId}`);
      return NextResponse.json({ 
        error: 'Business not found' 
      }, { status: 404 });
    }

    // Get customer phone number (normalize format)
    const customerPhoneNumber = chatSession.channelUserId?.startsWith('+') 
      ? chatSession.channelUserId 
      : `+${chatSession.channelUserId}`;

    // Prepare feedback details for notification
    const feedbackDetails = {
      customerName: 'Customer', // Could be enhanced with actual customer name lookup
      customerPhone: customerPhoneNumber.replace('+', ''), // Remove + for template
      customerPhoneNumber: customerPhoneNumber,
      sessionId: sessionId,
      businessId: chatSession.businessId,
      botMessage: messageContent,
      messageContent: messageContent,
      feedbackText: feedbackText,
      businessName: business.name,
      timestamp: new Date().toLocaleString()
    };

    // Send feedback notification using scalable service
    const notificationService = new ScalableNotificationService();
    await notificationService.sendFeedbackNotification(
      chatSession.businessId,
      feedbackDetails
    );
    
    console.log(`${LOG_PREFIX} ✅ Feedback notification sent successfully`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Feedback received and notification sent'
    });

  } catch (error) {
    console.error(`${LOG_PREFIX} Error processing feedback:`, error);
    return NextResponse.json({ 
      error: 'Internal server error processing feedback'
    }, { status: 500 });
  }
} 