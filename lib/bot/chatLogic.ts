// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the moving-service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 * It also handles function calls for getting quotes and booking slots.
 */
import {createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import OpenAI from "openai";

const openai = new OpenAI();

// Central function: takes existing history, and returns new history
export async function handleChat(history: any[]) {
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: systemPrompt }, ...history ],
        functions: [createUserSchema],
        function_call: "auto"
    });

    const msg = completion.choices[0].message;

    // === Create User ===
    if (msg.function_call?.name === "createUser") {
        const {firstName, lastName} = JSON.parse(msg.function_call.arguments || "{}");

        try {
            // Create a new user with customer role and hardcoded business ID
            const user = new User(
                firstName,
                lastName,
                "customer",
                "5daa4f28-1ade-491b-be8b-b80025ffc2c4"  // hardcoded business ID
            );

            // Add the user to the database
            const result = await user.add();

            history.push(msg);
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({
                    success: true, 
                    userId: result.data.id
                })
            });

            const followUp = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: systemPrompt}, ...history],
            });

            history.push(followUp.choices[0].message);
            return history;
        } catch (error) {
            console.error("User creation error:", error);
            history.push(msg);
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({ 
                    success: false, 
                    error: (error as any).message || String(error)
                })
            });

            const followUp = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: systemPrompt}, ...history],
            });

            history.push(followUp.choices[0].message);
            return history;
        }
    }

    // // === Get Quote ===
    // if (msg.function_call?.name === "getQuote") {
    //     // 1. Extract arguments coming from model
    //     const args = JSON.parse(msg.function_call.arguments || "{}");

    //     // 2. Run our helper, get the quote
    //     const quote = getQuote({
    //         pickup: args.pickup,
    //         dropoff: args.dropoff,
    //         // Optional parameters will use their default values
    //     });
        
    //     // 3. Append assistant function call + our function response to history
    //     history.push(msg);
    //     history.push({
    //         role: "function",
    //         name: "getQuote",
    //         content: JSON.stringify(quote)
    //     });

    //     // 4. --- Second round ---
    //     // Ask the model o turn the raw quote into a human readable reply
    //     const followUp = await openai.chat.completions.create({
    //         model : "gpt-3.5-turbo", 
    //         messages: [{ role: "system", content: systemPrompt}, ...history],
    //     });

    //     // 5. Append the human sentence to history and return
    //     history.push(followUp.choices[0].message);
    //     return history;
    // }

    // if (msg.function_call?.name === "get_slots") {
    //     // Pull out the date sent by the model
    //     const {date} = JSON.parse(msg.function_call.arguments || "{}");
        
    //     // Generate 4 slots
    //     const slots = makeSlots(date);

    //     // Record assistants function call and our function respose
    //     history.push(msg);
    //     history.push({
    //         role: "function",
    //         name: "get_slots",
    //         content: JSON.stringify(slots)
    //     });

    //     // ask the modle to phrase the slot list in human lang
    //     const followUp = await openai.chat.completions.create({
    //         model : "gpt-3.5-turbo", 
    //         messages: [{ role: "system", content: systemPrompt}, ...history],
    //     });

    //     // append the friendly sentence and return final history
    //     history.push(followUp.choices[0].message);
    //     return history;

    // }

    // // === Book Slot ===
    // if (msg.function_call?.name === "book_slot") {
    //     // TO DO: add booking logic here 
    //     const args = JSON.parse(msg.function_call.arguments || "{}");
    //     const receipt = { status:"confirmed", args};

    //     history.push(msg);
    //     history.push({
    //         role: "function",
    //             name: "book_slot",
    //             content: JSON.stringify(receipt)
    //     });

    //     const followUp = await openai.chat.completions.create({
    //         model : "gpt-3.5-turbo", 
    //         messages: [{ role: "system", content: systemPrompt}, ...history],
    //     });

    //     history.push(followUp.choices[0].message);
    //     return history;
        
    // }

    // default: append assistant reply
    return [...history, msg];
}
//