import { franc } from 'franc-min';
import { ChatContext } from '../types';
import { executeChatCompletion } from '@/lib/shared/llm/openai/openai-core';
import { conversationFlowBlueprints } from '@/lib/bot-engine/config/blueprints';

export interface LanguageDetectionResult {
  detectedLanguage: string;
  wasChanged: boolean;
  previousLanguage?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export class LanguageDetectionService {
  private static readonly SUPPORTED_LANGUAGES = ['en', 'es'];
  private static readonly MIN_MESSAGE_LENGTH_FOR_DETECTION = 8;
  private static readonly DEFAULT_LANGUAGE = 'en';
  private static readonly MIN_CONFIDENCE_FOR_SWITCH = 0.8;

  /**
   * Simplified language detection that only runs on human messages
   * Once language is detected and set, it persists unless explicitly changed by human input
   */
  static async detectAndUpdateLanguage(
    message: string, 
    chatContext: ChatContext,
    logPrefix: string = '[LanguageDetection]'
  ): Promise<LanguageDetectionResult> {
    try {
      const existingLang = chatContext.participantPreferences.language || this.DEFAULT_LANGUAGE;
      
      // SKIP language detection during address collection steps
      if (this.shouldSkipLanguageDetection(chatContext)) {
        console.log(`${logPrefix} Skipping language detection for address collection step - preserving ${existingLang}`);
        
        // Ensure we have a language set
        if (!chatContext.participantPreferences.language) {
          chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        }

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'low',
          reason: 'Address collection step - language preserved'
        };
      }

      const messageLength = message.trim().length;

      // FIRST: Always skip system-generated messages completely
      if (this.isSystemGeneratedMessage(message)) {
        console.log(`${logPrefix} System message detected - using existing language: ${existingLang}`);
        
        // Ensure we have a language set
        if (!chatContext.participantPreferences.language) {
          chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        }

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'low',
          reason: 'System message - language preserved'
        };
      }

      // SECOND: If we already have a language set, be very conservative about changing it
      // Only change if it's a substantial human message with high confidence
      if (chatContext.participantPreferences.language) {
        console.log(`${logPrefix} Language already set to '${existingLang}' - being conservative`);
        
        // For short messages, always keep existing language
        if (messageLength <= this.MIN_MESSAGE_LENGTH_FOR_DETECTION) {
          console.log(`${logPrefix} Short message (${messageLength} chars) - preserving ${existingLang}`);
          return {
            detectedLanguage: existingLang,
            wasChanged: false,
            confidence: 'low',
            reason: 'Short message - language preserved'
          };
        }

        // For longer messages, only switch with very high confidence
        const detectionResult = await this.detectLanguageWithLLM(message);
        if (detectionResult.language && 
            detectionResult.language !== existingLang && 
            detectionResult.confidence >= this.MIN_CONFIDENCE_FOR_SWITCH) {
          
          console.log(`${logPrefix} High-confidence language switch: ${existingLang} → ${detectionResult.language}`);
          chatContext.participantPreferences.language = detectionResult.language;
          
          return {
            detectedLanguage: detectionResult.language,
            wasChanged: true,
            previousLanguage: existingLang,
            confidence: 'high',
            reason: `High-confidence switch (${detectionResult.confidence.toFixed(2)})`
          };
        } else {
          console.log(`${logPrefix} Insufficient confidence for language change - preserving ${existingLang}`);
          return {
            detectedLanguage: existingLang,
            wasChanged: false,
            confidence: 'medium',
            reason: 'Insufficient confidence for language change'
          };
        }
      }

      // THIRD: First-time language detection (no language set yet)
      console.log(`${logPrefix} First-time language detection for message: "${message.substring(0, 50)}..."`);
      
      if (messageLength <= this.MIN_MESSAGE_LENGTH_FOR_DETECTION) {
        console.log(`${logPrefix} First message too short - defaulting to ${this.DEFAULT_LANGUAGE}`);
        chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        
        return {
          detectedLanguage: this.DEFAULT_LANGUAGE,
          wasChanged: true,
          confidence: 'low',
          reason: 'First message too short - used default'
        };
      }

      const detectionResult = await this.detectLanguageWithLLM(message);
      const detectedLang = detectionResult.language || this.DEFAULT_LANGUAGE;
      
      console.log(`${logPrefix} First-time detection result: ${detectedLang} (confidence: ${detectionResult.confidence.toFixed(2)})`);
      
      chatContext.participantPreferences.language = detectedLang;
      
      return {
        detectedLanguage: detectedLang,
        wasChanged: true,
        confidence: detectionResult.confidence >= 0.7 ? 'high' : 'medium',
        reason: `Initial language detection: ${detectionResult.method}`
      };

    } catch (error) {
      console.error(`${logPrefix} Error in language detection:`, error);
      
      // Fallback: ensure we always have a language
      const fallbackLang = chatContext.participantPreferences.language || this.DEFAULT_LANGUAGE;
      if (!chatContext.participantPreferences.language) {
        chatContext.participantPreferences.language = fallbackLang;
      }

      return {
        detectedLanguage: fallbackLang,
        wasChanged: false,
        confidence: 'low',
        reason: `Error fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the current language without any detection logic
   */
  static getCurrentLanguage(chatContext: ChatContext): string {
    return chatContext.participantPreferences.language || this.DEFAULT_LANGUAGE;
  }

  /**
   * Force set a language (for testing or admin purposes)
   */
  static setLanguage(chatContext: ChatContext, language: string, logPrefix: string = '[LanguageDetection]'): void {
    console.log(`${logPrefix} Manually setting language to: ${language}`);
    chatContext.participantPreferences.language = language;
  }

  /**
   * Reset to default language
   */
  static resetToDefault(chatContext: ChatContext, logPrefix: string = '[LanguageDetection]'): void {
    console.log(`${logPrefix} Resetting language to default: ${this.DEFAULT_LANGUAGE}`);
    chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
  }

  /**
   * Comprehensive detection of system-generated messages
   * This covers ALL possible button/system payloads to prevent language detection corruption
   */
  private static isSystemGeneratedMessage(message: string): boolean {
    const trimmedMessage = message.trim();
    
    // UUID pattern (e.g., "ba203e4d-dae8-4072-9633-438861d69de9")
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(trimmedMessage)) {
      return true;
    }
    
    // Button payload patterns - be comprehensive to catch all system messages
    const systemPatterns = [
      // Time slot patterns
      /^slot_\d+_/, 
      // Date patterns  
      /^day_\d{4}-\d{2}-\d{2}$/,
      // Standard button values
      /^(choose_another_day|choose_different_date|contact_support|confirm_quote|edit_quote|contact_us|try_again|no_availability)$/,
      // Time display patterns (12 PM, 1 AM, etc.)
      /^\d{1,2}(?::\d{2})?\s*[AP]M?$/i,
      // Any single word with underscores (likely system codes)
      /^[a-zA-Z0-9_-]+$/
    ];
    
    return systemPatterns.some(pattern => pattern.test(trimmedMessage));
  }

  /**
   * LLM-based language detection - our primary and most accurate method
   */
  private static async detectLanguageWithLLM(message: string): Promise<{ 
    language: string | null; 
    confidence: number; 
    method: string 
  }> {
    const systemPrompt = `You are a language detection expert. Analyze messages and determine if they're written in English or Spanish.

IMPORTANT: Only detect clear, unambiguous language usage. Be conservative.

Guidelines:
- Look for clear vocabulary, grammar, and sentence structure
- Consider common greetings, question words, and phrases
- If the message is ambiguous or unclear, return lower confidence
- Focus on natural human language patterns

Respond with ONLY a JSON object:
{
  "language": "en" or "es",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation"
}

Examples:
- "hello can i make a reservation" → {"language": "en", "confidence": 0.95, "reasoning": "Clear English vocabulary and structure"}
- "hola quiero hacer una reserva" → {"language": "es", "confidence": 0.95, "reasoning": "Clear Spanish vocabulary and structure"}
- "yes" → {"language": "en", "confidence": 0.6, "reasoning": "English word but very short"}
- "si" → {"language": "es", "confidence": 0.6, "reasoning": "Spanish word but could be ambiguous"}`;

    const userPrompt = `Analyze this message: "${message}"`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        "gpt-4o-mini",
        0.2, // Very low temperature for consistent results
        100  // Short response
      );

      const resultText = response.choices[0]?.message?.content?.trim();
      if (!resultText) {
        return { language: null, confidence: 0, method: 'llm-no-response' };
      }

      // Parse JSON response
      let jsonText = resultText;
      if (resultText.includes('```')) {
        const jsonStart = resultText.indexOf('{');
        const jsonEnd = resultText.lastIndexOf('}') + 1;
        jsonText = resultText.substring(jsonStart, jsonEnd);
      }

      const result = JSON.parse(jsonText);
      
      if (result.language && ['en', 'es'].includes(result.language) && 
          typeof result.confidence === 'number') {
        return {
          language: result.language,
          confidence: Math.max(0, Math.min(1, result.confidence)),
          method: `llm-ai (${result.reasoning || 'AI analysis'})`
        };
      }
      
      return { language: null, confidence: 0, method: 'llm-invalid-response' };
    } catch (error) {
      console.error('[LanguageDetection] LLM error:', error);
      return { language: null, confidence: 0, method: 'llm-error' };
    }
  }

  /**
   * Determines if language detection should be skipped based on current conversation step
   */
  private static shouldSkipLanguageDetection(chatContext: ChatContext): boolean {
    // Check if user is in an active booking goal
    const activeGoal = chatContext.currentConversationSession?.activeGoals?.find(g => g.goalStatus === 'inProgress');
    
    if (!activeGoal) {
      return false;
    }

    // Get current step name from blueprints
    const currentStepName = conversationFlowBlueprints[activeGoal.flowKey]?.[activeGoal.currentStepIndex];
    
    // Skip language detection for address-related steps
    const addressSteps = [
      'askPickupAddress',
      'askDropoffAddress', 
      'validateAddress'
    ];
    
    return addressSteps.includes(currentStepName);
  }
} 