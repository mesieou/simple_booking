import { franc } from 'franc-min';
import { ChatContext } from '../bot-manager';
import { executeChatCompletion } from '@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core';

export interface LanguageDetectionResult {
  detectedLanguage: string;
  wasChanged: boolean;
  previousLanguage?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export class LanguageDetectionService {
  private static readonly SUPPORTED_LANGUAGES = ['en', 'es'];
  private static readonly MIN_MESSAGE_LENGTH_FOR_DETECTION = 4;
  private static readonly DEFAULT_LANGUAGE = 'en';
  private static readonly MIN_CONFIDENCE_FOR_SWITCH = 0.3;

  /**
   * Centralized language detection that all parts of the system should use
   * Handles bidirectional switching between English and Spanish
   */
  static async detectAndUpdateLanguage(
    message: string, 
    chatContext: ChatContext,
    logPrefix: string = '[LanguageDetection]'
  ): Promise<LanguageDetectionResult> {
    try {
      const existingLang = chatContext.participantPreferences.language || this.DEFAULT_LANGUAGE;
      const messageLength = message.trim().length;

      // For very short messages, don't change language to prevent accidental switches
      if (messageLength <= this.MIN_MESSAGE_LENGTH_FOR_DETECTION) {
        console.log(`${logPrefix} Short message (${messageLength} chars) - maintaining existing language: ${existingLang}`);
        
        // Ensure we have a language set
        if (!chatContext.participantPreferences.language) {
          chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        }

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'low',
          reason: 'Message too short for reliable detection'
        };
      }

      // Smart LLM-based language detection
      const detectionResult = await this.detectLanguageMultiApproach(message);
      const detectedLang = detectionResult.language;
      const confidence = detectionResult.confidence;

      console.log(`${logPrefix} Language detection: ${detectedLang} (confidence: ${confidence.toFixed(2)}, method: ${detectionResult.method})`);

      // Only switch languages if confidence is high enough
      if (!detectedLang || !this.SUPPORTED_LANGUAGES.includes(detectedLang)) {
        console.log(`${logPrefix} Unsupported or low-confidence language detection - maintaining existing: ${existingLang}`);
        
        if (!chatContext.participantPreferences.language) {
          chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        }

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'low',
          reason: `Low confidence detection: ${detectedLang || 'unknown'}`
        };
      }

      // Only switch if confidence is above threshold
      if (confidence < this.MIN_CONFIDENCE_FOR_SWITCH) {
        console.log(`${logPrefix} Detection confidence too low (${confidence.toFixed(2)}) - maintaining existing: ${existingLang}`);
        
        if (!chatContext.participantPreferences.language) {
          chatContext.participantPreferences.language = this.DEFAULT_LANGUAGE;
        }

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'low',
          reason: `Confidence below threshold: ${confidence.toFixed(2)}`
        };
      }

