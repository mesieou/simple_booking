import { NextRequest, NextResponse } from "next/server";
import { 
  processIncomingMessage, 
  type ConversationalParticipant, 
  type ChatContext,
} from "@/lib/Juan-bot-engine/bot-manager";
import { parseWhatsappMessage } from "@/lib/conversation-engine/whatsapp/whatsapp-payload-parser";
import { type WebhookAPIBody } from "@/lib/conversation-engine/whatsapp/whatsapp-message-logger"; 
import { WhatsappSender } from "@/lib/conversation-engine/whatsapp/whatsapp-message-sender";
import { type ParsedMessage, type BotResponse } from "@/lib/cross-channel-interfaces/standardized-conversation-interface";
import { 
    handleEscalationOrAdminCommand, 
    EscalationResult, 
    AdminCommandResult 
} from "@/lib/Juan-bot-engine/escalation/handler";
import { getOrCreateChatContext, persistSessionState, START_BOOKING_PAYLOAD } from "@/lib/Juan-bot-engine/bot-manager-helpers";
import { handleFaqOrChitchat } from "@/lib/Juan-bot-engine/step-handlers/faq-handler";
import crypto from 'crypto';
import { franc } from 'franc-min';
import { IntelligentLLMService } from "@/lib/Juan-bot-engine/services/intelligent-llm-service";

// Type guard to check if the result is an EscalationResult
function isEscalationResult(result: EscalationResult | AdminCommandResult): result is EscalationResult {
    return 'isEscalated' in result;
}

export const dynamic = "force-dynamic";

// Production Configuration
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET; // For webhook signature verification
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const rawUseWabaWebhook = process.env.USE_WABA_WEBHOOK;
const USE_WABA_WEBHOOK = rawUseWabaWebhook === "true";
const LOG_PREFIX = "[Juan-Bot Webhook PROD]";

// Rate limiting storage (in production, use Redis or database)
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 200; // WhatsApp Business Management API limit

// Production webhook signature verification
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WHATSAPP_APP_SECRET) {
    console.warn(`${LOG_PREFIX} WHATSAPP_APP_SECRET not configured - skipping signature verification`);
    return true; // Allow in development, but warn
  }

  const expectedSignature = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));
}

// Rate limiting check
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const key = `rate_limit_${identifier}`;
  const current = rateLimitStorage.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStorage.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for ${identifier}: ${current.count}/${RATE_LIMIT_MAX_REQUESTS}`);
    return false;
  }

  current.count++;
  return true;
}

//Handles the GET request from Meta/WhatsApp to verify the webhook endpoint.
export async function GET(req: NextRequest) {
  console.log(`${LOG_PREFIX} ===== WEBHOOK VERIFICATION START =====`);

  // 1. Verificar que el webhook esté habilitado en la configuración
  if (!USE_WABA_WEBHOOK) {
    console.warn(`${LOG_PREFIX} Webhook verification skipped: USE_WABA_WEBHOOK is not 'true'.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  // 2. Extraer parámetros de la URL
  const url = new URL(req.url);
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  // 3. Loguear los valores recibidos para depuración
  console.log(`${LOG_PREFIX} Received verification params:`);
  console.log(`${LOG_PREFIX} - hub.mode: ${hubMode}`);
  console.log(`${LOG_PREFIX} - hub.verify_token (received): ${hubVerifyToken}`);
  console.log(`${LOG_PREFIX} - hub.challenge (present): ${!!hubChallenge}`);
  
  // Loguear el token esperado (¡cuidado con exponerlo en producción si es muy sensible!)
  const expectedToken = WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  console.log(`${LOG_PREFIX} - Expected token (from env): ${expectedToken ? 'Exists' : 'MISSING!'}`);

  // 4. Realizar las validaciones requeridas por Meta
  const isSubscribeMode = hubMode === "subscribe";
  if (!isSubscribeMode) {
    console.error(`${LOG_PREFIX} ❌ Webhook verification FAILED: hub.mode is not 'subscribe'. Received: ${hubMode}`);
    return NextResponse.json({ message: "Verification failed (mode)" }, { status: 403 });
  }

  const hasChallenge = !!hubChallenge;
  if (!hasChallenge) {
    console.error(`${LOG_PREFIX} ❌ Webhook verification FAILED: hub.challenge is missing.`);
    return NextResponse.json({ message: "Verification failed (challenge)" }, { status: 403 });
  }

  const isTokenValid = hubVerifyToken === expectedToken;
  if (!isTokenValid) {
    console.error(`${LOG_PREFIX} ❌ Webhook verification FAILED: Invalid verify token.`);
    console.error(`${LOG_PREFIX}    - Received: ${hubVerifyToken}`);
    console.error(`${LOG_PREFIX}    - Expected: ${expectedToken}`);
    return NextResponse.json({ message: "Verification failed (token)" }, { status: 403 });
  }

  // 5. Si todo es correcto, devolver el challenge
  console.log(`${LOG_PREFIX} ✅ Webhook verification PASSED. Returning challenge.`);
  console.log(`${LOG_PREFIX} ===== WEBHOOK VERIFICATION END =====`);
  return new NextResponse(hubChallenge, { status: 200 });
}

