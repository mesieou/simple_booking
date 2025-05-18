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

// Define the response type for chat completions
export interface ChatCompletionResponse {

  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant' | 'user' | 'system' | 'function';
      content: string | null;
    };
    finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatWithOpenAI(messages: any[]): Promise<ChatCompletionResponse> {
  return new Promise((resolve, reject) => {
    const request = async () => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
        }) as ChatCompletionResponse;
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
    model: "gpt-4o",
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

  let result = response.choices[0]?.message?.content || "";
  
  // Format the response to ensure proper spacing and line breaks
  result = result
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1\n\n') // Add double newline after sentences
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to double newline
    .replace(/(\S)(\n)(\S)/g, '$1$2$3') // Ensure no spaces before newlines
    .trim();

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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Classifies a message as 'clear', 'unclear', or 'irrelevant' with optional chat history context.
 * @param message The message to classify
 * @param chatHistory Optional array of previous messages in the conversation for context
 * @returns A promise that resolves to 'clear' | 'unclear' | 'irrelevant' or undefined if an error occurs
 */
export async function classifyMessage(
  message: string, 
  chatHistory: ChatMessage[] = []
): Promise<'clear' | 'unclear' | 'irrelevant' | undefined> {
  try {
    interface ChatResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    // Format the chat history for context
    const historyContext = chatHistory.length > 0 
      ? `\n\nPrevious conversation context (most recent first):\n` +
        chatHistory
          .slice(-5) // Limit to last 5 messages to avoid too much context
          .reverse() // Show most recent first
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `You are a message clarity classifier.\n\nYour job is to receive a user message and its conversation context, then classify it into one of the following labels:\n\n- clear → the message is well-formed and understandable; the bot can reply without needing more context\n- unclear → the message is vague, ambiguous, or lacks context; it would require clarification before responding\n- irrelevant → the message has nothing to do with customer service or is off-topic (e.g., emojis, jokes, random text)\n\nImportant considerations:\n1. If the message refers to something in the conversation history, it might be clear\n2. If the message is a follow-up without context (e.g., \"What about that thing?\"), it's likely unclear\n3. If the message is completely out of context from the conversation, it might be irrelevant\n\nInstructions:\n- Only reply with one of the three labels: \`clear\`, \`unclear\`, or \`irrelevant\`\n- Do not provide any explanation or extra text\n- Be strict — if there is any doubt or ambiguity, classify it as \`unclear\`\n\nExamples with context:\n1. Previous: user: \"I want to book a moving service\"\n   New: \"For next Monday\" → clear  \n2. Previous: (no context)\n   New: \"For next Monday\" → unclear  \n3. New: \"😂😂😂\" → irrelevant\n\nNow classify this message:${historyContext}\n\nNew message to classify:\n${message}`;

    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant that classifies message clarity based on both the message and conversation context."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ];

    const response = await chatWithOpenAI(messages) as unknown as ChatResponse;

    const classification = response.choices[0]?.message?.content?.trim().toLowerCase();
    
    // Validate the response is one of the expected values
    if (classification === 'clear' || classification === 'unclear' || classification === 'irrelevant') {
      return classification;
    }
    
    return 'unclear'; // Default to 'unclear' if the response is not as expected
  } catch (error) {
    console.error('Error classifying message:', error);
    return undefined;
  }
}
