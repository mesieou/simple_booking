// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import {createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { chatWithFunctions } from "@/lib/helpers/openai/openai-helpers";
import { executeChatCompletion } from "@/lib/helpers/openai/openai-core";

// Central function: takes existing history, and returns new history
export async function handleChat(history: any[]) {
    const messages = [{ role: "system", content: systemPrompt }, ...history];
    
    // Check if GPT wants to call a function
    const completion = await chatWithFunctions(messages, [createUserSchema]);
    const msg = completion.choices[0].message;

    // === Create User ===
    // OpenAI function-calling responses include a function_call property when a function is triggered.
    // The type definition in openai.ts now supports this.
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

            // Push the function call and result to history
            history.push(msg);
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({
                    success: true, 
                    userId: result.data.id
                }),
            });

        } catch (err) {
            console.error("User creation error:", err);
            history.push(msg);
            history.push({
                role: "function",
                name: "createUser",
                content: JSON.stringify({ 
                    success: false, 
                    error: (err as any).message || String(err)
                }),
            });
        }

        // After function runs, GPT needs to respond again
        const followUp = await executeChatCompletion([{ role: "system", content: systemPrompt}, ...history], "gpt-4o") as { choices: { message: any }[] };
        history.push(followUp.choices[0].message);
        return history;
    }

    // If there was no function call, just push GPT's answer
    history.push(msg);
    return history;
}

