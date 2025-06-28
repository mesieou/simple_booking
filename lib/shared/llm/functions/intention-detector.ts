import { executeChatCompletion, OpenAIChatMessage } from "@/lib/shared/llm/openai/openai-core";
import { UserContext } from "@/lib/database/models/user-context";


export type GoalType = 'serviceBooking' | 'frequentlyAskedQuestion' | 'accountManagement' | 'generalChitChat' | 'unknown';

export type GoalAction = 'create' | 'update' | 'delete' | 'view' | 'none';

export interface AnalyzedIntent {
  goalType: GoalType;
  goalAction: GoalAction;
  contextSwitch: boolean; // Does this message indicate a change in topic?
  confidence: number;
  extractedInformation: Record<string, any>; // e.g., { "serviceName": "manicure" }
}

/**
 * Analyzes the user's message in the context of the ongoing conversation to determine their intent,
 * whether they are switching topics, and extracts key information.
 *
 * @param message The user's most recent message.
 * @param history A history of the conversation messages.
 * @param userContext The current state of the user's interaction, including any active goals.
 * @returns An `AnalyzedIntent` object with the results of the analysis.
 */
export async function analyzeConversationIntent(
  message: string,
  history: OpenAIChatMessage[],
  userContext: UserContext | null
): Promise<AnalyzedIntent> {

  const systemPrompt = `You are a world-class conversational analyst AI. Your primary task is to analyze a user's message within the context of an ongoing conversation and provide a structured JSON output.

You must answer three core questions:
1.  **What is the user's primary goal?** (e.g., booking a service, asking a question).
2.  **Is this goal different from the current one?** This determines if the user is switching topics.
3.  **What specific data did the user provide?** Extract key entities like service names, dates, or questions.

**Current Context:**
The user is currently in the middle of this task:
- Goal: ${userContext?.currentGoal?.goalType || 'none'}
- Step: ${userContext?.currentGoal?.flowKey ? userContext.currentGoal.flowKey + ' (step ' + userContext.currentGoal.currentStepIndex + ')' : 'none'}
- Data collected so far: ${JSON.stringify(userContext?.currentGoal?.collectedData) || '{}'}

Based on this context, analyze the user's new message.

**JSON Output Schema:**
{
  "goalType": "'serviceBooking' | 'frequentlyAskedQuestion' | 'accountManagement' | 'generalChitChat' | 'unknown'",
  "goalAction": "'create' | 'update' | 'delete' | 'view' | 'none'",
  "contextSwitch": "boolean // true if the new goalType is DIFFERENT from the current goal, or if the user explicitly wants to cancel/go back.",
  "confidence": "number // 0.0 to 1.0 confidence in your analysis.",
  "extractedInformation": "object // Key-value pairs of extracted data, e.g., {\"serviceName\": \"manicure\"} or {\"question\": \"opening hours\"}."
}

**Analysis Rules:**
- **Context is King:** If the user was asked a question (e.g., 'What is your address?'), and their reply provides that info, the 'goalType' should remain the same and 'contextSwitch' must be false.
- **Detecting a Switch:** If the current goal is 'serviceBooking' and the user suddenly asks 'What are your prices?', the 'goalType' becomes 'frequentlyAskedQuestion' and 'contextSwitch' must be true.
- **Default to Booking:** If the current 'Goal' is 'none' (this is a new conversation), and the user's message is a greeting (hello, hi), a simple question ('how are you?'), or any non-specific opening, you **must** set the 'goalType' to 'serviceBooking' and 'goalAction' to 'create'. This is the primary entry point for the business bot.
- **Chit-Chat During a Goal:** If there is already an active 'Goal' (e.g., user is mid-booking), and the user says 'hello', 'thanks', 'ok', etc., you should classify this as 'generalChitChat' with 'contextSwitch: false', as it does not interrupt the current flow.
- **Implicit Intent:** A user might not state their intent directly. Infer it from their words and the context.
- **No Data:** If no specific data is extracted, return an empty object for 'extractedInformation'.`;

  const formattedHistory = history
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  const userPrompt = `Here is the recent conversation history:
${formattedHistory}

Here is the user's new message:
"${message}"

Analyze the intent and provide the JSON output.`;

  try {
    const response = await executeChatCompletion(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      "gpt-4o",
      0.2, // Low temperature for consistent JSON
      250  // Max tokens for a structured JSON response
    );

    const resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) {
      console.warn('[analyzeConversationIntent] LLM returned empty content.');
      return getFallbackIntent();
    }

    // --- New, Robust Parsing Logic ---
    try {
      let jsonText = resultText;
      if (resultText.includes('```')) {
        jsonText = resultText.substring(resultText.indexOf('{'), resultText.lastIndexOf('}') + 1);
      }

      const parsedResult = JSON.parse(jsonText) as Partial<AnalyzedIntent>;

      // Validate and provide defaults for a safe return value
      const finalIntent: AnalyzedIntent = {
        goalType: ['serviceBooking', 'frequentlyAskedQuestion', 'accountManagement', 'generalChitChat'].includes(parsedResult.goalType as string) ? parsedResult.goalType as GoalType : 'unknown',
        goalAction: ['create', 'update', 'delete', 'view'].includes(parsedResult.goalAction as string) ? parsedResult.goalAction as GoalAction : 'none',
        contextSwitch: typeof parsedResult.contextSwitch === 'boolean' ? parsedResult.contextSwitch : false,
        confidence: typeof parsedResult.confidence === 'number' ? Math.max(0, Math.min(1, parsedResult.confidence)) : 0.5,
        extractedInformation: typeof parsedResult.extractedInformation === 'object' && parsedResult.extractedInformation !== null ? parsedResult.extractedInformation : {},
      };

      return finalIntent;

    } catch (parseError) {
      console.error('[analyzeConversationIntent] Error parsing LLM JSON response:', parseError, `Raw text: "${resultText}"`);
      return getFallbackIntent();
    }

  } catch (error) {
    console.error('[analyzeConversationIntent] Error during LLM call:', error);
    return getFallbackIntent();
  }
}

/**
 * Provides a default, safe-to-use intent object when analysis fails.
 */
function getFallbackIntent(): AnalyzedIntent {
  return {
    goalType: 'unknown',
    goalAction: 'none',
    contextSwitch: false,
    confidence: 0,
    extractedInformation: {},
  };
} 