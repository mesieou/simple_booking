import { executeChatCompletion, OpenAIChatMessage, OpenAIChatCompletionResponse, ChatMessage, MoodAnalysisResult, ChatResponse } from "./openai-core";
import OpenAI from "openai";
import { CategorizedContent, VALID_CATEGORIES } from "@/lib/bot/content-crawler/types";

export type { MoodAnalysisResult };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

export async function chatWithFunctions(
  messages: OpenAIChatMessage[],
  functions: any[]
): Promise<OpenAIChatCompletionResponse> {
  return await executeChatCompletion(messages, "gpt-4o", 0.3, 1000, functions);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

export async function detectMissingInformation(
  categorizedContent: { category: string; content: string }[]
): Promise<string> {
  console.log(
    "\n[Missing Information Detection] Analyzing categorized content:"
  );
  categorizedContent.forEach((item, index) => {
    console.log(`\nCategory ${index + 1}: ${item.category}`);
    console.log(`Content preview: ${item.content.substring(0, 200)}...`);
  });

  const formattedContent = categorizedContent
    .map((c) => `Category: ${c.category}\nContent:\n${c.content}`)
    .join("\n\n");

  const prompt = `You are reviewing the content of a business website that has been categorized. Based on the content in each category, identify which of the following critical items are MISSING or INCOMPLETE:\n\n${VALID_CATEGORIES.map((cat) => `- ${cat}`).join("\n")}\n\nCategorized Content:\n${formattedContent}`;

  const response = await executeChatCompletion([
    {
      role: "system",
      content: "You help identify missing business website content.",
    },
    { role: "user", content: prompt },
  ], "gpt-4", 0.3, 500);

  const result = response.choices[0]?.message?.content || "";
  console.log("\nMissing information analysis result:");
  console.log(result);

  return result;
}

export async function categorizeWebsiteContent(
  text: string,
  businessId: string,
  websiteUrl: string
): Promise<CategorizedContent[]> {
  const prompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return:\n\n- \"category\": one of the following, written EXACTLY as shown (case, spaces, and punctuation must match):\n${VALID_CATEGORIES.map(cat => `  - \"${cat}\"`).join('\n')}\n\nDo NOT invent new categories. If content does not fit any, use the closest match from the list above.\n- \"content\": the full, detailed text of the section (do NOT omit or summarize any details)\n- \"confidence\": a score from 0.5 to 1.0 based on how well the content fits the chosen category\n\nIMPORTANT:\n- You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.\n- Do NOT repeat or duplicate the same information in multiple sections. Each piece of information should appear only once, in the most appropriate category.\n- If content fits multiple categories, include it in the most relevant one, but do NOT copy it to others.\n- The output will be used for a customer assistant. Missing details will degrade its performance.\n- Be as granular as needed to ensure every piece of information is included in some section.\n- If a section touches multiple themes, choose the dominant one but do NOT drop any details.\n- Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).\n- Do NOT summarize or compress content. Include all original details.\n- Do Not add any information that is not in the text.\n\nReturn a valid JSON array like this:\n\n[\n  {\n    \"category\": \"faq\",\n    \"content\": \"How long does it take... You need to keep receipts for 5 years...\",\n    \"confidence\": 0.95\n  }\n]\n\nHere is all the cleaned text content from the site (ID: ${businessId}, URL: ${websiteUrl}):\n\n${text}`;

  const response = await executeChatCompletion([
    { role: "system", content: "You are a helpful assistant that analyzes business websites." },
    { role: "user", content: prompt }
  ], "gpt-4o", 0.3, 4096);

  return safeParseOpenAIJson<CategorizedContent[]>(response.choices[0]?.message?.content ?? undefined);
}

export function safeParseOpenAIJson<T>(raw: string | undefined): T {
  if (!raw) throw new Error("No content to parse");
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON array from output using regex
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error("Failed to parse OpenAI JSON output");
  }
}

