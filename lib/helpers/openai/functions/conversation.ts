import { executeChatCompletion, ChatMessage, ChatResponse } from "../openai-core";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/bot/content-crawler/config";

const CATEGORY_COUNT = Object.keys(Category).length / 2; // Divide by 2 because enum has both numeric and string keys

export async function detectConversationCategory(
  conversation: { role: 'user' | 'assistant', content: string }[],
  categories: Category[]
): Promise<Category | undefined> {
  const prompt = `You are an expert assistant. Given the following conversation, select the best matching category from this list:\n${categories.map(c => `- ${CATEGORY_DISPLAY_NAMES[c]}`).join('\n')}\n\nConversation:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nReturn ONLY the category number (0-${CATEGORY_COUNT - 1}), nothing else.`;

  const response = await executeChatCompletion([
    { role: 'system', content: 'You are a helpful assistant that categorizes conversations.' },
    { role: 'user', content: prompt }
  ], 'gpt-4o', 0.3, 256);

  const result = response.choices[0]?.message?.content?.trim();
  if (!result) return undefined;
  
  // Parse the category number
  const categoryNum = parseInt(result);
  if (isNaN(categoryNum) || categoryNum < 0 || categoryNum >= CATEGORY_COUNT) return undefined;
  
  return categoryNum as Category;
}

/**
 * Response from the message clarity check
 */
export interface ClarityCheckResult {
  is_answerable: boolean;
  category: Category;
  confidence: number;
  clarification_prompt: string | null;
}

/**
 * Checks if a message can be answered reliably given the conversation context
 * 
 * @param message The user message to check
 * @param history Previous messages in the conversation
 * @returns Promise resolving to a ClarityCheckResult
 */
export async function checkMessageAnswerability(
  message: string,
  history: ChatMessage[] = []
): Promise<ClarityCheckResult> {
  try {
    // Format the history for context, takes last 5 messages
    const formattedHistory = history.length > 0
      ? history
          .slice(-5) // Limit to last 5 messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : 'No previous conversation.';

    // Create the categories list for the prompt
    const categoriesList = Object.entries(CATEGORY_DISPLAY_NAMES)
      .map(([num, name]) => `${num}: ${name}`)
      .join(', ');
    
    // Create the system prompt
    const systemPrompt = 
      `You are a clarity validator for a customer service chatbot for a moving company. Your task is to:
      1. Determine whether the user's most recent message can be answered reliably using the current conversation context.
      2. If the message is too vague or ambiguous, classify it as "not answerable".
      3. Also, classify the user's message into one of the following categories (return the number):
      [${categoriesList}]
      4. Provide a confidence score between 0 and 1 (where 1 is highest confidence)
      5. If the message is not answerable, provide a natural-sounding clarification question

      Only respond in this JSON format:
      {
        "is_answerable": true | false,
        "category": number (0-${CATEGORY_COUNT - 1}),
        "confidence": 0.1 to 1.0,
        "clarification_prompt": "If not answerable, return a clarification question, otherwise null"
      }`;

    // Create the user prompt with message and history
    const userPrompt = 
      `Current conversation history:
      ${formattedHistory}

      User's most recent message:
      "${message}"

      Analyze if this message can be answered reliably with the given context.`;

    // Call OpenAI
    const response = await executeChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], "gpt-4o", 0.3, 500);

    // Parse the response
    const resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) {
      return getDefaultClarityResult();
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

      const result = JSON.parse(jsonText) as { 
        is_answerable: boolean;
        category: number;
        confidence: number;
        clarification_prompt: string | null;
      };
      
      // Validate and normalize the result
      return {
        is_answerable: typeof result.is_answerable === 'boolean' ? result.is_answerable : false,
        category: validateCategory(result.category),
        confidence: typeof result.confidence === 'number' ? 
          Math.max(0, Math.min(1, result.confidence)) : 0.5,
        clarification_prompt: result.clarification_prompt || null
      };
    } catch (parseError) {
      console.error('Error parsing clarity check result:', parseError);
      return getDefaultClarityResult();
    }
  } catch (error) {
    console.error('Error checking message clarity:', error);
    return getDefaultClarityResult();
  }
}

/**
 * Validates and normalizes a category number
 */
function validateCategory(category: number): Category {
  if (typeof category !== 'number' || category < 0 || category >= CATEGORY_COUNT) {
    return Category.SERVICES_OFFERED; // Default category
  }
  return category as Category;
}

/**
 * Returns a default result when processing fails
 */
function getDefaultClarityResult(): ClarityCheckResult {
  return {
    is_answerable: true, // Default to answerable to avoid excessive clarification
    category: Category.SERVICES_OFFERED,
    confidence: 0.5,
    clarification_prompt: null
  };
} 