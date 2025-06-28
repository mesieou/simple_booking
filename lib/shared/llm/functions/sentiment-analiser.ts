import { executeChatCompletion, ChatResponse, MoodAnalysisResult } from "../openai/openai-core";

export async function analyzeSentiment(text: string): Promise<MoodAnalysisResult | undefined> {
  try {
    const prompt = `Analyze the mood/sentiment of the following text and return a JSON object with the following properties:
- score: a number between 1 and 10, where 1 is very frustrated/angry and 10 is very happy/positive
- category: one of these categories: 'frustrated' (for scores 1-3), 'neutral' (for scores 4-6), or 'positive' (for scores 7-10)
- description: a brief phrase describing the specific emotion detected (e.g., "slightly annoyed", "very satisfied")

IMPORTANT GUIDELINES:
1. Do NOT confuse short or direct messages with frustration unless there is clear emotional or negative language present.
2. Informational or factual statements should generally be scored as neutral (4-6) even if they are brief.
3. Only classify as 'frustrated' (1-3) when there are clear indicators of negative emotion such as:
   - Explicit complaints
   - Negative emotional words
   - Expressions of dissatisfaction
   - Repeated questions or statements indicating impatience

Examples:
- "its a local move, and i need to move an refrigerator" → score: 5, category: neutral, description: informative
- "seriously? this is the third time I've asked" → score: 2, category: frustrated, description: annoyed
- "thank you so much for the help!" → score: 9, category: positive, description: appreciative

IMPORTANT: Return ONLY the raw JSON object without any markdown formatting, code blocks, or additional explanation. Do not wrap the JSON in \`\`\` tags.

Text: "${text}"`;

    const response = await executeChatCompletion([
      {
        role: "system" as const,
        content: "You are a mood analysis tool that returns a JSON object with score, category, and description. You must return only raw JSON without markdown formatting or code blocks. Do not confuse direct or short messages with frustration unless there is clear negative emotional content."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ], "gpt-4o", 0.3, 500) as unknown as ChatResponse;

    let resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) return undefined;

    try {
      // Clean up the result text if it contains markdown code blocks
      if (resultText.includes('```')) {
        // Extract JSON from markdown code blocks
        const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          resultText = jsonMatch[1].trim();
        } else {
          // If we can't extract from code blocks, try to remove markdown markers
          resultText = resultText.replace(/```json|```/g, '').trim();
        }
      }

      console.log('Cleaned JSON result:', resultText);
      
      const result = JSON.parse(resultText);
      
      // Validate and normalize the result
      const score = Math.max(1, Math.min(10, isNaN(result.score) ? 5 : result.score));
      
      // Ensure category is one of the expected values
      let category = result.category?.toLowerCase() || '';
      if (!['frustrated', 'neutral', 'positive'].includes(category)) {
        // Derive category from score if not valid
        if (score <= 3) category = 'frustrated';
        else if (score <= 6) category = 'neutral';
        else category = 'positive';
      }
      
      return {
        score,
        category,
        description: result.description || ''
      };
    } catch (parseError) {
      console.error('Error parsing mood analysis result:', parseError);
      return undefined;
    }
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return undefined;
  }
} 