import { BotResponse } from '@/lib/cross-channel-interfaces/standardized-conversation-interface';
import { ChatContext, ConversationalParticipant } from '@/lib/bot-engine/types';
import { UserContext } from '@/lib/database/models/user-context';
import { ChatMessage } from '@/lib/database/models/chat-session';
import { analyzeSentiment } from '@/lib/shared/llm/functions/sentiment-analiser';
import { executeChatCompletion } from '@/lib/shared/llm/openai/openai-core';
import { BOOKING_TRANSLATIONS } from '@/lib/bot-engine/config/translations';
import { 
  type EscalationTrigger,
  type EscalationResult,
  type FrustrationAnalysis,
  ESCALATION_CONSTANTS 
} from './types';

const LOG_PREFIX = '[EscalationDetector]';

/**
 * Detects if a message contains media content that should trigger escalation
 * (excludes stickers and audios as they should not trigger escalation)
 */
export function hasMediaContent(message: string): boolean {
  // Check if message contains media placeholders added by the parser
  // Stickers and audios are excluded as they should not trigger escalation
  // Audio messages are handled by the audio transcription module
  const mediaPlaceholders = ['[IMAGE]', '[VIDEO]', '[DOCUMENT]'];
  return mediaPlaceholders.some(placeholder => message.includes(placeholder));
}

/**
 * Detects if a message contains only a sticker
 */
export function hasStickerContent(message: string): boolean {
  return message.includes('[STICKER]');
}

/**
 * Uses AI to detect if a message is requesting human assistance
 */
export async function detectHumanAssistanceRequest(message: string): Promise<boolean> {
  try {
    const prompt = `Analyze the following message and determine if the user is requesting to speak with a human agent, customer service representative, or any form of human assistance.

Return only "true" if the message is clearly requesting human assistance, or "false" if it's not.

Examples of human assistance requests:
- "I want to speak to a person"
- "Can I talk to someone?"
- "I need human help"
- "Connect me to an agent"
- "I want customer service"
- "Can you transfer me to a human?"
- "Quiero hablar con una persona"
- "Necesito ayuda humana"
- "¿Puedo hablar con alguien?"

Examples of NOT human assistance requests:
- "I need help with booking"
- "Can you help me?"
- "I have a question"
- "What services do you offer?"
- "How much does it cost?"

Message: "${message}"

Return only "true" or "false":`;

    const response = await executeChatCompletion([
      {
        role: "system" as const,
        content: "You are a precise intent detection system. Return only 'true' or 'false' based on whether the message is requesting human assistance."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ], "gpt-4o", 0.1, 10);

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`${LOG_PREFIX} AI Human assistance detection result for "${message}": ${result}`);
    
    return result === 'true';
  } catch (error) {
    console.error(`${LOG_PREFIX} Error in AI human assistance detection:`, error);
    return false;
  }
}

/**
 * Analyzes recent message history for frustration patterns using sentiment analysis
 */
export async function analyzeFrustrationPattern(
  currentMessage: string,
  messageHistory: ChatMessage[],
  currentContext: ChatContext
): Promise<FrustrationAnalysis> {
  try {
    // Analyze sentiment of current message
    const currentSentiment = await analyzeSentiment(currentMessage);
    
    if (!currentSentiment) {
      console.log(`${LOG_PREFIX} Could not analyze sentiment for current message`);
      return { shouldEscalate: false, consecutiveFrustratedMessages: 0 };
    }

    console.log(`${LOG_PREFIX} Current message sentiment:`, currentSentiment);

    // Find the last staff message to reset frustration tracking
    const recentMessages = messageHistory.slice(-15);
    let lastStaffMessageIndex = -1;
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      if (recentMessages[i].role === 'staff') {
        lastStaffMessageIndex = i;
        break;
      }
    }

    // Get messages to analyze (after last staff intervention)
    const messagesToAnalyze = lastStaffMessageIndex >= 0 
      ? recentMessages.slice(lastStaffMessageIndex + 1)
      : recentMessages.slice(-10); // Last 10 messages if no staff intervention

    // Count consecutive frustrated messages (including current one if frustrated)
    let consecutiveFrustratedCount = 0;
    
    // Check if current message is frustrated
    if (currentSentiment.category === 'frustrated') {
      consecutiveFrustratedCount = 1;
      
      // Check previous messages (in reverse order) for consecutive frustration
      for (let i = messagesToAnalyze.length - 1; i >= 0; i--) {
        const msg = messagesToAnalyze[i];
        
        // Only analyze user messages that are strings
        if (msg.role === 'user' && typeof msg.content === 'string' && msg.content !== currentMessage) {
          const msgSentiment = await analyzeSentiment(msg.content);
          if (msgSentiment && msgSentiment.category === 'frustrated') {
            consecutiveFrustratedCount++;
          } else {
            break; // Stop counting if we find a non-frustrated message
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} Consecutive frustrated messages: ${consecutiveFrustratedCount}`);

    // Escalate if 3 or more consecutive frustrated messages
    const shouldEscalate = consecutiveFrustratedCount >= 3;

    return { shouldEscalate, consecutiveFrustratedMessages: consecutiveFrustratedCount };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error analyzing frustration pattern:`, error);
    return { shouldEscalate: false, consecutiveFrustratedMessages: 0 };
  }
}

/**
 * Main escalation detection logic - determines if a message should trigger escalation
 */
export async function detectEscalationTrigger(
  incomingUserMessage: string,
  currentContext: ChatContext,
  messageHistory: ChatMessage[]
): Promise<EscalationTrigger> {
  console.log(`${LOG_PREFIX} Starting AI-powered escalation analysis for: "${incomingUserMessage}"`);

  // 1. Check for media content first (highest priority)
  const hasMedia = hasMediaContent(incomingUserMessage);
  
  if (hasMedia) {
    console.log(`${LOG_PREFIX} Media content detected in message: "${incomingUserMessage}"`);
    
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    return {
      shouldEscalate: true,
      reason: 'media_redirect',
      customMessage: BOOKING_TRANSLATIONS[language].ESCALATION.MEDIA_REDIRECT_RESPONSE
    };
  }

  // 2. Check for explicit human assistance requests using AI
  const isHumanRequest = await detectHumanAssistanceRequest(incomingUserMessage);
  
  if (isHumanRequest) {
    console.log(`${LOG_PREFIX} AI detected explicit human assistance request`);
    return {
      shouldEscalate: true,
      reason: 'human_request'
    };
  }

  // 3. Check for frustration patterns using sentiment analysis
  const frustrationAnalysis = await analyzeFrustrationPattern(
    incomingUserMessage,
    messageHistory,
    currentContext
  );

  if (frustrationAnalysis.shouldEscalate) {
    console.log(`${LOG_PREFIX} Frustration pattern detected: ${frustrationAnalysis.consecutiveFrustratedMessages} consecutive frustrated messages`);
    
    const language = currentContext.participantPreferences.language === 'es' ? 'es' : 'en';
    return {
      shouldEscalate: true,
      reason: 'frustration',
      customMessage: BOOKING_TRANSLATIONS[language].ESCALATION.FRUSTRATION_DETECTED
    };
  }

  return { shouldEscalate: false };
} 