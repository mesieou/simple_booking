import OpenAI from "openai";
import { waitForRateLimit } from "./rate-limiter";

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIChatCompletionResponse {
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

export async function executeChatCompletion(
  messages: OpenAIChatMessage[],
  model: string = "gpt-4o",
  temperature: number = 0.3,
  maxTokens: number = 1000,
  functions?: any[]
): Promise<OpenAIChatCompletionResponse> {
  await waitForRateLimit(maxTokens);
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
  return normalized;
} 