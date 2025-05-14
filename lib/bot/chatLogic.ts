// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import {createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { chatWithFunctions, chatWithOpenAI } from "@/lib/helpers/openai";
import { generateEmbedding } from "@/lib/helpers/openai";
import { Embedding } from "@/lib/models/embeddings";


// Central function: takes existing history, and returns new history
export async function handleChat(history: any[]) {
    const messages = [{ role: "system", content: systemPrompt }, ...history];
    
    // Check if GPT wants to call a function
    const completion = await chatWithFunctions(messages, [createUserSchema]);
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
        const followUp = await chatWithOpenAI([{ role: "system", content: systemPrompt}, ...history]);
        history.push(followUp.choices[0].message);
        return history;
    }

    // If there was no function call, just push GPT's answer
    history.push(msg);
    return history;
}

export async function handleCustomerMessage(message: string) {
    console.log("Received customer message:", message);

    const embedding = await generateEmbedding(message);
    console.log("Embeded customer message:", embedding);

    const similarChunks = await Embedding.findSimilar(embedding, 5);
    // console.log("Top matching chunks:", similarChunks);

    // 3. Create context from the chunks
    const context = similarChunks
        .map((chunk: any) => chunk.content)
        .join("\n\n");

    // 4. Create messages array with system prompt, context, and user message
    const messages = [
        { 
            role: "system", 
            content: `${systemPrompt} Relevant business information: ${context}`
        },
        { 
            role: "user", 
            content: message 
        }
    ];

    // 5. Get response from OpenAI
    const response = await chatWithOpenAI(messages);
    
    console.log("OpenAI response:", response.choices[0].message.content);
    // 6. Return the response
    return response.choices[0].message.content;
}

