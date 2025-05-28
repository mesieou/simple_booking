import { executeChatCompletion, OpenAIChatMessage, OpenAIChatCompletionResponse } from "../openai-core";
import { CategorizedContent, Category, CATEGORY_DISPLAY_NAMES, PROCESS_CONTENT_CONFIG } from "@/lib/config/config";
import { savePageMainPrompt } from '../../../bot/content-crawler/process-content/logger-artifact-savers';
import { createHash } from 'crypto';

const CATEGORY_COUNT = Object.keys(Category).length / 2; // Divide by 2 because enum has both numeric and string keys

// Define the new interface for the return type
export interface CategorizationApiOutput {
  prompt: string;
  result: CategorizedContent[];
}

export async function categorizeWebsiteContent(
  text: string,
  businessId: string,
  websiteUrl: string
): Promise<CategorizationApiOutput> {
  // DEV MODE: MOCK GPT RESPONSE
  if (process.env.MOCK_GPT === 'true') {
    console.log(`[Categorizer] MOCK MODE: Returning stubbed response for businessId=${businessId}, url=${websiteUrl}, chunk preview: ${text.substring(0,50)}...`);
    // Simulate a plausible structure, using the actual text for more realistic testing of downstream logic
    const mockCategory = Category.SERVICES_OFFERED; // Default mock category
    const mockContent = text.length > PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.DEFAULT_CHUNK_SIZE ? text.substring(0, PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.DEFAULT_CHUNK_SIZE) + "..." : text; // Truncate if very long based on chunk size
    return {
      prompt: `MOCK PROMPT for: ${text.substring(0,50)}...`,
      result: [
        {
          category: mockCategory,
          content: mockContent,
          confidence: 0.99,
          confidenceReason: "Mocked: Assumed services from text.",
          url: websiteUrl
        }
      ]
    };
  }
  // END DEV MODE MOCK

  console.log(`[Categorizer] Starting categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}`);
  
  const categoriesDescription = Object.entries(CATEGORY_DISPLAY_NAMES).map(([num, name]) => `  ${num}: ${name}`).join('\n');
  const importantNotes = [
    "You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.",
    "Each piece of information should appear only once, in the most appropriate category.",
    "Group closely related items: A heading and its direct content, or all points in a list that explain a single sub-topic, should generally be part of the SAME section unless the content under a heading is exceptionally long and diverse itself.",
    "If a section of content under a single heading is naturally very long but still pertains to one overarching idea, keep it as one section. Do not artificially split it unless it clearly transitions to a new, distinct topic.",
    "The output will be used for a customer assistant. Missing details or unnaturally split ideas will degrade its performance.",
    "Be as granular as needed for distinct topics, but prioritize grouping for coherent ideas.",
    "Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).",
    "Do NOT summarize or compress content. Include all original details.",
    "Do Not add any information that is not in the text.",
    `You MUST return a valid JSON array, even if empty. The category MUST be a number between 0 and ${CATEGORY_COUNT - 1}.`
  ];
  const exampleResponseFormat = `[\n  {\n    "category": 4,\n    "content": "About our company...",\n    "confidence": 0.95,\n    "confidenceReason": "Content describes company history and values"\n  }\n]`;

  const promptInputDetails = {
    taskInstruction: "The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical, self-contained sections of information. Strive to keep closely related content (such as a heading and its immediate subsequent text, or all steps in a numbered/bulleted list) together as a single section, provided the section remains a coherent, singular topic. For EACH distinct section you identify, provide a JSON object with these exact fields:",
    jsonFields: [
      { field: "category", description: `a number from 0-${CATEGORY_COUNT - 1} representing one of the following categories:\n${categoriesDescription}` },
      { field: "content", description: "the full, detailed text of the section (do NOT omit or summarize any details). If a heading is part of the section, include it at the beginning of this content." },
      { field: "confidence", description: "a score from 0.5 to 1.0 based on how well the content fits the chosen category" },
      { field: "confidenceReason", description: "a short explanation for the confidence score, describing why the content fits (or doesn't fit) the category" }
    ],
    importantNotes: importantNotes,
    targetContentDescription: "Here is the content to analyze:",
    targetContentHash: createHash('sha256').update(text).digest('hex'),
    exampleResponseFormat: exampleResponseFormat,
    businessId: businessId,
    websiteUrl: websiteUrl
  };

  // Save the structured prompt details
  try {
    await savePageMainPrompt(websiteUrl, promptInputDetails);
  } catch (logError) {
    console.error(`[Categorizer] Failed to save page main prompt for ${websiteUrl}:`, logError);
    // Decide if you want to proceed if logging fails. For now, we will.
  }

  const prompt = `${promptInputDetails.taskInstruction}

- "category": ${promptInputDetails.jsonFields[0].description}

- "content": ${promptInputDetails.jsonFields[1].description}
- "confidence": ${promptInputDetails.jsonFields[2].description}
- "confidenceReason": ${promptInputDetails.jsonFields[3].description}

IMPORTANT:
${promptInputDetails.importantNotes.join('\n- ')}

${promptInputDetails.targetContentDescription}
${text}

Example response format:
${promptInputDetails.exampleResponseFormat}`;

  try {
    const response = await executeChatCompletion([
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 8192);
    
    const rawContent = response.choices[0]?.message?.content;
    console.log(`[Categorizer] Raw response for businessId=${businessId}, url=${websiteUrl}:`, rawContent?.substring(0, 500) + (rawContent && rawContent.length > 500 ? '...' : ''));
    
    if (!rawContent) {
      console.error(`[Categorizer] No content in response for businessId=${businessId}, url=${websiteUrl}`);
      // Return an empty result along with the prompt in case of no content
      return { prompt: prompt, result: [] }; 
    }
    
    const parsed = safeParseOpenAIJson<Array<{ category: number; content: string; confidence: number; confidenceReason: string }>>(rawContent);
    
    // Validate and convert category numbers to enum values
    const validatedResults = parsed.map(item => { // Renamed to avoid conflict with 'result' in the return object
      const categoryNum = Number(item.category);
      if (isNaN(categoryNum) || categoryNum < 0 || categoryNum >= CATEGORY_COUNT) {
        console.error(`[Categorizer] Invalid category number: ${item.category} for url ${websiteUrl}`);
        // In case of error during mapping, consider how to handle. 
        // For now, let's throw, but you might want to return the prompt with partially processed/empty results.
        throw new Error(`Invalid category number: ${item.category} for url ${websiteUrl}`);
      }
      // Explicitly convert number to Category enum value (ensure it's a number, not a string)
      const categoryEnum = (Object.values(Category) as number[]).find(val => val === categoryNum);
      if (typeof categoryEnum !== 'number') {
        console.error(`[Categorizer] Failed to convert number ${categoryNum} to Category enum for url ${websiteUrl}`);
        throw new Error(`Failed to convert number ${categoryNum} to Category enum for url ${websiteUrl}`);
      }
      return {
        ...item,
        category: categoryEnum,
        url: websiteUrl
      };
    });

    return { prompt: prompt, result: validatedResults }; // Return both prompt and the validated results

  } catch (error) {
    console.error(`[Categorizer] Error in categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}:`, error);
    // In case of a general error, return the prompt and an empty result array
    // Or rethrow if the caller should handle the error differently.
    // For consistency with the no-content case, let's return prompt and empty result.
    return { prompt: prompt, result: [] }; 
    // throw error; // Original behavior: Propagate error for better error handling upstream
  }
}

export function safeParseOpenAIJson<T>(raw: string | undefined): T {
  if (!raw) throw new Error("No content to parse");
  
  // Log the raw content for debugging
  console.log("[JSON Parser] Attempting to parse (first 500 chars):", raw.substring(0, 500) + (raw.length > 500 ? "..." : ""));
  
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log("[JSON Parser] Initial parse failed, attempting to extract JSON array");
    
    // Try to extract JSON array from output using more robust regex
    const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        const extracted = match[0];
        console.log("[JSON Parser] Extracted JSON (first 500 chars):", extracted.substring(0, 500) + (extracted.length > 500 ? "..." : ""));
        return JSON.parse(extracted);
      } catch (extractError) {
        console.error("[JSON Parser] Failed to parse extracted JSON:", extractError);
      }
    }
    
    // If we get here, all parsing attempts failed
    console.error("[JSON Parser] All parsing attempts failed for input (first 500 chars):", raw.substring(0, 500) + (raw.length > 500 ? "..." : ""));
    throw new Error("Failed to parse OpenAI JSON output");
  }
} 