export async function analyzeCategoryQualityWithGPT(
  category: string,
  content: string,
  websiteUrl: string
): Promise<{ issues: string[]; recommendations: string[]; score: number }> {
  const prompt = `You are reviewing the content for the \"${category}\" section of a business website (website: ${websiteUrl}).\n\nThis content will be used by a customer service bot to assist and inform customers.\n\n1. Assess the quality and completeness of the content below for this category, specifically for customer support and user experience.\n2. List any issues, missing details, or improvements needed (as an array of strings) that would help the bot provide excellent customer service.\n3. Provide specific recommendations for improvement (as an array of strings) to ensure the bot can answer customer questions accurately and helpfully.\n4. Give an overall quality score from 0-100 (as a number), focused on customer-facing usefulness.\n\nReturn a JSON object with this structure:\n{\n  "issues": ["issue1", "issue2"],\n  "recommendations": ["recommendation1", "recommendation2"],\n  "score": 75\n}\n\nHere is the content for this category:\n${content}`;

  try {
    const response = await executeChatCompletion([
      {
        role: "system",
        content: "You are a content analysis expert that helps ensure customer service bots have all necessary information to support and inform users effectively."
      },
      { role: "user", content: prompt }
    ], "gpt-4o", 0.3, 500);
    const gptResponse = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(gptResponse);
    return {
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      score: typeof result.score === 'number' ? result.score : 0
    };
  } catch (error) {
    console.error(`Error analyzing category ${category}:`, error);
    return { issues: ["Error analyzing content"], recommendations: [], score: 0 };
  }
}

export async function detectConversationCategory(
  conversation: { role: 'user' | 'assistant', content: string }[],
  categories: string[]
): Promise<string | undefined> {
  const prompt = `You are an expert assistant. Given the following conversation, select the best matching category from this list:\n${categories.map(c => `- ${c}`).join('\n')}\n\nConversation:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nReturn ONLY the category name, nothing else.`;

  const response = await executeChatCompletion([
    { role: 'system', content: 'You are a helpful assistant that categorizes conversations.' },
    { role: 'user', content: prompt }
  ], 'gpt-4o', 0.3, 256);

  const result = response.choices[0]?.message?.content?.trim();
  if (!result) return undefined;
  // Return the best matching category (case-insensitive)
  const match = categories.find(cat => cat.toLowerCase() === result.toLowerCase());
  return match || undefined;
}

