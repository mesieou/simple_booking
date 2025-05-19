/**
 * OpenAI Service - Centralized ChatGPT API Calls
 *
 * This module provides centralized utility functions to interact with the OpenAI Chat API.
 * It separates standard message generation and function-calling behavior into reusable functions
 * to keep the rest of the codebase clean and consistent.
 *
 * Usage:
 *
 * 1. Basic chat without function calls:
 *    const response = await chatWithOpenAI([
 *      { role: "system", content: systemPrompt },
 *      { role: "user", content: "Hello, I need help moving." }
 *    ]);
 *
 * 2. Chat with function call support:
 *    const response = await chatWithFunctions(
 *      [{ role: "system", content: systemPrompt }, ...history],
 *      [createUserSchema, getQuoteSchema, bookSlotSchema] // your defined function schemas
 *    );
 *
 * 3. Generate embeddings:
 *    const embedding = await generateEmbedding("Your text here");
 *
 * The returned object follows OpenAI's chat completion format.
 * Use response.choices[0].message to get the assistant's reply or function call trigger.
 */
import OpenAI from "openai";
import {
  CategorizedContent,
  VALID_CATEGORIES,
} from "@/lib/bot/content-crawler/types";

interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
  }>;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000, // 30 seconds
});

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 20,
  maxTokensPerMinute: 16000,
  backoffBase: 1000,
  maxBackoff: 30000,
};

let requestCount = 0;
let tokenCount = 0;
let lastResetTime = Date.now();
let requestQueue: Array<() => Promise<OpenAIChatCompletionResponse>> = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      await request();
    }
  }

  isProcessingQueue = false;
}

async function waitForRateLimit(tokens: number): Promise<void> {
  const now = Date.now();
  if (now - lastResetTime >= 60000) {
    requestCount = 0;
    tokenCount = 0;
    lastResetTime = now;
  }

  if (
    requestCount >= RATE_LIMIT.maxRequestsPerMinute ||
    tokenCount + tokens >= RATE_LIMIT.maxTokensPerMinute
  ) {
    const waitTime = Math.min(
      RATE_LIMIT.maxBackoff,
      RATE_LIMIT.backoffBase * Math.pow(2, requestCount)
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return waitForRateLimit(tokens);
  }

  requestCount++;
  tokenCount += tokens;
}

async function executeChatCompletion(
  messages: OpenAIChatMessage[],
  model: string = "gpt-4o",
  temperature: number = 0.3,
  maxTokens: number = 1000,
  functions?: any[]
): Promise<OpenAIChatCompletionResponse> {
  await waitForRateLimit(maxTokens);
  
  const request = async () => {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(functions && { functions, function_call: "auto" }),
      });
      return response;
    } catch (error) {
      console.error("Error executing chat completion:", error);
      throw error;
    }
  };

  requestQueue.push(request);
  processQueue();
  return request();
}

// All OpenAI chat completions should use executeChatCompletion directly for clarity and control.

export async function chatWithFunctions(
  messages: OpenAIChatMessage[],
  functions: any[]
): Promise<OpenAIChatCompletionResponse> {
  return await executeChatCompletion(messages, "gpt-4o", 0.3, 1000, functions);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}


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

/**
 * Detect which category a conversation belongs to based on a short dialogue.
 * Useful for narrowing down embedding search space to relevant categories.
 * @param conversation The conversation to categorize
 * @param categories List of available categories from the database
 * @returns The best matching category or undefined if no match found
 */


export async function categorizeWebsiteContent(
  text: string,
  businessId: string,
  websiteUrl: string
): Promise<CategorizedContent[]> {
  const prompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return:\n\n- \"category\": one of the following, written EXACTLY as shown (case, spaces, and punctuation must match):\n${VALID_CATEGORIES.map(cat => `  - \"${cat}\"`).join('\n')}\n\nDo NOT invent new categories. If content does not fit any, use the closest match from the list above.\n- \"content\": the full, detailed text of the section (do NOT omit or summarize any details)\n- \"confidence\": a score from 0.5 to 1.0 based on how well the content fits the chosen category\n\nIMPORTANT:\n- You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.\n- Do NOT repeat or duplicate the same information in multiple sections. Each piece of information should appear only once, in the most appropriate category.\n- If content fits multiple categories, include it in the most relevant one, but do NOT copy it to others.\n- The output will be used for a customer assistant. Missing details will degrade its performance.\n- Be as granular as needed to ensure every piece of information is included in some section.\n- If a section touches multiple themes, choose the dominant one but do NOT drop any details.\n- Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).\n- Do NOT summarize or compress content. Include all original details.\n- Do Not add any information that is not in the text.\n\nReturn a valid JSON array like this:\n\n[\n  {\n    \"category\": \"faq\",\n    \"content\": \"How long does it take... You need to keep receipts for 5 years...\",\n    \"confidence\": 0.95\n  }\n]\n\nHere is all the cleaned text content from the site (ID: ${businessId}, URL: ${websiteUrl}):\n\n${text}`;

  const response = await executeChatCompletion([
    { role: "system", content: "You are a helpful assistant that analyzes business websites." },
    { role: "user", content: prompt }
  ], "gpt-4o", 0.3, 4096);

  return safeParseOpenAIJson<CategorizedContent[]>(response.choices[0]?.message?.content ?? undefined);
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


export async function analyzeCategoryQualityWithGPT(
  category: string,
  content: string,
  websiteUrl: string
): Promise<{ issues: string[]; recommendations: string[]; score: number }> {
  const prompt = `You are reviewing the content for the "${category}" section of a business website (website: ${websiteUrl}).\n\nThis content will be used by a customer service bot to assist and inform customers.\n\n1. Assess the quality and completeness of the content below for this category, specifically for customer support and user experience.\n2. List any issues, missing details, or improvements needed (as an array of strings) that would help the bot provide excellent customer service.\n3. Provide specific recommendations for improvement (as an array of strings) to ensure the bot can answer customer questions accurately and helpfully.\n4. Give an overall quality score from 0-100 (as a number), focused on customer-facing usefulness.\n\nReturn a JSON object with this structure:\n{\n  "issues": ["issue1", "issue2"],\n  "recommendations": ["recommendation1", "recommendation2"],\n  "score": 75\n}\n\nHere is the content for this category:\n${content}`;

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

export { executeChatCompletion };

