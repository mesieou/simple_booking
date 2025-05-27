// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { executeChatCompletion, ChatMessage, OpenAIChatMessage, OpenAIChatCompletionResponse, MoodAnalysisResult } from "@/lib/helpers/openai/openai-core";
import { analyzeSentiment } from "@/lib/helpers/openai/functions/sentimentAnalyzer";
import { generateEmbedding } from "@/lib/helpers/openai/functions/embeddings";
import { analyzeClientNeed } from "@/lib/helpers/openai/functions/clientNeed";
import { findBestVectorResultByCategory, getConversationalAnswer } from "@/lib/helpers/openai/functions/vectorSearch";

// Central function: takes existing history, and returns new history
export async function handleChat(history: OpenAIChatMessage[]) {
    // Get the last user message
    const lastUserMessage = history
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    let moodResult: MoodAnalysisResult | undefined;
    let userMessageEmbedding: number[] | null = null;
    let clientNeedResult: any = null;

    // If there's a user message, analyze its mood and client need in parallel
    if (lastUserMessage) {
      const [moodAnalysisResult, clientNeedAnalysis] = await Promise.all([
        // Mood analysis
        (async () => {
          try {
            const result = await analyzeSentiment(lastUserMessage.content);
            if (result !== undefined) {
              console.log(`[Mood Analysis] Message: "${lastUserMessage.content}"`);
              console.log(`[Mood Analysis] Score: ${result.score}/10 (${result.category}: ${result.description})`);
              return result;
            }
          } catch (error) {
            console.error('[Mood Analysis] Error:', error);
          }
          return undefined;
        })(),
        
        // Client need analysis
        (async () => {
          try {
            const chatHistory = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }));
            return await analyzeClientNeed(lastUserMessage.content, chatHistory);
          } catch (error) {
            console.error('[Client Need Analysis] Error:', error);
            return null;
          }
        })()
      ]);

      // Store the results
      moodResult = moodAnalysisResult;
      clientNeedResult = clientNeedAnalysis;

      // Log client need analysis
      if (clientNeedResult) {
        console.log(`[Client Need] Message: "${lastUserMessage.content}"`);
        console.log(`[Client Need] Type: ${clientNeedResult.need_type}`);
        console.log(`[Client Need] Intent: ${clientNeedResult.intent}`);
        console.log(`[Client Need] Confidence: ${clientNeedResult.confidence.toFixed(2)}`);
        
        if (clientNeedResult.need_type === 'specific' && clientNeedResult.category) {
          console.log(`[Client Need] Specific Category: ${clientNeedResult.category}`);
          // Generate embedding only if we have a specific category
          try {
            // Use LLM to generate a natural response
            const llmResponse = await getConversationalAnswer(
              clientNeedResult.category,
              lastUserMessage.content
            );
            return [...history, {
              role: 'assistant',
              content: llmResponse
            }];
          } catch (error) {
            console.error('[Embedding/Vector Search] Error:', error);
          }
        } else {
          console.log('[Client Need] No specific category detected');
        }
      }

      // Add mood context if needed
      let moodContext = '';
      if (moodResult?.category === 'frustrated') {
        moodContext = `The user seems ${moodResult.description}. Be extra patient, understanding, and solution-focused in your response.`;
      }
    }

    // Proceed with normal processing
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => {
        if (msg.role === 'function') {
          return {
            role: 'function' as const,
            name: msg.name,
            content: msg.content
          };
        }
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content
        };
      })
    ];
    
    // Check if GPT wants to call a function
    const completion = await executeChatCompletion(messages, "gpt-4o", 0.3, 1000, [createUserSchema]);
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
            history.push({ 
                role: 'assistant', 
                content: msg.content || '',
                function_call: msg.function_call
            });
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
            history.push({ 
                role: 'assistant', 
                content: msg.content || '',
                function_call: msg.function_call
            });
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
        const followUp = await executeChatCompletion([{ role: "system", content: systemPrompt}, ...history], "gpt-4o");
        history.push({ 
            role: 'assistant', 
            content: followUp.choices[0].message.content || '' 
        });
        return history;
    }

    // Add the response to history
    const responseMessage: OpenAIChatMessage = {
      role: 'assistant',
      content: msg.content || '',
      function_call: msg.function_call
    };

    return [...history, responseMessage];
}

