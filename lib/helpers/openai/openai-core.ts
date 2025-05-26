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
import { pushToQueue } from "./rate-limiter";

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
  role: 'user' | 'assistant';
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
  }>;
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
  timeout: 30000,
});

// Core functions
export async function executeChatCompletion(
  messages: OpenAIChatMessage[],
  model: string = "gpt-4o",
  temperature: number = 0.3,
  maxTokens: number = 1000,
  functions?: any[]
): Promise<OpenAIChatCompletionResponse> {
  return new Promise((resolve, reject) => {
    pushToQueue(async () => {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(functions && { functions, function_call: "auto" }),
        });
        // Normalize the response to match OpenAIChatCompletionResponse
        const normalized: OpenAIChatCompletionResponse = {
          choices: response.choices.map((choice: any) => ({
            message: {
              role: "assistant",
              content: choice.message.content,
              ...(choice.message.function_call && choice.message.function_call !== null
                ? { function_call: {
                    name: choice.message.function_call.name,
                    arguments: choice.message.function_call.arguments,
                  } }
                : {}),
            },
          })),
        };
        resolve(normalized);
      } catch (error) {
        reject(error);
      }
    });
  });
} 