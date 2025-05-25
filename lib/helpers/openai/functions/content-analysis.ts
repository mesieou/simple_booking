import { executeChatCompletion, OpenAIChatMessage, OpenAIChatCompletionResponse } from "../openai-core";
import { CategorizedContent, Category, CATEGORY_DISPLAY_NAMES } from "@/lib/bot/content-crawler/config";

const CATEGORY_COUNT = Object.keys(Category).length / 2; // Divide by 2 because enum has both numeric and string keys

export async function detectMissingInformation(
  categorizedContent: { category: Category; content: string }[]
): Promise<string> {
  console.log(
    "\n[Missing Information Detection] Analyzing categorized content:"
  );
  categorizedContent.forEach((item, index) => {
    console.log(`\nCategory ${index + 1}: ${CATEGORY_DISPLAY_NAMES[item.category]}`);
    console.log(`Content preview: ${item.content.substring(0, 200)}...`);
  });

  const formattedContent = categorizedContent
    .map((c) => `Category: ${CATEGORY_DISPLAY_NAMES[c.category]}\nContent:\n${c.content}`)
    .join("\n\n");

  const prompt = `You are reviewing the content of a business website that has been categorized. Based on the content in each category, identify which of the following critical items are MISSING or INCOMPLETE:\n\n${Object.entries(CATEGORY_DISPLAY_NAMES).map(([num, name]) => `${num}: ${name}`).join("\n")}\n\nCategorized Content:\n${formattedContent}`;

  const response = await executeChatCompletion([
    {
      role: "system",
      content: "You help identify missing business website content.",
    },
    { role: "user", content: prompt },
  ], "gpt-4", 0.3, 500);

  const result = response.choices[0]?.message?.content || "";
  console.log("\nMissing information analysis result:");
  console.log(result);

  return result;
}

export async function categorizeWebsiteContent(
  text: string,
  businessId: string,
  websiteUrl: string
): Promise<CategorizedContent[]> {
  console.log(`[Categorizer] Starting categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}`);
  
  const prompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return a JSON array of objects with these exact fields:

- "category": a number from 0-${CATEGORY_COUNT - 1} representing one of the following categories:
${Object.entries(CATEGORY_DISPLAY_NAMES).map(([num, name]) => `  ${num}: ${name}`).join('\n')}

- "content": the full, detailed text of the section (do NOT omit or summarize any details)
- "confidence": a score from 0.5 to 1.0 based on how well the content fits the chosen category
- "confidenceReason": a short explanation for the confidence score, describing why the content fits (or doesn't fit) the category

IMPORTANT:
- You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.
- Do NOT repeat or duplicate the same information in multiple sections. Each piece of information should appear only once, in the most appropriate category.
- If content fits multiple categories, include it in the most relevant one, but do NOT copy it to others.
- The output will be used for a customer assistant. Missing details will degrade its performance.
- Be as granular as needed to ensure every piece of information is included in some section.
- If a section touches multiple themes, choose the dominant one but do NOT drop any details.
- Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).
- Do NOT summarize or compress content. Include all original details.
- Do Not add any information that is not in the text.
- You MUST return a valid JSON array, even if empty.
- The category MUST be a number between 0 and ${CATEGORY_COUNT - 1}.

Here is the content to analyze:
${text}

Example response format:
[
  {
    "category": 4,
    "content": "About our company...",
    "confidence": 0.95,
    "confidenceReason": "Content describes company history and values"
  }
]`;

  try {
    const response = await executeChatCompletion([
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 4096);
    
    const rawContent = response.choices[0]?.message?.content;
    console.log(`[Categorizer] Raw response for businessId=${businessId}, url=${websiteUrl}:`, rawContent);
    
    if (!rawContent) {
      console.error(`[Categorizer] No content in response for businessId=${businessId}, url=${websiteUrl}`);
      return [];
    }
    
    const parsed = safeParseOpenAIJson<Array<{ category: number; content: string; confidence: number; confidenceReason: string }>>(rawContent);
    
    // Validate and convert category numbers to enum values
    return parsed.map(item => {
      const categoryNum = Number(item.category);
      if (isNaN(categoryNum) || categoryNum < 0 || categoryNum >= CATEGORY_COUNT) {
        console.error(`[Categorizer] Invalid category number: ${item.category}`);
        throw new Error(`Invalid category number: ${item.category}`);
      }
      // Explicitly convert number to Category enum value (ensure it's a number, not a string)
      const categoryEnum = (Object.values(Category) as number[]).find(val => val === categoryNum);
      if (typeof categoryEnum !== 'number') {
        console.error(`[Categorizer] Failed to convert number ${categoryNum} to Category enum`);
        throw new Error(`Failed to convert number ${categoryNum} to Category enum`);
      }
      return {
        ...item,
        category: categoryEnum
      };
    });
  } catch (error) {
    console.error(`[Categorizer] Error in categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}:`, error);
    throw error; // Propagate error for better error handling upstream
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
    ], "gpt-4o", 0.3, 500);
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

export function safeParseOpenAIJson<T>(raw: string | undefined): T {
  if (!raw) throw new Error("No content to parse");
  
  // Log the raw content for debugging
  console.log("[JSON Parser] Attempting to parse:", raw);
  
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log("[JSON Parser] Initial parse failed, attempting to extract JSON array");
    
    // Try to extract JSON array from output using more robust regex
    const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        const extracted = match[0];
        console.log("[JSON Parser] Extracted JSON:", extracted);
        return JSON.parse(extracted);
      } catch (extractError) {
        console.error("[JSON Parser] Failed to parse extracted JSON:", extractError);
      }
    }
    
    // If we get here, all parsing attempts failed
    console.error("[JSON Parser] All parsing attempts failed for input:", raw);
    throw new Error("Failed to parse OpenAI JSON output");
  }
} 