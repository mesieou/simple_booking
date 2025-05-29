import { executeChatCompletion, ChatMessage } from "../openai-core";
import { DocumentCategory, VALID_CATEGORIES } from "@/lib/config/config";

export interface ClientNeedResult {
  need_type: 'general' | 'specific';
  category?: DocumentCategory;
  intent: string;
  confidence: number;
}

/**
 * Analyzes a client's message to determine their needs and intentions
 */
export async function analyzeClientNeed(
  message: string,
  history: ChatMessage[] = []
): Promise<ClientNeedResult> {
  try {
    const systemPrompt = `You are an expert at understanding client needs and intentions in conversations.
Your task is to analyze the client's message and determine:
1. If it's a general conversation starter or has a specific need
2. What category of need it falls into (if specific)
3. The underlying intent of the message

If the message has a specific need, categorize it into EXACTLY one of these categories:
${VALID_CATEGORIES.map(cat => `- ${cat}`).join('\n')}

Consider the following when analyzing:
- Cultural context and natural conversation flow
- Implicit needs that might not be directly stated
- The tone and formality of the message
- Previous conversation context if available

Respond in this JSON format:
{
  "need_type": "general" | "specific",
  "category": "one of the categories above (only if specific)",
  "intent": "string describing the underlying intention",
  "confidence": number (0-1)
}`;

    // Format the conversation history for context
    const formattedHistory = history
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Current conversation history:
${formattedHistory}

Client's message:
"${message}"

Analyze the client's need and intention.`;

    const response = await executeChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], "gpt-4o", 0.3, 500);

    const resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) {
      return {
        need_type: 'general',
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
          jsonText = resultText.replace(/```json|```/g, '').trim();
        }
      }

      const result = JSON.parse(jsonText) as ClientNeedResult;
      
      // Validate and normalize the result
      return {
        need_type: result.need_type === 'specific' ? 'specific' : 'general',
        category: result.category as DocumentCategory | undefined,
        intent: result.intent || 'unknown',
        confidence: typeof result.confidence === 'number' ? 
          Math.max(0, Math.min(1, result.confidence)) : 0.5
      };
    } catch (parseError) {
      console.error('Error parsing client need result:', parseError);
      return {
        need_type: 'general',
        intent: 'unknown',
        confidence: 0
      };
    }
  } catch (error) {
    console.error('Error analyzing client need:', error);
    return {
      need_type: 'general',
      intent: 'unknown',
      confidence: 0
    };
  }
} 