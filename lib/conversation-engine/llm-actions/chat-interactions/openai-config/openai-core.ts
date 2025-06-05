/**
 * OpenAI Core Module
 * 
 * This module serves as the central interface for all OpenAI API interactions in the application.
 * It provides core functionality for chat completions, message handling, and type definitions.
 * 
 * Key Features:
 * 1. Type Definitions:
 *    - OpenAIChatMessage: Defines the structure of messages in the chat
 *    - ChatMessage: Simplified message structure for internal use
 *    - ChatResponse: Standard response format from OpenAI
 *    - MoodAnalysisResult: Structure for sentiment analysis results
 * 
 * 2. Core Functions:
 *    - executeChatCompletion: Main function for making OpenAI API calls
 *    - Handles rate limiting through queue system
 *    - Supports function calling capabilities
 *    - Manages response normalization
 * 
 * 3. Configuration:
 *    - OpenAI client setup with retry logic
 *    - Default parameters for API calls
 *    - Environment variable integration
 * 
 * This module is used by other components that need to interact with OpenAI's API,
 * providing a consistent interface and standardized response formats.
 */

import OpenAI from "openai";
import { scheduleTask } from "./rate-limiter";

// Core interfaces
export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  metadata?: {
    confidence?: {
      overall: number;
      contextMatch: number;
      responseQuality: number;
      reason: string;
      missingInformation: string[];
    };
  };
} | {
  role: "function";
  name: string;
  content: string;
};

export type ChatMessage = {
  role: 'user' | 'bot';
  content: string;
} | {
  role: 'function';
  name: string;
  content: string;
};

export interface ChatResponse {
  choices: Array<{
    message: {
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
  }>;
}

export interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      role: "assistant";
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
    finish_reason?: OpenAI.Chat.Completions.ChatCompletion.Choice['finish_reason'];
  }>;
  usage?: OpenAI.CompletionUsage;
}

export interface MoodAnalysisResult {
  score: number;       // 1-10 scale
  category: string;    // 'frustrated', 'neutral', or 'positive'
  description: string; // Detailed description of the mood
}

// OpenAI client configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000,
});

// Core functions
export async function executeChatCompletion(
  messages: OpenAIChatMessage[],
  model: string = "gpt-4o",
  temperature: number = 0.3,
  maxTokens: number = 8192,
  functions?: any[]
): Promise<OpenAIChatCompletionResponse> {

  const taskToSchedule = async (): Promise<OpenAIChatCompletionResponse> => {
    let urlHint = 'N/A';
    let promptSample = 'N/A';
    try {
      const userMessage = messages.find(m => m.role === 'user');
      if (userMessage && userMessage.content) {
        promptSample = userMessage.content.substring(0, 100) + (userMessage.content.length > 100 ? '...' : '');
        const urlMatch = userMessage.content.match(/URL:\s*(\S+)/i) || 
                         userMessage.content.match(/websiteUrl:\s*(\S+)/i) || 
                         userMessage.content.match(/sourceUrl:\s*(\S+)/i);
        if (urlMatch && urlMatch[1]) {
          urlHint = urlMatch[1];
        } else {
          urlHint = promptSample;
        }
      }

      console.log(`[OpenAI Core] Executing chat completion. Model: ${model}, Max Tokens: ${maxTokens}, Hint: ${urlHint}`);
      
      const response = await openai.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature,
        max_tokens: maxTokens,
        ...(functions && { functions, function_call: "auto" }),
      });

      const firstChoice = response.choices && response.choices[0];
      if (firstChoice) {
        console.log(`[OpenAI Core] API Call Success. Finish Reason: ${firstChoice.finish_reason}, Hint: ${urlHint}`);
        if (firstChoice.finish_reason === 'length') {
          console.warn(`[OpenAI Core] WARNING: Completion for model ${model} (Hint: ${urlHint}) stopped due to max_tokens limit (${maxTokens}).`);
        }
      }
      if (response.usage) {
         console.log(`[OpenAI Core] Token Usage (Hint: ${urlHint}): Prompt: ${response.usage.prompt_tokens}, Completion: ${response.usage.completion_tokens}, Total: ${response.usage.total_tokens}`);
      }

      const normalized: OpenAIChatCompletionResponse = {
        choices: response.choices.map((choice: OpenAI.Chat.Completions.ChatCompletion.Choice) => ({
          message: {
            role: choice.message.role as "assistant", 
            content: choice.message.content,
            ...(choice.message.function_call
              ? { function_call: {
                  name: choice.message.function_call.name,
                  arguments: choice.message.function_call.arguments,
                } }
              : {}),
          },
          finish_reason: choice.finish_reason, 
        })),
        usage: response.usage
      };
      return normalized; 
    } catch (error) {
      console.error(`[OpenAI Core] Error during chat completion (Hint: ${urlHint}, Prompt Sample: ${promptSample}):`, error);
      throw error; 
    }
  };
  
  const promptTokenEstimate = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / 3.5;
  const estimatedTotalTokens = promptTokenEstimate + maxTokens;

  return scheduleTask(taskToSchedule, Math.ceil(estimatedTotalTokens));
} 