      // Check if language actually changed
      if (detectedLang !== existingLang) {
        console.log(`${logPrefix} Language preference changed from '${existingLang}' to '${detectedLang}' based on message: "${message.substring(0, 50)}..."`);
        chatContext.participantPreferences.language = detectedLang;

        return {
          detectedLanguage: detectedLang,
          wasChanged: true,
          previousLanguage: existingLang,
          confidence: 'high',
          reason: `Language switched based on message content`
        };
      } else {
        console.log(`${logPrefix} Language preference maintained: ${existingLang}`);

        return {
          detectedLanguage: existingLang,
          wasChanged: false,
          confidence: 'high',
          reason: 'Detected language matches existing preference'
        };
      }

    } catch (error) {
      console.error(`${logPrefix} Error detecting language:`, error);
      
      // Fallback to ensure we always have a language
      const fallbackLang = chatContext.participantPreferences.language || this.DEFAULT_LANGUAGE;
      if (!chatContext.participantPreferences.language) {
        chatContext.participantPreferences.language = fallbackLang;
      }

      return {
        detectedLanguage: fallbackLang,
        wasChanged: false,
        confidence: 'low',
        reason: `Error during detection: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the current language without changing it
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
   * Smart LLM-based language detection with franc fallback
   * Returns language with confidence score and method used
   */
  private static async detectLanguageMultiApproach(message: string): Promise<{ 
    language: string | null; 
    confidence: number; 
    method: string 
  }> {
    // Try LLM detection first (most accurate)
    try {
      const llmResult = await this.detectWithLLM(message);
      if (llmResult.language && llmResult.confidence > 0.7) {
        return llmResult;
      }
    } catch (error) {
      console.warn('[LanguageDetection] LLM detection failed, falling back to franc:', error);
    }

    // Fallback to franc with improved mapping
    return this.detectWithFrancImproved(message);
  }

  /**
   * Use LLM for intelligent language detection
   */
  private static async detectWithLLM(message: string): Promise<{ 
    language: string | null; 
    confidence: number; 
    method: string 
  }> {
    const systemPrompt = `You are a language detection expert. Analyze messages and determine if they're written in English or Spanish.

Consider:
- Grammar structure
- Vocabulary
- Context and intent
- Common phrases and expressions

Respond with ONLY a JSON object in this exact format:
{
  "language": "en" or "es",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation"
}

Examples:
- "hello can i make a reservation" → {"language": "en", "confidence": 0.95, "reasoning": "English greeting and vocabulary"}
- "hola quiero hacer una reserva" → {"language": "es", "confidence": 0.95, "reasoning": "Spanish greeting and vocabulary"}
- "si" → {"language": "es", "confidence": 0.6, "reasoning": "Spanish word but could be ambiguous"}`;

    const userPrompt = `Analyze this message: "${message}"`;

    try {
      const response = await executeChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        "gpt-4o-mini", // Use mini for simple language detection
        0.3, // Low temperature for consistent results
        150  // Short response needed
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
          confidence: result.confidence,
          method: `llm-ai (${result.reasoning || 'AI analysis'})`
        };
      }
      
      return { language: null, confidence: 0, method: 'llm-invalid-response' };
    } catch (error) {
      console.error('[LanguageDetection] LLM parsing error:', error);
      return { language: null, confidence: 0, method: 'llm-error' };
    }
  }

    /**
   * Improved franc-based detection as fallback
   */
  private static detectWithFrancImproved(message: string): { 
    language: string | null; 
    confidence: number; 
    method: string 
  } {
    try {
      const francResult = franc(message, { minLength: 2 });
      
      // Enhanced mapping including common misdetections
      const francMap: { [key: string]: string } = {
        'spa': 'es',
        'eng': 'en',
        'fra': 'en', // franc often misdetects English as French
        'ita': 'es', // Italian might be closer to Spanish for our use case
        'por': 'es'  // Portuguese might be closer to Spanish
      };

      const mappedLang = francMap[francResult];
      if (!mappedLang) {
        return { language: null, confidence: 0, method: 'franc-unsupported' };
      }

      // Calculate confidence based on message characteristics
      const messageLength = message.length;
      let confidence = 0.5; // Base confidence for franc

      // Increase confidence for longer messages
      if (messageLength > 10) confidence += 0.2;
      if (messageLength > 20) confidence += 0.1;
      
      // Specific heuristics for common cases
      if (francResult === 'eng' || (francResult === 'fra' && /\b(hello|hi|can|make|book|help|time|when)\b/i.test(message))) {
        confidence = Math.min(confidence + 0.3, 0.8);
      }
      
      if (francResult === 'spa' || /[ñáéíóúü]/.test(message)) {
        confidence = Math.min(confidence + 0.3, 0.8);
      }

      return {
        language: mappedLang,
        confidence: Math.min(confidence, 0.8), // Cap fallback confidence
        method: `franc-improved (${francResult})`
      };
    } catch {
      return { language: null, confidence: 0, method: 'franc-error' };
    }
  }
} 