export async function analyzeSentiment(text: string): Promise<MoodAnalysisResult | undefined> {
  try {
    const prompt = `Analyze the mood/sentiment of the following text and return a JSON object with the following properties:
- score: a number between 1 and 10, where 1 is very frustrated/angry and 10 is very happy/positive
- category: one of these categories: 'frustrated' (for scores 1-3), 'neutral' (for scores 4-6), or 'positive' (for scores 7-10)
- description: a brief phrase describing the specific emotion detected (e.g., "slightly annoyed", "very satisfied")

IMPORTANT GUIDELINES:
1. Do NOT confuse short or direct messages with frustration unless there is clear emotional or negative language present.
2. Informational or factual statements should generally be scored as neutral (4-6) even if they are brief.
3. Only classify as 'frustrated' (1-3) when there are clear indicators of negative emotion such as:
   - Explicit complaints
   - Negative emotional words
   - Expressions of dissatisfaction
   - Repeated questions or statements indicating impatience

Examples:
- "its a local move, and i need to move an refrigerator" → score: 5, category: neutral, description: informative
- "seriously? this is the third time I've asked" → score: 2, category: frustrated, description: annoyed
- "thank you so much for the help!" → score: 9, category: positive, description: appreciative

IMPORTANT: Return ONLY the raw JSON object without any markdown formatting, code blocks, or additional explanation. Do not wrap the JSON in \`\`\` tags.

Text: "${text}"`;

    const response = await executeChatCompletion([
      {
        role: "system" as const,
        content: "You are a mood analysis tool that returns a JSON object with score, category, and description. You must return only raw JSON without markdown formatting or code blocks. Do not confuse direct or short messages with frustration unless there is clear negative emotional content."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ], "gpt-4o", 0.3, 500) as unknown as ChatResponse;

    let resultText = response.choices[0]?.message?.content?.trim();
    if (!resultText) return undefined;

    try {
      // Clean up the result text if it contains markdown code blocks
      if (resultText.includes('```')) {
        // Extract JSON from markdown code blocks
        const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          resultText = jsonMatch[1].trim();
        } else {
          // If we can't extract from code blocks, try to remove markdown markers
          resultText = resultText.replace(/```json|```/g, '').trim();
        }
      }

      console.log('Cleaned JSON result:', resultText);
      
      const result = JSON.parse(resultText);
      
      // Validate and normalize the result
      const score = Math.max(1, Math.min(10, isNaN(result.score) ? 5 : result.score));
      
      // Ensure category is one of the expected values
      let category = result.category?.toLowerCase() || '';
      if (!['frustrated', 'neutral', 'positive'].includes(category)) {
        // Derive category from score if not valid
        if (score <= 3) category = 'frustrated';
        else if (score <= 6) category = 'neutral';
        else category = 'positive';
      }
      
      return {
        score,
        category,
        description: result.description || ''
      };
    } catch (parseError) {
      console.error('Error parsing mood analysis result:', parseError);
      return undefined;
    }
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return undefined;
  }
}

export async function clarifyMessage(
  message: string, 
  chatHistory: ChatMessage[] = []
): Promise<'clear' | 'unclear' | 'irrelevant' | undefined> {
  try {
    
    // Format the chat history for context
    const historyContext = chatHistory.length > 0 
      ? `\n\nPrevious conversation context (most recent first):\n` +
        chatHistory
          .slice(-5) // Limit to last 5 messages to avoid too much context
          .reverse() // Show most recent first
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')
      : '';

    const prompt = `You are a message clarity classifier.\n\nYour job is to receive a user message and its conversation context, then classify it into one of the following labels:\n\n- clear → the message is well-formed and understandable; the bot can reply without needing more context\n- unclear → the message is vague, ambiguous, or lacks context; it would require clarification before responding\n- irrelevant → the message has nothing to do with customer service or is off-topic (e.g., emojis, jokes, random text)\n\nImportant considerations:\n1. If the message refers to something in the conversation history, it might be clear\n2. If the message is a follow-up without context (e.g., \"What about that thing?\"), it's likely unclear\n3. If the message is completely out of context from the conversation, it might be irrelevant\n\nInstructions:\n- Only reply with one of the three labels: \`clear\`, \`unclear\`, or \`irrelevant\`\n- Do not provide any explanation or extra text\n- Be strict — if there is any doubt or ambiguity, classify it as \`unclear\`\n\nExamples with context:\n1. Previous: user: \"I want to book a moving service\"\n   New: \"For next Monday\" → clear  \n2. Previous: (no context)\n   New: \"For next Monday\" → unclear  \n3. New: \"😂😂😂\" → irrelevant\n\nNow classify this message:${historyContext}\n\nNew message to classify:\n${message}`;

    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant that classifies message clarity based on both the message and conversation context."
      },
      {
        role: "user" as const,
        content: prompt
      }
    ];
    const response = await executeChatCompletion(messages, "gpt-4o", 0.3, 500) as unknown as ChatResponse;

    const classification = response.choices[0]?.message?.content?.trim().toLowerCase();

    // Validate the response is one of the expected values
    if (classification === 'clear' || classification === 'unclear' || classification === 'irrelevant') {
      return classification;
    }

    return 'unclear'; // Default to 'unclear' if the response is not as expected
  } catch (error) {
    console.error('Error classifying message:', error);
    return undefined;
  }
}