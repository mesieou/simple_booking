import { NextRequest, NextResponse } from "next/server";
// Enable clean, focused logging
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

// Environment setup
const CURRENT_ENVIRONMENT = getCurrentEnvironment();
const ENVIRONMENT_INFO = getEnvironmentInfo();
const IS_PRODUCTION = CURRENT_ENVIRONMENT === 'production';

// WhatsApp webhook config
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WEBHOOK_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const WEBHOOK_ENABLED = process.env.USE_WABA_WEBHOOK === "true";

const LOG_PREFIX = `[WhatsApp-Webhook ${CURRENT_ENVIRONMENT.toUpperCase()}]`;

// Log startup config
console.log(`${LOG_PREFIX} Environment Configuration:`, {
  environment: CURRENT_ENVIRONMENT,
  nodeEnv: ENVIRONMENT_INFO.nodeEnv,
  hasDevConfig: ENVIRONMENT_INFO.hasDevConfig,
  hasProdConfig: ENVIRONMENT_INFO.hasProdConfig,
  webhookEnabled: WEBHOOK_ENABLED
});

/**
 * Checks if user has admin privileges for business
 */
async function validateAdminAccess(phoneNumber: string, businessId: string): Promise<boolean> {
  try {
    console.log(`${LOG_PREFIX} Checking admin access for phone ${phoneNumber} in business ${businessId}`);
    
    const { getEnvironmentServiceRoleClient } = await import("@/lib/database/supabase/environment");
    const supa = getEnvironmentServiceRoleClient();
    
    // Normalize phone number for comparison
    const normalizedInputPhone = phoneNumber.replace(/[^\d]/g, '');
    console.log(`${LOG_PREFIX} Normalized input phone: ${normalizedInputPhone}`);
    
    // Query admin users with matching phone
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
      console.log(`${LOG_PREFIX} Found admin user: role=${matchedUser.role}, userId=${matchedUser.id}`);
      return true;
    }
    
    console.log(`${LOG_PREFIX} No admin user found for phone ${normalizedInputPhone} in business ${businessId}`);
    return false;
  } catch (error) {
    console.error(`${LOG_PREFIX} Error validating admin access for phone ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * Updates message delivery status from WhatsApp
 */
async function updateMessageDeliveryStatus(statusUpdate: ParsedStatusUpdate): Promise<void> {
  const { messageId, status, recipientId } = statusUpdate;
  
  console.log(`[Status Handler] Processing delivery status: ${status} for message: ${messageId} to: ${recipientId}`);

  try {
    switch (status) {
      case 'sent':
        await Notification.updateDeliveryStatusByMessageId(messageId, 'sent');
        console.log(`[Status Handler] Message ${messageId} marked as sent`);
        break;
        
      case 'delivered':
        await Notification.updateDeliveryStatusByMessageId(messageId, 'delivered');
        console.log(`[Status Handler] ✅ Message ${messageId} delivered to ${recipientId}`);
        break;
        
      case 'read':
        await Notification.updateDeliveryStatusByMessageId(messageId, 'read');
        console.log(`[Status Handler] ✅ Message ${messageId} read by ${recipientId}`);
        break;
        
      case 'failed':
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

/**
 * Extracts request data for processing
 */
async function extractRequestData(req: NextRequest): Promise<{ rawBody: string; clientIp: string; signature: string | null }> {
  // Get client IP for rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown';
  
  // Get WhatsApp signature for verification
  const signature = req.headers.get('x-hub-signature-256');
  
  // Get raw body for signature verification
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (bodyError) {
    console.error(`${LOG_PREFIX} Error reading request body:`, bodyError);
    throw new Error("Error reading request body");
  }
  
  return { rawBody, clientIp, signature };
}

/**
 * Validates webhook security (rate limiting + signature)
 */
function validateWebhookSecurity(clientIp: string, signature: string | null, rawBody: string): void {
  // Check rate limiting
  if (!WebhookSecurityUtils.checkRateLimit(clientIp)) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for IP: ${clientIp}`);
    throw new Error("Rate limit exceeded");
  }

  // Verify signature
  if (signature && !WebhookSecurityUtils.verifySignature(rawBody, signature)) {
    console.error(`${LOG_PREFIX} Webhook signature verification failed`);
    throw new Error("Signature verification failed");
  }
}

