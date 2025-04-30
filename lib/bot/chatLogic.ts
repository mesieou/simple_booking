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
        const args = JSON.parse(msg.function_call.arguments || "{}");
        const quote = getQuote({pickup: args.pickup, dropoff: args.dropoff});
        history.push(msg);
        history.push({
            role: "function",
            name: "getQuote",
            content: JSON.stringify(quote)
        });
        return history;
    }

    // === Book Slot ===
    if (msg.function_call?.name === "bookSlot") {
        // TO DO: add booking logic here 
    }

    // default: append assistant reply
    return [...history, msg];
}