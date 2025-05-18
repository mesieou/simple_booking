// lib/bot/chatLogic.ts
/**
 * Chat Logic
 * This module handles the chat logic for the customer service assistant.
 * It processes the chat history and generates responses using OpenAI's API.
 */
import { createUserSchema } from "@/lib/bot/schemas";
import { systemPrompt } from "@/lib/bot/prompts";
import { User } from "@/lib/models/user";
import { chatWithFunctions, chatWithOpenAI, classifyMessage, ChatMessage, analyzeSentiment } from "@/lib/helpers/openai";

/**
 * Checks if a message needs clarification and returns an appropriate response if needed
 */
async function checkMessageClarity(message: string, history: ChatMessage[]): Promise<{needsClarification: boolean, response?: string}> {
  try {
    const classification = await classifyMessage(message, history);
    
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
      
      const response = await chatWithOpenAI(clarificationPrompt);
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
      
      const response = await chatWithOpenAI(guidancePrompt);
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
export async function handleChat(history: any[]) {
    // Get the last user message
    const lastUserMessage = history
      .slice()
      .reverse()
      .find(m => m.role === 'user');

    // If there's a user message, analyze its mood and check clarity
    if (lastUserMessage) {
      // Analyze mood of the user's message (without chat history)
      let moodContext = '';
      try {
        const sentiment = await analyzeSentiment(lastUserMessage.content);
        if (sentiment !== undefined) {
          // Simple threshold-based classification
          let mood = 'neutral';
          if (sentiment > 0.3) mood = 'positive';
          else if (sentiment < -0.3) mood = 'negative';
          
          console.log(`[Mood Analysis] Message: "${lastUserMessage.content}"`);
          console.log(`[Mood Analysis] Score: ${sentiment.toFixed(2)} (${mood})`);
          
          // Add mood context to the system prompt if needed
          if (mood === 'negative') {
            moodContext = 'The user seems frustrated. Be extra patient, understanding, and solution-focused in your response.';
          }
        }
      } catch (error) {
        console.error('[Mood Analysis] Error:', error);
      }

      // Check message clarity while maintaining conversation flow
      const clarityCheck = await checkMessageClarity(
        lastUserMessage.content, 
        history.filter(m => m.role !== 'system')
      );

      if (clarityCheck.needsClarification && clarityCheck.response) {
        // Only use the clarification response if we're confident it's needed
        // and the response is natural-sounding
        const shouldClarify = Math.random() > 0.3; // 70% chance to clarify
        if (shouldClarify) {
          return [...history, { role: 'assistant', content: clarityCheck.response }];
        }
      }
    }

    // Proceed with normal processing if no clarification is needed
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
        const followUp = await chatWithOpenAI([{ role: "system", content: systemPrompt}, ...history]) as { choices: { message: any }[] };
        history.push(followUp.choices[0].message);
        return history;
    }

    // If there was no function call, just push GPT's answer
    history.push(msg);
    return history;
}