/**
 * Routes payload to correct business by phone number ID
 */
async function routeWebhookToBusiness(payload: WebhookAPIBody): Promise<BusinessRoutingResult> {
  // Debug logging
  console.log(`${LOG_PREFIX} 🔍 DEBUG - Full webhook payload:`, JSON.stringify(payload, null, 2));
  
  const debugPhoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  console.log(`${LOG_PREFIX} 🔍 DEBUG - Extracted phone_number_id:`, debugPhoneNumberId);
  console.log(`${LOG_PREFIX} 🔍 DEBUG - Entry count:`, payload.entry?.length);
  console.log(`${LOG_PREFIX} 🔍 DEBUG - Changes count:`, payload.entry?.[0]?.changes?.length);
  
  return await WebhookRouter.routeByPhoneNumberId(payload);
}

/**
 * Handles message deduplication
 */
function handleMessageDeduplication(messageId?: string, senderId?: string): boolean {
  // Check if already processed
  if (messageId && isMessageAlreadyProcessed(messageId)) {
    console.log(`${LOG_PREFIX} Message ${messageId} already processed - skipping duplicate`);
    return true; // Is duplicate
  }

  // Mark as processed
  if (messageId) {
    markMessageAsProcessed(messageId);
    console.log(`${LOG_PREFIX} Processing new message ${messageId}`);
  } else if (senderId) {
    console.log(`${LOG_PREFIX} Processing message without messageId from ${senderId}`);
  }
  
  return false; // Not duplicate
}

/**
 * Creates participant object from message and business
 */
function createConversationalParticipant(parsedMessage: any, business: any): ConversationalParticipant {
  return {
    id: parsedMessage.senderId,
    type: 'customer', // Always customer - admin detection separate
    associatedBusinessId: business.id,
    businessWhatsappNumber: parsedMessage.businessWhatsappNumber,
    customerWhatsappNumber: parsedMessage.customerWhatsappNumber,
    creationTimestamp: parsedMessage.timestamp ? new Date(parsedMessage.timestamp) : new Date(),
    lastUpdatedTimestamp: new Date(),
  };
}

/**
 * Processes message through bot pipeline and sends response
 */
