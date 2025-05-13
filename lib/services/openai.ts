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
 * The returned object follows OpenAI’s chat completion format.
 * Use `response.choices[0].message` to get the assistant's reply or function call trigger.
 */
import OpenAI from "openai";

const openai = new OpenAI();

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
  
