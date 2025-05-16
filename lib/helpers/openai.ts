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
          model: "gpt-3.5-turbo",
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
    model: "gpt-3.5-turbo",
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
): Promise<string[]> {
  const formattedContent = categorizedContent
    .map(({ category, content }) => `${category}:\n${content.substring(0, 500)}...`)
    .join("\n\n");

  const prompt = `You are reviewing the content of a business website that has been categorized. Based on the content in each category, identify which of the following critical items are MISSING or INCOMPLETE:\n\n${VALID_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}\n\nCategorized Content:\n${formattedContent}`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You analyze website content to identify missing critical information. Return a JSON array of missing category names.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const result = response.choices[0]?.message?.content;
  if (!result) return [];

  try {
    const missingInfo = JSON.parse(result) as string[];
    return missingInfo.filter(cat => VALID_CATEGORIES.includes(cat as WebPageCategory));
  } catch (err) {
    console.error("Failed to parse missing information:", err);
    return [];
  }
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
      model: "gpt-3.5-turbo",
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

export async function categorizeContentSections(
  content: string,
  title: string
): Promise<CategorizedContent[]> {
  console.log(
    `\n[Content Section Categorization] Processing content from: ${title}`
  );
  console.log(`Content preview: ${content.substring(0, 200)}...`);

  // Estimate tokens (rough estimate: 4 chars per token)
  const estimatedTokens = Math.ceil((content.length + title.length) / 4) + 500;
  await waitForRateLimit(estimatedTokens);

  const prompt = `Analyze this webpage content and categorize sections into the following categories:
${VALID_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}

For each section, consider the full context and assign a confidence score between 0.5 and 1.0:
- 0.9-1.0: Perfect match, content clearly and exclusively fits this category
- 0.8-0.9: Strong match, content primarily fits this category with minor overlaps
- 0.7-0.8: Good match, content fits this category but may have some elements of others
- 0.6-0.7: Fair match, content partially fits this category
- 0.5-0.6: Weak match, content barely fits this category

Guidelines for categorization:
1. Consider the full context of each section
2. Keep related information together - don't split contextually related content
3. Assign the most appropriate category based on the overall meaning, not just keywords
4. If content could fit multiple categories, choose the most dominant one
5. Consider the section's purpose and main message

Content from "${title}":
${content.substring(0, 1500)} // Reduced from 2000 to save tokens

Return a valid JSON array of objects with this exact structure:
[
  {
    "category": "category_name",
    "content": "section_content",
    "confidence": 0.75 // Use appropriate confidence score based on match quality
  }
]

Ensure all objects have all three fields and proper JSON formatting with commas between properties.
The category must be one of the exact category names listed above.
The confidence score must be between 0.5 and 1.0, with higher scores for better matches.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You analyze and categorize webpage content sections. Always return valid JSON with exact category names and appropriate confidence scores between 0.5 and 1.0.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      console.log("No content returned from OpenAI");
      return [];
    }

    try {
      const cleanedResult = result.replace(/```json\n?|\n?```/g, "").trim();
      const sections = JSON.parse(cleanedResult) as CategorizedContent[];

      // Log each section's categorization
      console.log("\nCategorized sections:");
      sections.forEach((section, index) => {
        console.log(`\nSection ${index + 1}:`);
        console.log(`Category: ${section.category}`);
        console.log(`Confidence: ${section.confidence}`);
        console.log(`Content preview: ${section.content.substring(0, 100)}...`);
      });

      // Validate categories and confidence scores
      const validSections = sections.filter(section => {
        const isValidCategory = VALID_CATEGORIES.includes(section.category as WebPageCategory);
        const isValidConfidence = section.confidence >= 0.5 && section.confidence <= 1.0;
        
        if (!isValidCategory) {
          console.warn(`Invalid category: ${section.category}`);
        }
        if (!isValidConfidence) {
          console.warn(`Invalid confidence score: ${section.confidence}`);
        }
        
        return isValidCategory && isValidConfidence;
      });

      console.log(`\nValid sections after filtering: ${validSections.length}`);
      return validSections;
    } catch (err) {
      console.error("Failed to parse JSON from OpenAI response:", err);
      console.error("Raw response:", result);
      return [];
    }
  } catch (error) {
    console.error("Error during OpenAI categorization call:", error);
    return [];
  }
}