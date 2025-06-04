import { executeChatCompletion, OpenAIChatMessage, OpenAIChatCompletionResponse } from "../openai-config/openai-core";
import { CategorizedContent, Category, CATEGORY_DISPLAY_NAMES, PROCESS_CONTENT_CONFIG } from "@/lib/general-config/general-config";
import { savePageMainPrompt } from "@/lib/backend-actions/content-crawler/process-content/logger-artifact-savers";
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
    const fixedTruncationLimit = 200; // Using a fixed character limit for mock preview
    const mockContent = text.length > fixedTruncationLimit ? text.substring(0, fixedTruncationLimit) + "..." : text;
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

  // Save the structured prompt details
  try {
    // Save both the prompt details and the full prompt string for full traceability
    await savePageMainPrompt(websiteUrl, { 
      ...promptInputDetails, 
      fullPrompt: prompt,
      contentText: text 
    });
  } catch (logError) {
    console.error(`[Categorizer] Failed to save page main prompt for ${websiteUrl}:`, logError);
    // Decide if you want to proceed if logging fails. For now, we will.
  }

  try {
    const response = await executeChatCompletion([
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 8192);
    
    const rawContent = response.choices[0]?.message?.content;
    console.log(`[Categorizer] Raw response for businessId=${businessId}, url=${websiteUrl}:`, rawContent?.substring(0, 500) + (rawContent && rawContent.length > 500 ? '...' : ''));
    console.log(`[Categorizer] Raw response length: ${rawContent?.length || 0} characters`);
    
    if (!rawContent) {
      console.error(`[Categorizer] No content in response for businessId=${businessId}, url=${websiteUrl}`);
      // Return an empty result along with the prompt in case of no content
      return { prompt: prompt, result: [] }; 
    }
    
    const parsed = safeParseOpenAIJson<Array<{ category: number; content: string; confidence: number; confidenceReason: string }>>(rawContent);
    console.log(`[Categorizer] Parsed ${parsed.length} items from LLM response`);
    
    // Save the raw LLM response for debugging
    try {
      const domain = websiteUrl.replace(/^https?:\/\//, '').replace(/\//g, '_');
      const outputDir = 'crawl-output/domains';
      const domainPath = path.join(outputDir, domain);
      const categorizationPath = path.join(domainPath, 'about-us/03_categorization');
      await fs.promises.mkdir(categorizationPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(categorizationPath, 'raw_llm_response.json'),
        JSON.stringify({ 
          rawResponse: rawContent,
          responseLength: rawContent?.length || 0,
          parsedItemCount: parsed.length,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
    } catch (saveError) {
      console.error(`[Categorizer] Failed to save raw LLM response for ${websiteUrl}:`, saveError);
    }
    
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
    // If still failing, log and rethrow original error
    console.error("[JSON Parser] Failed to parse raw content or extract JSON array. Raw content (first 500 chars):", raw.substring(0, 500) + (raw.length > 500 ? "..." : ""));
    throw error; // Rethrow the original parsing error
  }
}

interface QualityAssessmentResponse {
  issues: string[];
  recommendations: string[];
  score: number;
}

// New function to analyze category quality using GPT
export async function analyzeCategoryQualityWithGPT(
  category: Category,
  content: string,
  websiteUrl: string
): Promise<QualityAssessmentResponse> {
  const categoryName = CATEGORY_DISPLAY_NAMES[category] || 'Unknown Category';
  const prompt = `
As an expert data quality analyst, please review the following content categorized under "${categoryName}" from the website ${websiteUrl}.

Content:
"${content}"

Evaluate its quality for use in a customer support chatbot. Specifically, identify:
1. Issues: Any problems with the content (e.g., incompleteness, ambiguity, irrelevance to the category, formatting issues that might confuse an LLM).
2. Recommendations: Suggestions to improve the content for chatbot use (e.g., rephrase for clarity, add missing details, split into smaller chunks if too broad for the category).
3. Score: A rating from 1 (very poor) to 10 (excellent) for its suitability for the category and chatbot use.

Provide your response as a JSON object with three keys: "issues" (an array of strings), "recommendations" (an array of strings), and "score" (a number).
Example JSON response: {"issues": ["The pricing is unclear"], "recommendations": ["Specify the currency for all prices"], "score": 6}

IMPORTANT: Respond ONLY with the raw JSON object. Do not include any markdown formatting, code blocks (like \`\`\`json), or any other text outside the JSON structure.
  `;

  try {
    const gptResponse = await executeChatCompletion(
      [
        { role: "system", content: "You are an expert data quality analyst responding in JSON format." },
        { role: "user", content: prompt }
      ],
      "gpt-4o",
      0.2,
      1000
    );

    const rawJsonResponse = gptResponse.choices[0]?.message?.content?.trim();
    if (!rawJsonResponse) {
      throw new Error("No content in GPT response for quality assessment.");
    }

    // Attempt to parse the JSON, cleaning it if necessary
    let cleanedJson = rawJsonResponse;
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.substring(7, cleanedJson.length - 3).trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.substring(3, cleanedJson.length - 3).trim();
    }

    const result: QualityAssessmentResponse = JSON.parse(cleanedJson);
    return result;

  } catch (error) {
    console.error(`[Quality Analyzer] Error analyzing category quality for ${categoryName} at ${websiteUrl}:`, error);
    // Return a default error response or rethrow, depending on desired error handling
    return {
      issues: [`Failed to analyze content quality: ${(error as Error).message}`],
      recommendations: ["Review content and GPT prompt for issues."],
      score: 1 // Lowest score indicates a problem
    };
  }
} 