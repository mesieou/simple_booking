import { executeChatCompletion, OpenAIChatMessage, OpenAIChatCompletionResponse } from "../openai-core";
import { CategorizedContent, VALID_CATEGORIES } from "@/lib/bot/content-crawler/config";

export async function detectMissingInformation(
  categorizedContent: { category: string; content: string }[]
): Promise<string> {
  console.log(
    "\n[Missing Information Detection] Analyzing categorized content:"
  );
  categorizedContent.forEach((item, index) => {
    console.log(`\nCategory ${index + 1}: ${item.category}`);
    console.log(`Content preview: ${item.content.substring(0, 200)}...`);
  });

  const formattedContent = categorizedContent
    .map((c) => `Category: ${c.category}\nContent:\n${c.content}`)
    .join("\n\n");

  const prompt = `You are reviewing the content of a business website that has been categorized. Based on the content in each category, identify which of the following critical items are MISSING or INCOMPLETE:\n\n${VALID_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}\n\nCategorized Content:\n${formattedContent}`;

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
  const prompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return:\n\n- \"category\": one of the following, written EXACTLY as shown (case, spaces, and punctuation must match):\n${VALID_CATEGORIES.map(cat => `  - \"${cat}\"`).join('\n')}\n\nDo NOT invent new categories. If content does not fit any, use the closest match from the list above.\n- \"content\": the full, detailed text of the section (do NOT omit or summarize any details)\n- \"confidence\": a score from 0.5 to 1.0 based on how well the content fits the chosen category\n\nIMPORTANT:\n- You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.\n- Do NOT repeat or duplicate the same information in multiple sections. Each piece of information should appear only once, in the most appropriate category.\n- If content fits multiple categories, include it in the most relevant one, but do NOT copy it to others.\n- The output will be used for a customer assistant. Missing details will degrade its performance.\n- Be as granular as needed to ensure every piece of information is included in some section.\n- If a section touches multiple themes, choose the dominant one but do NOT drop any details.\n- Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).\n- Do NOT summarize or compress content. Include all original details.\n- Do Not add any information that is not in the text.\n\nReturn a valid JSON array like this:\n\n[\n  {\n    \"category\": \"faq\",\n    \"content\": \"How long does it take... You need to keep receipts for 5 years...\",\n    \"confidence\": 0.95\n  }\n]\n\nHere is all the cleaned text content from the site (ID: ${businessId}, URL: ${websiteUrl}):\n\n${text}`;
  try {
    const response = await executeChatCompletion([
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 4096);
    console.log(`[Categorizer] Finished categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}`);
    return safeParseOpenAIJson<CategorizedContent[]>(response.choices[0]?.message?.content ?? undefined);
  } catch (error) {
    console.error(`[Categorizer] Error in categorizeWebsiteContent for businessId=${businessId}, url=${websiteUrl}:`, error);
    return [];
  }
}

export async function analyzeCategoryQualityWithGPT(
  category: string,
  content: string,
  websiteUrl: string
): Promise<{ issues: string[]; recommendations: string[]; score: number }> {
  const prompt = `You are reviewing the content for the \"${category}\" section of a business website (website: ${websiteUrl}).\n\nThis content will be used by a customer service bot to assist and inform customers.\n\n1. Assess the quality and completeness of the content below for this category, specifically for customer support and user experience.\n2. List any issues, missing details, or improvements needed (as an array of strings) that would help the bot provide excellent customer service.\n3. Provide specific recommendations for improvement (as an array of strings) to ensure the bot can answer customer questions accurately and helpfully.\n4. Give an overall quality score from 0-100 (as a number), focused on customer-facing usefulness.\n\nReturn a JSON object with this structure:\n{\n  "issues": ["issue1", "issue2"],\n  "recommendations": ["recommendation1", "recommendation2"],\n  "score": 75\n}\n\nHere is the content for this category:\n${content}`;

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
    console.error(`Error analyzing category ${category}:`, error);
    return { issues: ["Error analyzing content"], recommendations: [], score: 0 };
  }
}

export function safeParseOpenAIJson<T>(raw: string | undefined): T {
  if (!raw) throw new Error("No content to parse");
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON array from output using regex
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error("Failed to parse OpenAI JSON output");
  }
} 