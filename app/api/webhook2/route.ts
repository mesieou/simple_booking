import { NextRequest, NextResponse } from "next/server";
// Enable clean, focused logging - reduces verbose output while keeping structured logs
import '@/lib/bot-engine/utils/enable-clean-logs';
import { parseWhatsappMessage } from "@/lib/bot-engine/channels/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/bot-engine/channels/whatsapp/whatsapp-message-logger"; 
import { type ConversationalParticipant } from "@/lib/bot-engine/types";
import { getOrCreateChatContext } from "@/lib/bot-engine/session/session-manager";
import { Business } from '@/lib/database/models/business';
import { User, PROVIDER_ROLES } from '@/lib/database/models/user';
import { 
  WebhookRouter, 
  WebhookSecurityUtils,
  type BusinessRoutingResult 
} from "@/lib/bot-engine/channels/whatsapp/webhook-utils";
import { 
  MessageProcessor, 
  type MessageHandlerContext 
} from "@/lib/bot-engine/channels/whatsapp/message-handlers";
import { ResponseProcessor } from "@/lib/bot-engine/channels/whatsapp/response-processor";
import { getCurrentEnvironment, getEnvironmentInfo } from "@/lib/database/supabase/environment";
import { isMessageAlreadyProcessed, markMessageAsProcessed } from "@/lib/bot-engine/channels/whatsapp/message-deduplication";
import { Notification } from '@/lib/database/models/notification';
import { ParsedStatusUpdate } from '@/lib/bot-engine/channels/whatsapp/whatsapp-payload-parser';

export const dynamic = "force-dynamic";

// Environment Detection with Enhanced Logging
const CURRENT_ENVIRONMENT = getCurrentEnvironment();
const ENVIRONMENT_INFO = getEnvironmentInfo();
const IS_PRODUCTION = CURRENT_ENVIRONMENT === 'production';

// WhatsApp Webhook Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;          // Meta webhook verification token
const WEBHOOK_APP_SECRET = process.env.WHATSAPP_APP_SECRET;              // For signature verification  
const WEBHOOK_ENABLED = process.env.USE_WABA_WEBHOOK === "true";         // Enable/disable webhook processing

// Environment-aware logging
const LOG_PREFIX = `[Webhook ${CURRENT_ENVIRONMENT.toUpperCase()}]`;

// Log environment configuration on startup
console.log(`${LOG_PREFIX} Environment Configuration:`, {
  environment: CURRENT_ENVIRONMENT,
  nodeEnv: ENVIRONMENT_INFO.nodeEnv,
  hasDevConfig: ENVIRONMENT_INFO.hasDevConfig,
  hasProdConfig: ENVIRONMENT_INFO.hasProdConfig,
  webhookEnabled: WEBHOOK_ENABLED
});

/**
 * Helper function to determine if a user is an admin based on their phone number and role
 * @param phoneNumber - The phone number to check
 * @param businessId - The business ID to verify the user belongs to
 * @returns Promise<boolean> - true if user has admin/provider role for this business
 */