async function processAndRespondToMessage(
  parsedMessage: any, 
  participant: ConversationalParticipant, 
  business: any, 
  routingResult: BusinessRoutingResult
): Promise<void> {
  // Check message has text
  if (!parsedMessage.text) {
    console.log(`${LOG_PREFIX} Parsed message has no text content. Skipping processing.`);
    return;
  }
  
  // Auto-map phone number ID for business
  if (parsedMessage.businessWhatsappNumber && parsedMessage.recipientId) {
    await Business.autoMapWhatsappPhoneNumberId(
      parsedMessage.businessWhatsappNumber, 
      parsedMessage.recipientId
    );
  }
  
  // Get chat context
  const { context: chatContext, sessionId, userContext, historyForLLM, customerUser } = await getOrCreateChatContext(participant);
  
  // Convert history to string format
  const historyAsString = historyForLLM
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
  
  // Create message context
  const messageContext: MessageHandlerContext = {
    parsedMessage,
    participant,
    chatContext,
    userContext,
    historyForLLM: historyAsString,
    customerUser,
    sessionId
  };

  // Process through bot pipeline
  console.log(`${LOG_PREFIX} Processing message through handler pipeline`);
  const botResponse = await MessageProcessor.processMessage(messageContext);

  // Send response if generated
  if (botResponse) {
    const targetLanguage = chatContext.participantPreferences.language;
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
}

/**
 * Handles GET request for webhook verification
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
 * Handles POST requests with WhatsApp messages
 */
export async function POST(req: NextRequest) {
  try {
    // Extract request data
    const { rawBody, clientIp, signature } = await extractRequestData(req);
    
    if (!WEBHOOK_ENABLED) {
      console.log(`${LOG_PREFIX} Webhook processing is disabled. Skipping POST request.`);
      return NextResponse.json({ message: "Webhook disabled" }, { status: 403 });
    }

    // Validate security
    try {
      validateWebhookSecurity(clientIp, signature, rawBody);
    } catch (securityError) {
      const message = securityError instanceof Error ? securityError.message : "Security validation failed";
      if (message.includes("Rate limit")) {
        return NextResponse.json({ message }, { status: 429 });
      }
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse and route payload
    const payload = JSON.parse(rawBody) as WebhookAPIBody;
    const routingResult = await routeWebhookToBusiness(payload);
    
    // Handle routing failures
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

    // Handle dev numbers in production
    if (routingResult.routingType === 'dev') {
      console.log(`${LOG_PREFIX} ${routingResult.message}`);
      return NextResponse.json({ 
        status: "success - dev number ignored", 
        phoneNumberId: routingResult.phoneNumberId,
        message: "Dev/testing number ignored in production - handled by dev webhook" 
      }, { status: 200 });
    }

    // Process for valid business
    const business = routingResult.business!;
    console.log(`${LOG_PREFIX} Processing message for business: ${business.name} (ID: ${business.id})`);

    // Parse WhatsApp message
    const parsedEvent = await parseWhatsappMessage(payload, business.id);

    if (parsedEvent && "text" in parsedEvent && parsedEvent.senderId && parsedEvent.text && parsedEvent.text.trim()) {
      const parsedMessage = parsedEvent;
      console.log(`${LOG_PREFIX} Successfully parsed message from ${parsedMessage.senderId}: "${parsedMessage.text}"`);

      // Handle deduplication
      if (handleMessageDeduplication(parsedMessage.messageId, parsedMessage.senderId)) {
        return NextResponse.json({ status: "success - duplicate message ignored" }, { status: 200 });
      }

      // Log media attachments
      if (parsedMessage.attachments && parsedMessage.attachments.length > 0) {
        console.log(`${LOG_PREFIX} Message contains ${parsedMessage.attachments.length} attachment(s)`);
      }

      // Validate business config
      if (!business.id) {
        console.error(`${LOG_PREFIX} Business ID is missing for business: ${business.name}`);
        return NextResponse.json({ message: "Business configuration error" }, { status: 500 });
      }
      
      // Check admin access
      const isAdmin = await validateAdminAccess(parsedMessage.senderId, business.id);
      const participant = createConversationalParticipant(parsedMessage, business);

      console.log(`${LOG_PREFIX} Created participant:`, {
        id: participant.id,
        type: participant.type,
        senderId: parsedMessage.senderId,
        businessId: business.id,
        isAdmin: isAdmin
      });

      // Process message
      try {
        await processAndRespondToMessage(parsedMessage, participant, business, routingResult);
      } catch (processingError) {
        console.error(`${LOG_PREFIX} Error processing message for ${parsedMessage.senderId}:`, processingError);
      }
    } else {
      // Handle status updates
      if (parsedEvent && "type" in parsedEvent && parsedEvent.type === "status_update") {
        console.log(`${LOG_PREFIX} Processing WhatsApp status update: ${parsedEvent.status} for message ${parsedEvent.messageId}`);
        
        try {
          await updateMessageDeliveryStatus(parsedEvent);
        } catch (statusError) {
          console.error(`${LOG_PREFIX} Error handling status update:`, statusError);
        }
      } else {
        console.log(`${LOG_PREFIX} Skipping processing: Payload could not be parsed into an actionable message.`);
      }
    }
    
    return NextResponse.json({ status: "success - acknowledged by whatsapp-webhook" }, { status: 200 });

  } catch (error) {
    console.error(`${LOG_PREFIX} Critical error processing POST request:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error in whatsapp-webhook" }, { status: 500 });
  }
} 