export async function analyzeCategoryQualityWithGPT(
  category: Category,
  content: string,
  websiteUrl: string
): Promise<{ issues: string[]; recommendations: string[]; score: number }> {
  const prompt = `You are reviewing the content for the \"${CATEGORY_DISPLAY_NAMES[category]}\" section of a business website (website: ${websiteUrl}).\n\nThis content will be used by a customer service bot to assist and inform customers.\n\n1. Assess the quality and completeness of the content below for this category, specifically for customer support and user experience.\n2. List any issues, missing details, or improvements needed (as an array of strings) that would help the bot provide excellent customer service.\n3. Provide specific recommendations for improvement (as an array of strings) to ensure the bot can answer customer questions accurately and helpfully.\n4. Give an overall quality score from 0-100 (as a number), focused on customer-facing usefulness.\n\nReturn a JSON object with this structure:\n{\n  "issues": ["issue1", "issue2"],\n  "recommendations": ["recommendation1", "recommendation2"],\n  "score": 75\n}\n\nHere is the content for this category:\n${content}`;

  try {
    const response = await executeChatCompletion([
      {
        role: "system",
        content: "You are a content analysis expert that helps ensure customer service bots have all necessary information to support and inform users effectively."
      },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 500); // This call uses a smaller maxTokens, which is fine for this specific task
    const gptResponse = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(gptResponse);
    return {
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      score: typeof result.score === 'number' ? result.score : 0
    };
  } catch (error) {
    console.error(`Error analyzing category ${CATEGORY_DISPLAY_NAMES[category]}:`, error);
    return { issues: ["Error analyzing content"], recommendations: [], score: 0 };
  }
} 