async function isUserAdminByPhone(phoneNumber: string, businessId: string): Promise<boolean> {
  try {
    console.log(`${LOG_PREFIX} Checking if phone ${phoneNumber} is admin for business ${businessId}`);
    
    // Import the database client and phone normalization utils
    const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
    const supa = getEnvironmentServiceRoleClient();
    
    // Normalize the input phone number for comparison (remove + and non-digits)
    const normalizedInputPhone = phoneNumber.replace(/[^\d]/g, '');
    console.log(`${LOG_PREFIX} Normalized input phone: ${normalizedInputPhone}`);
    
    // Query users table directly by phoneNormalized or whatsAppNumberNormalized fields
    const { data: users, error } = await supa
      .from('users')
      .select('*')
      .eq('businessId', businessId)
      .in('role', PROVIDER_ROLES)
      .or(`phoneNormalized.eq.${normalizedInputPhone},whatsAppNumberNormalized.eq.${normalizedInputPhone}`);
    
    if (error) {
      console.error(`${LOG_PREFIX} Error querying users table:`, error);
      return false;
    }
    
    if (users && users.length > 0) {
      const matchedUser = users[0];
      console.log(`${LOG_PREFIX} Found admin user: role=${matchedUser.role}, userId=${matchedUser.id}, phoneNormalized=${matchedUser.phoneNormalized}, whatsAppNumberNormalized=${matchedUser.whatsAppNumberNormalized}`);
      return true;
    }
    
    console.log(`${LOG_PREFIX} No admin user found with phoneNormalized or whatsAppNumberNormalized matching ${normalizedInputPhone} for business ${businessId}`);
    return false;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error checking admin status for phone ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * Handles WhatsApp status updates for delivery tracking
 */
async function handleWhatsAppStatusUpdate(statusUpdate: ParsedStatusUpdate): Promise<void> {
  const { messageId, status, recipientId } = statusUpdate;
  
  console.log(`[Status Handler] Processing status: ${status} for message: ${messageId} to: ${recipientId}`);

  try {
    // Update notification delivery status based on WhatsApp status
    switch (status) {
      case 'sent':
        // Message was sent from WhatsApp to the recipient
        await Notification.updateDeliveryStatusByMessageId(messageId, 'sent');
        console.log(`[Status Handler] Message ${messageId} marked as sent`);
        break;
        
      case 'delivered':
        // Message was delivered to the recipient's device
        await Notification.updateDeliveryStatusByMessageId(messageId, 'delivered');
        console.log(`[Status Handler] ✅ Message ${messageId} delivered to ${recipientId}`);
        break;
        
      case 'read':
        // Message was read by the recipient
        await Notification.updateDeliveryStatusByMessageId(messageId, 'read');
        console.log(`[Status Handler] ✅ Message ${messageId} read by ${recipientId}`);
        break;
        
      case 'failed':
        // Message delivery failed
        await Notification.updateDeliveryStatusByMessageId(messageId, 'failed', `WhatsApp delivery failed: ${status}`);
        console.error(`[Status Handler] ❌ Message ${messageId} delivery failed to ${recipientId}`);
        break;
        
      default:
        console.log(`[Status Handler] Unhandled status: ${status} for message: ${messageId}`);
    }
  } catch (error) {
    console.error(`[Status Handler] Error updating delivery status for message ${messageId}:`, error);
  }
}

// Multi-tenant routing - route messages based on phone number ID to different businesses

/**
 * Handles GET request from Meta/WhatsApp to verify the webhook endpoint
 */
export async function GET(req: NextRequest) {
  if (!WEBHOOK_ENABLED) {
    console.warn(`${LOG_PREFIX} Webhook verification skipped: WEBHOOK_ENABLED is not 'true'.`);
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");
  const expectedToken = WEBHOOK_VERIFY_TOKEN;

  if (hubMode !== "subscribe") {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Invalid hub.mode: ${hubMode}`);
    return NextResponse.json({ message: "Verification failed (mode)" }, { status: 403 });
  }

  if (!hubChallenge) {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Missing hub.challenge`);
    return NextResponse.json({ message: "Verification failed (challenge)" }, { status: 403 });
  }

  if (hubVerifyToken !== expectedToken) {
    console.error(`${LOG_PREFIX} Webhook verification FAILED: Invalid verify token`);
    return NextResponse.json({ message: "Verification failed (token)" }, { status: 403 });
  }

  console.log(`${LOG_PREFIX} Webhook verification PASSED`);
  return new NextResponse(hubChallenge, { status: 200 });
}

/**
 * Handles POST requests containing WhatsApp webhook events
 */
export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown';
  const signature = req.headers.get('x-hub-signature-256');
  
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (bodyError) {
    console.error(`${LOG_PREFIX} Error reading request body:`, bodyError);
    return NextResponse.json({ message: "Error reading request body" }, { status: 400 });
  }
  
  if (!WEBHOOK_ENABLED) {
    console.log(`${LOG_PREFIX} Webhook processing is disabled. Skipping POST request.`);
    return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
  }

  // Security checks
  if (!WebhookSecurityUtils.checkRateLimit(clientIp)) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
  }

  if (signature && !WebhookSecurityUtils.verifySignature(rawBody, signature)) {
    console.error(`${LOG_PREFIX} Webhook signature verification failed`);
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as WebhookAPIBody;
    
    // 🚨 TEMPORARY DEBUG: Log the full webhook payload to see what Meta is actually sending
    console.log(`${LOG_PREFIX} 🔍 DEBUG - Full webhook payload:`, JSON.stringify(payload, null, 2));
    
    // Extract phone_number_id manually for debugging
    const debugPhoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    console.log(`${LOG_PREFIX} 🔍 DEBUG - Extracted phone_number_id:`, debugPhoneNumberId);
    
    // Check if there are multiple entries or changes
    console.log(`${LOG_PREFIX} 🔍 DEBUG - Entry count:`, payload.entry?.length);
    console.log(`${LOG_PREFIX} 🔍 DEBUG - Changes count:`, payload.entry?.[0]?.changes?.length);
    
    // --- Multi-Tenant Phone Number ID Routing ---
    const routingResult: BusinessRoutingResult = await WebhookRouter.routeByPhoneNumberId(payload);
    
    if (!routingResult.success) {
      if (routingResult.routingType === 'missing') {
        return NextResponse.json({ status: "success - no phone_number_id" }, { status: 200 });
      } else if (routingResult.routingType === 'unknown') {
        return NextResponse.json({ 
          status: "not_found",
          message: routingResult.message 
        }, { status: 404 });
      }
    }

    // Handle dev/testing numbers - skip processing in production
    if (routingResult.routingType === 'dev') {
      console.log(`${LOG_PREFIX} ${routingResult.message}`);
      return NextResponse.json({ 
        status: "success - dev number ignored", 
        phoneNumberId: routingResult.phoneNumberId,
        message: "Dev/testing number ignored in production - handled by dev webhook" 
      }, { status: 200 });
    }

    // At this point we have a valid business for this phone number
    const business = routingResult.business!;
    console.log(`${LOG_PREFIX} Processing message for business: ${business.name} (ID: ${business.id})`);

    // Parse the WhatsApp message
    const parsedEvent = await parseWhatsappMessage(payload);

    if (parsedEvent && "text" in parsedEvent && parsedEvent.senderId && parsedEvent.text && parsedEvent.text.trim()) {
      const parsedMessage = parsedEvent;
      console.log(`${LOG_PREFIX} Successfully parsed message from ${parsedMessage.senderId}: "${parsedMessage.text}"`);

      // Check for duplicate message processing (only if messageId exists)
      if (parsedMessage.messageId && isMessageAlreadyProcessed(parsedMessage.messageId)) {
        console.log(`${LOG_PREFIX} Message ${parsedMessage.messageId} already processed - skipping duplicate`);
        return NextResponse.json({ status: "success - duplicate message ignored" }, { status: 200 });
      }

      // Mark message as processed to prevent duplicates (only if messageId exists)
      if (parsedMessage.messageId) {
        markMessageAsProcessed(parsedMessage.messageId);
        console.log(`${LOG_PREFIX} Processing new message ${parsedMessage.messageId}`);
      } else {
        console.log(`${LOG_PREFIX} Processing message without messageId from ${parsedMessage.senderId}`);
      }

      // Check for media attachments
      if (parsedMessage.attachments && parsedMessage.attachments.length > 0) {
        console.log(`${LOG_PREFIX} Message contains ${parsedMessage.attachments.length} attachment(s)`);
      }

      // Determine if sender is admin based on phone number and role
      const businessId = business.id;
      if (!businessId) {
        console.error(`${LOG_PREFIX} Business ID is missing for business: ${business.name}`);
        return NextResponse.json({ message: "Business configuration error" }, { status: 500 });
      }
      
      const isAdmin = await isUserAdminByPhone(parsedMessage.senderId, businessId);

      const participant: ConversationalParticipant = {
        id: parsedMessage.senderId,
        type: isAdmin ? 'business' : 'customer',
        businessWhatsappNumber: parsedMessage.businessWhatsappNumber,
        customerWhatsappNumber: parsedMessage.customerWhatsappNumber,
        creationTimestamp: parsedMessage.timestamp ? new Date(parsedMessage.timestamp) : new Date(),
        lastUpdatedTimestamp: new Date(),
      };

      console.log(`${LOG_PREFIX} Created participant:`, {
        id: participant.id,
        type: participant.type,
        senderId: parsedMessage.senderId,
        businessId: business.id,
        isAdmin: isAdmin
      });

      try {
        if (!parsedMessage.text) {
          console.log(`${LOG_PREFIX} Parsed message has no text content. Skipping processing.`);
          return NextResponse.json({ status: "success - no text content" }, { status: 200 });
        }
        
        // Auto-map WhatsApp Phone Number ID for backward compatibility
        if (parsedMessage.businessWhatsappNumber && parsedMessage.recipientId) {
          await Business.autoMapWhatsappPhoneNumberId(
            parsedMessage.businessWhatsappNumber, 
            parsedMessage.recipientId
          );
        }
        
        // Get or create chat context
        const { context: chatContext, sessionId, userContext, historyForLLM, customerUser } = await getOrCreateChatContext(participant);
        
        // Convert ChatMessage[] to string format for handlers
        const historyAsString = historyForLLM
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        
        // Create message handler context
        const messageContext: MessageHandlerContext = {
          parsedMessage,
          participant,
          chatContext,
          userContext,
          historyForLLM: historyAsString,
          customerUser,
          sessionId
        };

        // Process the message through the pipeline
        console.log(`${LOG_PREFIX} Processing message through handler pipeline`);
        const botResponse = await MessageProcessor.processMessage(messageContext);

        // Process and send response
        if (botResponse) {
          const targetLanguage = chatContext.participantPreferences.language;
          
          // Use business's phone number ID for outbound messaging (not the inbound routing ID)
          const outboundPhoneNumberId = business.whatsappPhoneNumberId || routingResult.phoneNumberId;
          
          const sent = await ResponseProcessor.processAndSend(
            botResponse,
            parsedMessage.senderId,
            parsedMessage.senderId,
            targetLanguage,
            outboundPhoneNumberId
          );
          
          if (sent) {
            console.log(`${LOG_PREFIX} Response successfully sent to ${parsedMessage.senderId}`);
          }
        } else {
          console.log(`${LOG_PREFIX} No response generated for ${parsedMessage.senderId}`);
        }

      } catch (processingError) {
        console.error(`${LOG_PREFIX} Error processing message for ${parsedMessage.senderId}:`, processingError);
      }
    } else {
      // Handle status updates and non-actionable messages
      if (parsedEvent && "type" in parsedEvent && parsedEvent.type === "status_update") {
        console.log(`${LOG_PREFIX} Processing WhatsApp status update: ${parsedEvent.status} for message ${parsedEvent.messageId}`);
        
                 // Handle delivery status updates for escalation notifications
         try {
           await handleWhatsAppStatusUpdate(parsedEvent);
         } catch (statusError) {
           console.error(`${LOG_PREFIX} Error handling status update:`, statusError);
         }
       } else {
         console.log(`${LOG_PREFIX} Skipping processing: Payload could not be parsed into an actionable message.`);
       }
     }
     
     return NextResponse.json({ status: "success - acknowledged by juan-bot v2" }, { status: 200 });

   } catch (error) {
     console.error(`${LOG_PREFIX} Critical error processing POST request:`, error);
     if (error instanceof SyntaxError) {
       return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
     }
     return NextResponse.json({ message: "Internal server error in juan-bot webhook" }, { status: 500 });
   }
 }