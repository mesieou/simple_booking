import { executeChatCompletion, OpenAIChatMessage } from '../openai-core';

export interface ConfidenceEvaluation {
  confidence_score: number;
  confidence_reason: string;
  context_match_score: number;
  response_quality_score: number;
  missing_information: string[];
}

interface ContextMatch {
  score: number;
  matched_sections: string[];
  missing_sections: string[];
}

interface ResponseQuality {
  score: number;
  issues: string[];
  suggestions: string[];
}

/**
 * Evaluates how well the response matches the provided context
 */
async function evaluateContextMatch(
  bot_response: string,
  retrieved_context: string[]
): Promise<ContextMatch> {
  const systemPrompt = `You are a context matching evaluator. Your job is to:
1. Compare the bot's response against the provided context
2. Identify which parts of the response are supported by the context
3. Identify which parts of the response lack context support
4. Calculate a match score from 0.0 to 1.0

Respond in this JSON format:
{
  "score": 0.85,
  "matched_sections": ["list of response sections with context support"],
  "missing_sections": ["list of response sections without context support"]
}`;

  const userPrompt = `Bot Response: "${bot_response}"

Retrieved Context:
${retrieved_context.map((ctx, i) => `[${i + 1}] ${ctx}`).join('\n')}

Evaluate how well the response matches the context.`;

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const response = await executeChatCompletion(messages, "gpt-3.5-turbo", 0.3, 500);
  const resultText = response.choices[0]?.message?.content?.trim();

  if (!resultText) {
    return {
      score: 0.5,
      matched_sections: [],
      missing_sections: ["Unable to evaluate context match"]
    };
  }

  try {
    const result = JSON.parse(resultText) as ContextMatch;
    return {
      score: Math.max(0, Math.min(1, result.score)),
      matched_sections: result.matched_sections || [],
      missing_sections: result.missing_sections || []
    };
  } catch (error) {
    console.error('Error parsing context match result:', error);
    return {
      score: 0.5,
      matched_sections: [],
      missing_sections: ["Error parsing context match"]
    };
  }
}

/**
 * Evaluates the quality of the bot's response
 */
async function evaluateResponseQuality(
  user_message: string,
  bot_response: string
): Promise<ResponseQuality> {
  const systemPrompt = `You are a response quality evaluator. Your job is to:
1. Assess if the response directly addresses the user's question
2. Check for clarity, completeness, and professionalism
3. Identify any potential issues or improvements
4. Calculate a quality score from 0.0 to 1.0

Respond in this JSON format:
{
  "score": 0.9,
  "issues": ["list of any issues found"],
  "suggestions": ["list of improvement suggestions"]
}`;

  const userPrompt = `User Message: "${user_message}"

Bot Response: "${bot_response}"

Evaluate the quality of this response.`;

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const response = await executeChatCompletion(messages, "gpt-4o", 0.3, 500);
  const resultText = response.choices[0]?.message?.content?.trim();

  if (!resultText) {
    return {
      score: 0.5,
      issues: ["Unable to evaluate response quality"],
      suggestions: []
    };
  }

  try {
    const result = JSON.parse(resultText) as ResponseQuality;
    return {
      score: Math.max(0, Math.min(1, result.score)),
      issues: result.issues || [],
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error('Error parsing response quality result:', error);
    return {
      score: 0.5,
      issues: ["Error parsing response quality"],
      suggestions: []
    };
  }
}

/**
 * Main function to evaluate response confidence
 */
export async function evaluateResponseConfidence(
  user_message: string,
  bot_response: string,
  retrieved_context: string[]
): Promise<ConfidenceEvaluation> {
  try {
    // Run context match and response quality evaluations in parallel
    const [contextMatch, responseQuality] = await Promise.all([
      evaluateContextMatch(bot_response, retrieved_context),
      evaluateResponseQuality(user_message, bot_response)
    ]);

    // Calculate overall confidence score (weighted average)
    const overallScore = (contextMatch.score * 0.6) + (responseQuality.score * 0.4);

    // Generate confidence reason based on both evaluations
    const confidenceReason = generateConfidenceReason(
      contextMatch,
      responseQuality,
      overallScore
    );

    return {
      confidence_score: overallScore,
      confidence_reason: confidenceReason,
      context_match_score: contextMatch.score,
      response_quality_score: responseQuality.score,
      missing_information: contextMatch.missing_sections
    };
  } catch (error) {
    console.error('Error in confidence evaluation:', error);
    return {
      confidence_score: 0.5,
      confidence_reason: "Error during confidence evaluation",
      context_match_score: 0.5,
      response_quality_score: 0.5,
      missing_information: ["Error during evaluation"]
    };
  }
}

/**
 * Generates a human-readable confidence reason based on evaluation results
 */
function generateConfidenceReason(
  contextMatch: ContextMatch,
  responseQuality: ResponseQuality,
  overallScore: number
): string {
  const reasons: string[] = [];

  if (contextMatch.score < 0.7) {
    reasons.push("some information lacks context support");
  }
  if (responseQuality.score < 0.7) {
    reasons.push("response quality could be improved");
  }
  if (contextMatch.missing_sections.length > 0) {
    reasons.push("missing some context-supported details");
  }
  if (responseQuality.issues.length > 0) {
    reasons.push("has some quality issues");
  }

  if (reasons.length === 0) {
    return "Response is well-supported and of high quality";
  }

  return `Response ${reasons.join(", ")}`;
} 