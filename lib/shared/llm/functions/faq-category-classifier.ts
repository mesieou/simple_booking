/**
 * @file This file contains the FAQ Category Classifier service.
 * @description This service is responsible for taking a user's natural language question
 * and classifying it into one of the predefined business categories. This is the second
 * stage in a two-stage classification pipeline, used after the initial intent has been
 * identified as 'frequentlyAskedQuestion'.
 */

import { executeChatCompletion, OpenAIChatMessage } from "@/lib/shared/llm/openai/openai-core";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/general-config/general-config";

/**
 * Classifies a user's question into a predefined FAQ category using an LLM.
 *
 * @param question The user's natural language question.
 * @returns A promise that resolves to a `Category` enum member.
 */
export async function classifyFaq(question: string): Promise<Category> {
  // Create a dynamic list of valid category display names for the prompt.
  const validCategoryNames = Object.values(CATEGORY_DISPLAY_NAMES).join("', '");

  const systemPrompt = `You are an expert text classification AI. Your only task is to classify the user's question into one of the following predefined categories. 
You must respond with only the exact category name from the list and nothing else.

**Categories:**
'${validCategoryNames}'

If the question does not fit any category, you must respond with 'Uncategorized'.`;

  const userPrompt = `User's Question: "${question}"`;

  try {
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Use the core LLM function with settings optimized for classification.
    const llmResult = await executeChatCompletion(messages, "gpt-4o", 0.1, 50); // Low temp, low tokens for precision
    const llmResponse = llmResult.choices[0]?.message?.content?.trim();

    if (!llmResponse) {
      console.warn('[FAQClassifier] LLM returned an empty response. Falling back to UNCATEGORIZED.');
      return Category.UNCATEGORIZED;
    }

    // Find the Category enum key that matches the LLM's string response.
    const matchedCategoryKey = Object.keys(CATEGORY_DISPLAY_NAMES).find(
      (key) => CATEGORY_DISPLAY_NAMES[key as unknown as Category].toLowerCase() === llmResponse.toLowerCase()
    );

    if (matchedCategoryKey) {
      // Convert the string key back to its numeric enum value.
      return Number(matchedCategoryKey) as Category;
    }

    console.warn(`[FAQClassifier] LLM returned a non-matching category: "${llmResponse}". Falling back to UNCATEGORIZED.`);
    return Category.UNCATEGORIZED;

  } catch (error) {
    console.error('[FAQClassifier] Error during LLM call:', error);
    // If the entire service fails, always return a safe default.
    return Category.UNCATEGORIZED;
  }
}
