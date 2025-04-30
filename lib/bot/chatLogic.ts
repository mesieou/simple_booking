// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the moving-service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 * It also handles function calls for getting quotes and booking slots.
 */
import { getQuoteSchema, bookSlotSchema } from "@/lib/bot/schemas";
import {systemPrompt} from "@/lib/bot/prompts";
import { getQuote } from "@/lib/bot/helpers/quote";
import OpenAI from "openai";


const openai = new OpenAI();

export async function handleChat(history: any[]) {
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", //"gpt-4o-mini"
        messages: [{ role: "system", content: systemPrompt }, ...history ], 
        functions: [getQuoteSchema, bookSlotSchema],
        function_call: "auto"
    });

    const msg = completion.choices[0].message;

    // === Get Quote ===
    if (msg.function_call?.name === "getQuote") {
        // 1. Extract arguments coming from model
        const args = JSON.parse(msg.function_call.arguments || "{}");

        // 2. Run our helper, get the quote
        const quote = getQuote({pickup: args.pickup, dropoff: args.dropoff});
        
        // 3. Append assistant function call + our function response to history
        history.push(msg);
        history.push({
            role: "function",
            name: "getQuote",
            content: JSON.stringify(quote)
        });

        // 4. --- Second round ---
        // Ask the model o turn the raw quote into a human readable reply
        const followUp = await openai.chat.completions.create({
            model : "gpt-3.5-turbo", 
            messages: [{ role: "system", content: systemPrompt}, ...history],
        });

        // 5. Append the human sentence to history and return
        history.push(followUp.choices[0].message);
        return history;
    }


    // === Book Slot ===
    if (msg.function_call?.name === "bookSlot") {
        // TO DO: add booking logic here 
    }

    // default: append assistant reply
    return [...history, msg];
}