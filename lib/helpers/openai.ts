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
  WebPageCategory,
  VALID_CATEGORIES,
} from "@/lib/bot/website-crawler/types";


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
let requestQueue: Array<() => Promise<void>> = [];
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

export async function chatWithOpenAI(messages: any[]) {
  return new Promise((resolve, reject) => {
    const request = async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
        });
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };
    requestQueue.push(request);
    processQueue();
  });
}

export async function chatWithFunctions(messages: any[], functions: any[]) {
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    functions,
    function_call: "auto",
  });
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

export async function detectBusinessType(
  homepageContent: string,
  servicePageContent: string
): Promise<{ industry: string; services: string[] }> {
  const prompt = `You are analyzing the content of a business website to identify the primary industry and services offered.\n\nHomepage Content:\n${homepageContent}\n\nService Page Content:\n${servicePageContent}\n\nWhat is the industry of this business? What services do they provide?\n- Industry: [e.g., Accounting, Plumbing, Dentistry]\n- Services: [Short bullet list of key offerings]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that analyzes business websites.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const output = response.choices[0]?.message?.content || "";
  const match = output.match(/- Industry: (.*)\n- Services: ([\s\S]*)/);

  return {
    industry: match?.[1]?.trim() || "unknown",
    services:
      match?.[2]
        ?.split(/\n|\*/)
        .map((s) => s.trim())
        .filter((s) => s) || [],
  };
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

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You help identify missing business website content.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

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
export async function detectConversationCategory(
  conversation: { role: "user" | "assistant"; content: string }[],
  categories: string[]
): Promise<string | undefined> {
  if (categories.length === 0) {
    console.warn("No categories provided for conversation classification.");
    return undefined;
  }

  const prompt = `Analyze the following short conversation between a customer and an assistant. Decide which of these categories it best fits:

${categories.map((c) => `- ${c}`).join("\n")}

Conversation:
${conversation.map((turn) => `${turn.role === "user" ? "Customer" : "Assistant"}: ${turn.content}`).join("\n")}

Return only the best matching category from the list above.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You categorize conversations for routing to the correct knowledge base section.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const category = response.choices[0]?.message?.content
      ?.trim()
      .toLowerCase();
    return category && categories.includes(category) ? category : undefined;
  } catch (error) {
    console.error("Error detecting conversation category:", error);
    return undefined;
  }
}

export async function sendMergedTextToGpt4Turbo(text: string, businessId: string, websiteUrl: string): Promise<string> {
  const prompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return:

- "category": one of the following, written EXACTLY as shown (case, spaces, and punctuation must match):
${VALID_CATEGORIES.map(cat => `  - "${cat}"`).join('\n')}

Do NOT invent new categories. If content does not fit any, use the closest match from the list above.
- "content": the full, detailed text of the section (do NOT omit or summarize any details)
- "confidence": a score from 0.5 to 1.0 based on how well the content fits the chosen category

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

Return a valid JSON array like this:

[
  {
    "category": "faq",
    "content": "How long does it take... You need to keep receipts for 5 years...",
    "confidence": 0.95
  }
]

Here is all the cleaned text content from the site (ID: ${businessId}, URL: ${websiteUrl}):

${text}`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 4096
  });
  return response.choices[0]?.message?.content || "";
}

/**
 * Analyzes the sentiment of a text and returns a score between -1 (very negative) and 1 (very positive).
 * @param text The text to analyze
 * @returns A promise that resolves to a number between -1 and 1, or undefined if an error occurs
 */
export async function analyzeSentiment(text: string): Promise<number | undefined> {
  try {
    interface ChatResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    const response = await chatWithOpenAI([
      {
        role: "system" as const,
        content: "You are a sentiment analysis tool. Analyze the sentiment of the following message and respond with ONLY a number between -1 and 1, where -1 is very negative, 0 is neutral, and 1 is very positive."
      },
      {
        role: "user" as const,
        content: text
      }
    ]) as unknown as ChatResponse;

    const scoreText = response.choices[0]?.message?.content?.trim();
    if (!scoreText) return undefined;

    const score = parseFloat(scoreText);
    // Clamp the score between -1 and 1 in case the model returns an out-of-range value
    return Math.max(-1, Math.min(1, isNaN(score) ? 0 : score));
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return undefined;
  }
}

