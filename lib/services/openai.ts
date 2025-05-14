// lib/services/openai.ts

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
 * Use `response.choices[0].message` to get the assistant's reply or function call trigger.
 */
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat with OpenAI, normal situation
export async function chatWithOpenAI(messages: any[]) {
    return await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
    });
  }
  

// Chat with functions, when we need to call a function
export async function chatWithFunctions(messages: any[], functions: any[]) {
return await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
    functions,
    function_call: "auto"
});
}
  
// Generate embeddings for text
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
  | 'services' 
  | 'about' 
  | 'contact' 
  | 'blog' 
  | 'products' 
  | 'pricing' 
  | 'faq' 
  | 'testimonials' 
  | 'careers' 
  | 'booking' 
  | 'quote';

export async function detectPageCategory(url: string, title: string, content: string): Promise<WebPageCategory | undefined> {
  try {
    const prompt = `Categorize this webpage into one of the following categories:
- services: Pages about services offered
- about: Company information, team, history
- contact: Contact information, locations
- blog: Articles, news, updates
- products: Product listings, details
- pricing: Pricing information, plans
- faq: Frequently asked questions
- testimonials: Customer reviews, case studies
- careers: Job listings, company culture
- booking: Appointment booking, scheduling
- quote: Price quotes, estimates

URL: ${url}
Title: ${title}
Content: ${content.substring(0, 1000)}...

Category:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 10
    });

    const message = response.choices[0].message;
    if (!message?.content) return undefined;
    
    const category = message.content.trim().toLowerCase() as WebPageCategory;
    
    // Validate category
    const validCategories: WebPageCategory[] = [
      'services', 'about', 'contact', 'blog', 'products', 
      'pricing', 'faq', 'testimonials', 'careers', 'booking', 'quote'
    ];
    
    return validCategories.includes(category) ? category : undefined;
  } catch (error) {
    console.error('Error detecting category with OpenAI:', error);
    return undefined;
  }
}
  
