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