//Handles POST requests which contain WhatsApp webhook events (e.g., incoming messages).
export async function POST(req: NextRequest) {
  console.log(`${LOG_PREFIX} ===== WEBHOOK DEBUG START =====`);
  console.log(`${LOG_PREFIX} Received a POST request at ${new Date().toISOString()}`);
  console.log(`${LOG_PREFIX} Request URL: ${req.url}`);
  console.log(`${LOG_PREFIX} Request method: ${req.method}`);
  
  // Log all headers
  console.log(`${LOG_PREFIX} === REQUEST HEADERS ===`);
  req.headers.forEach((value, key) => {
    console.log(`${LOG_PREFIX} ${key}: ${value}`);
  });
  
  // Log user agent specifically
  const userAgent = req.headers.get('user-agent');
  console.log(`${LOG_PREFIX} User-Agent: ${userAgent}`);
  
  // Check if it's from Meta/WhatsApp
  const isFromMeta = userAgent?.includes('facebookplatform.com') || userAgent?.includes('WhatsApp');
  console.log(`${LOG_PREFIX} Is from Meta/WhatsApp: ${isFromMeta}`);
  
  // Log client IP
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown';
  console.log(`${LOG_PREFIX} Client IP: ${clientIp}`);
  
  // Log webhook signature if present
  const signature = req.headers.get('x-hub-signature-256');
  console.log(`${LOG_PREFIX} Webhook signature present: ${!!signature}`);
  
  // Get and log raw body
  let rawBody = '';
  try {
    rawBody = await req.text();
    console.log(`${LOG_PREFIX} === REQUEST BODY ===`);
    console.log(`${LOG_PREFIX} Body length: ${rawBody.length} characters`);
    console.log(`${LOG_PREFIX} Body preview: ${rawBody.substring(0, 500)}${rawBody.length > 500 ? '...' : ''}`);
    
    // Try to parse as JSON and log structure
    try {
      const parsedBody = JSON.parse(rawBody);
      console.log(`${LOG_PREFIX} Body parsed successfully as JSON`);
      console.log(`${LOG_PREFIX} Body object keys: ${Object.keys(parsedBody).join(', ')}`);
    } catch (parseError) {
      console.log(`${LOG_PREFIX} Body is not valid JSON: ${parseError}`);
    }
  } catch (bodyError) {
    console.error(`${LOG_PREFIX} Error reading request body:`, bodyError);
  }
  
  console.log(`${LOG_PREFIX} ===== WEBHOOK DEBUG END =====`);
  
  if (!USE_WABA_WEBHOOK) {
    console.log(`${LOG_PREFIX} WABA Webhook for juan-bot is disabled. Skipping POST request.`);
    return NextResponse.json({ message: "Webhook for juan-bot disabled" }, { status: 403 });
  }

  // Production security: Rate limiting
  if (!checkRateLimit(clientIp)) {
    console.warn(`${LOG_PREFIX} Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Production security: Webhook signature verification
    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      console.error(`${LOG_PREFIX} Webhook signature verification failed`);
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as WebhookAPIBody;
    console.log(`${LOG_PREFIX} POST request payload successfully parsed:`, JSON.stringify(payload, null, 2));

    const parsedEvent = parseWhatsappMessage(payload);
    console.log(`${LOG_PREFIX} WhatsApp message parsed. Event:`, parsedEvent ? JSON.stringify(parsedEvent, null, 2) : "null");

    if (parsedEvent && "text" in parsedEvent && parsedEvent.senderId && parsedEvent.text && parsedEvent.text.trim()) {
      const parsedMessage = parsedEvent;
      console.log(`${LOG_PREFIX} Successfully parsed message from ${parsedMessage.senderId}: "${parsedMessage.text}"`);

      const participant: ConversationalParticipant = {
        id: parsedMessage.senderId,
        type: 'customer',
        businessWhatsappNumber: parsedMessage.businessWhatsappNumber,
        customerWhatsappNumber: parsedMessage.customerWhatsappNumber,
        creationTimestamp: parsedMessage.timestamp ? new Date(parsedMessage.timestamp) : new Date(),
        lastUpdatedTimestamp: new Date(),
      };

      try {
        if (!parsedMessage.text) {
          console.log(`${LOG_PREFIX} Parsed message has no text content. Skipping all processing.`);
          return NextResponse.json({ status: "success - no text content" }, { status: 200 });
        }
        
        const { context: chatContext, sessionId, userContext, historyForLLM, customerUser } = await getOrCreateChatContext(participant);
        
        // --- Language Detection (Centralized) ---
        try {
          const existingLang = chatContext.participantPreferences.language;
          if (!existingLang || existingLang === 'en') {
            const langCode3 = franc(parsedMessage.text, { minLength: 3 });
            const langMap: { [key: string]: string } = { 'spa': 'es', 'eng': 'en' };
            const langCode2 = langMap[langCode3] || 'en';
            if (existingLang !== langCode2) {
              console.log(`${LOG_PREFIX} Language preference set to ${langCode2}`);
              chatContext.participantPreferences.language = langCode2;
            }
          }
        } catch (error) {
          console.error(`${LOG_PREFIX} Error detecting language:`, error);
        }
        // --- End Language Detection ---

        // --- Step 1: Check for Escalation or Admin Command ---
        if (chatContext.currentConversationSession) {
            const escalationResult = await handleEscalationOrAdminCommand(
                parsedMessage.text,
                participant,
                chatContext,
                userContext,
                historyForLLM,
                customerUser
            );

            if (isEscalationResult(escalationResult)) {
                if (escalationResult.isEscalated) {
                    console.log(`${LOG_PREFIX} Message handled by escalation system. Reason: ${escalationResult.reason}`);
                    if (escalationResult.response) {
                        const sender = new WhatsappSender();
                        await sender.sendMessage(parsedMessage.senderId, escalationResult.response);
                        console.log(`${LOG_PREFIX} Sent escalation response to ${parsedMessage.senderId}.`);
                        
                        chatContext.currentConversationSession.sessionStatus = 'escalated';
                        await persistSessionState(
                            sessionId, 
                            userContext, 
                            chatContext.currentConversationSession, 
                            undefined, 
                            parsedMessage.text || '', 
                            escalationResult.response.text || ''
                        );
                    }
                    return NextResponse.json({ status: "success - handled by escalation system" }, { status: 200 });
                }
            } else { // It's an AdminCommandResult
                if (escalationResult.isHandled) {
                    console.log(`${LOG_PREFIX} Message handled by admin command system.`);
                    if (escalationResult.response) {
                        const sender = new WhatsappSender();
                        await sender.sendMessage(parsedMessage.senderId, escalationResult.response);
                        console.log(`${LOG_PREFIX} Sent admin command response to ${parsedMessage.senderId}.`);
                    }
                    return NextResponse.json({ status: "success - handled by admin system" }, { status: 200 });
                }
            }
        }
        
        // --- Step 2: If not escalated, decide between FAQ/Chitchat and Booking Flow ---
        let botManagerResponse: BotResponse | null = null;
        const userCurrentGoal = chatContext.currentConversationSession?.activeGoals.find(g => g.goalStatus === 'inProgress');

        if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() || (userCurrentGoal && userCurrentGoal.goalType === 'serviceBooking')) {
            console.log(`${LOG_PREFIX} User is starting or continuing a booking flow. Routing to main engine.`);
            
            if (parsedMessage.text.toUpperCase() === START_BOOKING_PAYLOAD.toUpperCase() && userCurrentGoal) {
                userCurrentGoal.goalStatus = 'completed';
            }

            botManagerResponse = await processIncomingMessage(parsedMessage.text, participant);
            
        } else {
            console.log(`${LOG_PREFIX} No active booking goal. Routing to FAQ/Chitchat handler.`);
            const faqResponse = await handleFaqOrChitchat(chatContext, parsedMessage.text, historyForLLM);
            
            const targetLanguage = chatContext.participantPreferences.language;
            if (targetLanguage && targetLanguage !== 'en') {
                console.log(`${LOG_PREFIX} Translating FAQ response to ${targetLanguage}`);
                botManagerResponse = await translateBotResponse(faqResponse, targetLanguage);
            } else {
                botManagerResponse = faqResponse;
            }
            
            if (botManagerResponse.text && chatContext.currentConversationSession) {
                await persistSessionState(
                    sessionId, 
                    userContext, 
                    chatContext.currentConversationSession, 
                    undefined,
                    parsedMessage.text, 
                    botManagerResponse.text
                );
            }
        }

        console.log(`${LOG_PREFIX} Bot Manager generated response for ${parsedMessage.senderId}.`);

        if (botManagerResponse && botManagerResponse.text && botManagerResponse.text.trim()) {
          const sender = new WhatsappSender();
          try {
            console.log(`${LOG_PREFIX} Attempting to send reply to ${parsedMessage.senderId}: "${botManagerResponse.text}"`);
            await sender.sendMessage(parsedMessage.senderId, botManagerResponse); 
            console.log(`${LOG_PREFIX} Reply successfully sent via WhatsappSender to ${parsedMessage.senderId}.`);
          } catch (sendError) {
            console.error(`${LOG_PREFIX} Error sending reply via WhatsappSender to ${parsedMessage.senderId}:`, sendError);
          }
        } else {
          if (botManagerResponse && !botManagerResponse.text?.trim()) {
            console.log(`${LOG_PREFIX} Bot Manager returned empty response - not sending message to ${parsedMessage.senderId}.`);
          } else {
            console.log(`${LOG_PREFIX} No text in Bot Manager Response to send for ${parsedMessage.senderId}.`);
          }
        }
      } catch (botError) {
        console.error(`${LOG_PREFIX} Error processing message with Bot Manager for ${parsedMessage.senderId}:`, botError);
      }
    } else {
      let reason = "Payload could not be parsed into an actionable message.";
      if (parsedEvent && "id" in parsedEvent) {
        reason = `Received a status update for message ${parsedEvent.id}, not an incoming message.`;
      }
      console.log(`${LOG_PREFIX} Skipping processing: ${reason}. Full parsed event:`, parsedEvent ? JSON.stringify(parsedEvent, null, 2) : "null");
    }
    
    return NextResponse.json({ status: "success - acknowledged by juan-bot v2" }, { status: 200 });

  } catch (error) {
    console.error(`${LOG_PREFIX} Critical error processing POST request for juan-bot:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Internal server error in juan-bot webhook" }, { status: 500 });
  }
} 

async function translateBotResponse(response: BotResponse, targetLanguage: string): Promise<BotResponse> {
    const llmService = new IntelligentLLMService();
    const textsToTranslate: string[] = [];

    if (response.text) {
        textsToTranslate.push(response.text);
    }
    if (response.listActionText) {
        textsToTranslate.push(response.listActionText);
    }
    if (response.listSectionTitle) {
        textsToTranslate.push(response.listSectionTitle);
    }
    response.buttons?.forEach(btn => {
        if (btn.buttonText) {
            textsToTranslate.push(btn.buttonText);
        }
        if (btn.buttonDescription) {
            textsToTranslate.push(btn.buttonDescription);
        }
    });

    if (textsToTranslate.length === 0) {
        return response;
    }

    try {
        const translatedTexts = await llmService.translate(textsToTranslate, targetLanguage) as string[];
        
        const mutableTranslatedTexts = [...translatedTexts];

        let translatedText = response.text;
        if (response.text) {
            translatedText = mutableTranslatedTexts.shift() || response.text;
        }

        let translatedListActionText = response.listActionText;
        if (response.listActionText) {
            translatedListActionText = mutableTranslatedTexts.shift() || response.listActionText;
        }

        let translatedListSectionTitle = response.listSectionTitle;
        if (response.listSectionTitle) {
            translatedListSectionTitle = mutableTranslatedTexts.shift() || response.listSectionTitle;
        }

        const translatedButtons = response.buttons?.map(btn => {
            const newBtn = { ...btn };
            if (newBtn.buttonText) {
                newBtn.buttonText = mutableTranslatedTexts.shift() || newBtn.buttonText;
            }
            if (newBtn.buttonDescription) {
                newBtn.buttonDescription = mutableTranslatedTexts.shift() || newBtn.buttonDescription;
            }
            return newBtn;
        });

        return { 
            text: translatedText, 
            buttons: translatedButtons,
            listActionText: translatedListActionText,
            listSectionTitle: translatedListSectionTitle
        };
    } catch (error) {
        console.error(`${LOG_PREFIX} Error translating bot response:`, error);
        return response; // Return original on error
    }
} 