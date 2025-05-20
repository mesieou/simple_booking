// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { executeChatCompletion, ChatMessage, OpenAIChatMessage, OpenAIChatCompletionResponse } from "@/lib/helpers/openai/openai-core";
import { chatWithFunctions, clarifyMessage, analyzeSentiment } from "@/lib/helpers/openai/openai-helpers";
import { processMoodAndCheckForAlert } from "@/lib/helpers/alertSystem";

/**
 * Checks if a message needs clarification and returns an appropriate response if needed
 */
async function checkMessageClarity(message: string, history: ChatMessage[]): Promise<{needsClarification: boolean, response?: string}> {
  try {
    const classification = await clarifyMessage(message, history);
    
    if (classification === 'unclear') {
      // Generate a natural-sounding clarification request
      // Format messages with proper spacing
      const clarificationPrompt = [
        { 
          role: 'system' as const, 
          content: systemPrompt.trim() // Ensure no extra whitespace
        },
        ...history.map(msg => ({
          ...msg,
          content: msg.content.trim() // Clean up existing messages
        })),
        { 
          role: 'user' as const, 
          content: `The user said: "${message.trim()}"`
        },
        {
          role: 'system' as const,
          content: 'The message might need clarification. Generate a single, natural question to ask for clarification without repeating the user\'s message.'
        }
      ];
      
      const response = await executeChatCompletion(clarificationPrompt, "gpt-4o", 0.3, 500);
      return {
        needsClarification: true,
        response: response.choices[0]?.message?.content || "Could you please clarify what you mean?"
      };
    } else if (classification === 'irrelevant') {
      // Gently guide back to relevant topics
      const guidancePrompt = [
        { 
          role: 'system' as const, 
          content: systemPrompt.trim() // Ensure no extra whitespace
        },
        ...history.map(msg => ({
          ...msg,
          content: msg.content.trim() // Clean up existing messages
        })),
        { 
          role: 'user' as const, 
          content: `The user said: "${message.trim()}"`
        },
        {
          role: 'system' as const,
          content: 'The message seems unrelated to moving services. Generate a single, natural response to guide the conversation back to moving-related topics.'
        }
      ];
      
      const response = await executeChatCompletion(guidancePrompt, "gpt-4o", 0.3, 500);
      return {
        needsClarification: true,
        response: response.choices[0]?.message?.content || "I'm here to help with your moving and storage needs. Could you tell me more about what you're looking for?"
      };
    }
    
    return { needsClarification: false };
  } catch (error) {
    console.error('Error checking message clarity:', error);
    return { needsClarification: false };
  }
}
// Central function: takes existing history, and returns new history
export async function handleChat(history: OpenAIChatMessage[]) {
    // Get the last user message
    const lastUserMessage = history
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    // If there's a user message, analyze its mood and check clarity in parallel
    if (lastUserMessage) {
      const [moodResult, clarityCheck] = await Promise.all([
        // Mood analysis
        (async () => {
          try {
            const result = await analyzeSentiment(lastUserMessage.content);
            if (result !== undefined) {
              console.log(`[Mood Analysis] Message: "${lastUserMessage.content}"`);
              console.log(`[Mood Analysis] Score: ${result.score}/10 (${result.category}: ${result.description})`);
              
              // Check if we should alert an admin based on the mood score
              const tempUserId = history.length > 0 ? 
                `user_${history[0].content.substring(0, 10).replace(/\W/g, '')}_${new Date().toISOString().split('T')[0]}` : 
                `anonymous_${new Date().getTime()}`;
                
              const alertTriggered = processMoodAndCheckForAlert(tempUserId, result);
              
              if (alertTriggered) {
                console.log(`[ADMIN NOTIFICATION] Alert triggered for user ${tempUserId}`);
                console.log(`[ADMIN NOTIFICATION] Consider reaching out to this customer directly`);
              }
              
              return result;
            }
          } catch (error) {
            console.error('[Mood Analysis] Error:', error);
          }
          return undefined;
        })(),
        
        // Clarity check
        (async () => {
          const chatHistory = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }));
          return await checkMessageClarity(lastUserMessage.content, chatHistory);
        })()
      ]);

      // Handle clarity check result
      if (clarityCheck.needsClarification && clarityCheck.response) {
        const shouldClarify = Math.random() > 0.3; // 70% chance to clarify
        if (shouldClarify) {
          return [...history, { role: 'assistant', content: clarityCheck.response }];
        }
      }

      // Add mood context if needed
      let moodContext = '';
      if (moodResult?.category === 'frustrated') {
        moodContext = `The user seems ${moodResult.description}. Be extra patient, understanding, and solution-focused in your response.`;
      }
    }

    // Proceed with normal processing if no clarification is needed
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

    // If there was no function call, just push GPT's answer
    history.push({ 
        role: 'assistant', 
        content: msg.content || '' 
    });
    return history;
}

