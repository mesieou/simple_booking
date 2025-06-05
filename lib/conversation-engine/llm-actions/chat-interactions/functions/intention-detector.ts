import { executeChatCompletion, ChatMessage } from "@/lib/conversation-engine/llm-actions/chat-interactions/openai-config/openai-core";
import { VALID_INTENTS, ValidIntent } from "@/lib/general-config/general-config";

export interface ClientIntentResult {
  intent: ValidIntent | 'unknown'; // Added 'unknown' for fallback cases
  confidence: number;
}


/**
 * Analyzes a client's message to determine their primary intent.
 */
export async function detectClientIntent(
  message: string,
  history: ChatMessage[] = []
): Promise<ClientIntentResult> {
  try {
    const systemPrompt = `You are an expert at understanding client intentions in conversations.
Your task is to analyze the client's message and determine its primary intent.

Categorize the message into EXACTLY one of these intents:
${VALID_INTENTS.map(val => `- ${val}`).join('\n')}

Consider the following when analyzing:
- Cultural context and natural conversation flow
- Implicit needs that might not be directly stated
- The tone and formality of the message
- Previous conversation context if available

Respond in this JSON format:
{
  "intent": "one of the intents listed above",
  "confidence": "number (0-1 representing the confidence of the classification)"
}`;

    // Format the conversation history for context
    const formattedHistory = history
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Current conversation history:
${formattedHistory}

Client's message:
"${message}"

Analyze the client's intent.`;

    const response = await executeChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], "gpt-4o", 0.3, 150); // Reduced max tokens as the response is simpler

    const resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) {
      console.warn('LLM returned empty or no content for intent detection.');
      return {
        intent: 'unknown',
        confidence: 0
      };
    }

    try {
      // Extract JSON from the response if needed
      let jsonText = resultText;
      if (resultText.includes('```')) {
        const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim();
        } else {
          // Fallback for cases where regex might miss, or simple ``` wrapping
          jsonText = resultText.replace(/```json|```/g, '').trim();
        }
      }

      const parsedResult = JSON.parse(jsonText) as Partial<ClientIntentResult>;
      
      // Validate and normalize the result
      let finalIntent: ValidIntent | 'unknown' = 'unknown';
      if (parsedResult.intent && VALID_INTENTS.includes(parsedResult.intent as ValidIntent)) {
        finalIntent = parsedResult.intent as ValidIntent;
      } else if (parsedResult.intent) {
        console.warn(`LLM returned an invalid intent: '${parsedResult.intent}'. Falling back to 'unknown'.`);
      } else {
        console.warn(`LLM response did not contain an intent. Full response: ${resultText}`);
      }
      
      const confidence = typeof parsedResult.confidence === 'number' ? 
        Math.max(0, Math.min(1, parsedResult.confidence)) : 0.5; // Default confidence if not provided or invalid

      if (finalIntent === 'unknown' && confidence === 0.5) {
         // If intent became 'unknown' due to parsing/validation issues, and confidence is default, it might indicate a problem.
         console.warn(`Intent classified as 'unknown' with default confidence. Review LLM response: ${resultText}`);
      }

      return {
        intent: finalIntent,
        confidence: confidence
      };
    } catch (parseError) {
      console.error('Error parsing client intent result from LLM:', parseError, `Raw text: "${resultText}"`);
      return {
        intent: 'unknown',
        confidence: 0
      };
    }
  } catch (error) {
    console.error('Error detecting client intent:', error);
    return {
      intent: 'unknown',
      confidence: 0
    };
  }
} 