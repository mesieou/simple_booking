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
import { v4 as uuidv4 } from 'uuid';
import { categorizeConversation } from "@/lib/bot/conversation-categorizer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000, // 30 seconds
});

export async function chatWithOpenAI(messages: any[]) {
  return await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
  });
}

export async function chatWithFunctions(messages: any[], functions: any[]) {
  return await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
    functions,
    function_call: "auto"
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
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

export type WebPageCategory =
  | 'account management'
  | 'billing & payments'
  | 'product information'
  | 'technical support'
  | 'policies & legal'
  | 'appointments & scheduling'
  | 'contact & escalation'
  | 'general faq'
  | 'specialized services';

export async function detectBusinessType(homepageContent: string, servicePageContent: string): Promise<{ industry: string, services: string[] }> {
  const prompt = `You are analyzing the content of a business website to identify the primary industry and services offered.\n\nHomepage Content:\n${homepageContent}\n\nService Page Content:\n${servicePageContent}\n\nWhat is the industry of this business? What services do they provide?\n- Industry: [e.g., Accounting, Plumbing, Dentistry]\n- Services: [Short bullet list of key offerings]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant that analyzes business websites." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 300
  });

  const output = response.choices[0]?.message?.content || "";
  const match = output.match(/- Industry: (.*)\n- Services: ([\s\S]*)/);

  return {
    industry: match?.[1]?.trim() || "unknown",
    services: match?.[2]?.split(/\n|\*/).map(s => s.trim()).filter(s => s) || []
  };
}

export async function detectMissingInformation(pages: { title: string, category?: string }[]): Promise<string> {
  const formattedPages = pages.map(p => `- ${p.title}${p.category ? ` (${p.category})` : ''}`).join("\n");

  const prompt = `You are reviewing the structure and content of a business website. Based on the pages and their content, identify which of the following critical items are MISSING or INCOMPLETE:\n\n- Services offered (clear descriptions)\n- Pricing or quotes\n- How to contact the business\n- Booking or scheduling info\n- About / Trust-building info (who they are)\n- Common FAQs\n- Terms & conditions / legal policies\n\nPages:\n${formattedPages}\n\nFor each missing item, say:\n- What is missing\n- What to ask the business to provide (content or documents)`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You help identify missing business website content." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 500
  });

  return response.choices[0]?.message?.content || "";
}

export async function detectPageCategory(url: string, title: string, content: string, industry: string): Promise<string | undefined> {
  try {
    const prompt = `Categorize this webpage based on the detected industry: ${industry}.\nUse categories relevant to that industry, or fall back to these general categories:\n
- account management: Account creation, login, password reset, profile updates\n- billing & payments: Invoices, payment methods, refunds, receipts\n- product information: Features, usage, pricing, plans, upgrades\n- technical support: Troubleshooting, error messages, system status\n- policies & legal: Privacy policy, terms of service, compliance\n- appointments & scheduling: Booking, rescheduling, cancellations\n- contact & escalation: How to contact support, escalation procedures\n- general faq: Miscellaneous common questions\n- specialized services: Tax services, finance & accounting, business consulting, or other niche services\n
Return ONLY the best category.\n\nURL: ${url}\nTitle: ${title}\nContent: ${content.substring(0, 1000)}...`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that categorizes web pages. Return only the category name, nothing else."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    const category = response.choices[0]?.message?.content?.trim().toLowerCase();
    return category || undefined;
  } catch (error) {
    console.error('Error detecting page category:', error);
    return undefined;
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
  conversation: { role: 'user' | 'assistant', content: string }[],
  categories: string[]
): Promise<string | undefined> {
  if (categories.length === 0) {
    console.warn("No categories provided for conversation classification.");
    return undefined;
  }

  const prompt = `Analyze the following short conversation between a customer and an assistant. Decide which of these categories it best fits:

${categories.map(c => `- ${c}`).join('\n')}

Conversation:
${conversation.map(turn => `${turn.role === 'user' ? 'Customer' : 'Assistant'}: ${turn.content}`).join('\n')}

Return only the best matching category from the list above.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You categorize conversations for routing to the correct knowledge base section." },
        { role: "user", content: prompt }
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const category = response.choices[0]?.message?.content?.trim().toLowerCase();
    return category && categories.includes(category) ? category : undefined;
  } catch (error) {
    console.error('Error detecting conversation category:', error);
    return undefined;
  }
}

