import { Embedding } from "@/lib/database/models/embeddings";
import { Document } from "@/lib/database/models/documents";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/general-config/general-config";
import { executeChatCompletion, OpenAIChatMessage } from "../openai-config/openai-core";
import { generateEmbedding } from "@/lib/llm-actions/chat-interactions/functions/embeddings";

/**
 * Vector Search and Conversational Answer Generation
 *
 * This module provides functionalities to perform semantic vector searches against a knowledge base
 * and generate conversational answers based on the search results using an LLM.
 *
 * Key Functions:
 * - `findBestVectorResultByCategory`:
 *   Finds the most relevant documents from a specific category in the knowledge base
 *   based on cosine similarity with a user's query embedding.
 *   It retrieves document embeddings, calculates similarity, and returns the top matches
 *   with their content, source, and confidence scores.
 *
 * - `getConversationalAnswer`:
 *   Takes a user's message and a category, preprocesses the message, generates an embedding,
 *   finds the best matching knowledge base entries using `findBestVectorResultByCategory`,
 *   then constructs a prompt with these matches for an LLM (e.g., GPT-4o) to generate a
 *   concise, conversational answer to the user's question, including a relevant follow-up.
 *
 * - `preprocessUserMessage`:
 *   A utility function to clean and normalize user messages before generating embeddings,
 *   improving the quality of vector search.
 *
 * Helper functions for cosine similarity and category key mapping are also included.
 */

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Accepts string (category) and returns string (index or original)
function getCategoryKey(category: string | Category): string {
  if (typeof category === 'number') return category.toString();
  const categoryEnum = Object.values(Category).find(c => 
    CATEGORY_DISPLAY_NAMES[c as Category] === category
  );
  return categoryEnum?.toString() || category;
}

export interface VectorSearchResult {
  documentId: string;
  content: string;
  category: string;
  similarityScore: number;
  source: string;
  confidenceScore: number;
  sourceUrl?: string;
}

export async function findBestVectorResultByCategory(
  userEmbedding: number[],
  category: string
): Promise<VectorSearchResult[]> {
  // 1. Get embeddings for the given category (support string or index)
  const categoryKey = getCategoryKey(category);
  const embeddings = await Embedding.getByCategory(categoryKey);
  if (!embeddings.length) return [];

  // 2. Get unique referenced documents
  const documentIds = Array.from(new Set(embeddings.map(e => e.documentId)));
  const documents = await Promise.all(documentIds.map(id => Document.getById(id)));
  const docMap = new Map(documents.map(doc => [doc.id, doc]));

  // 3. Calculate similarity and build results, parsing embedding if needed
  const results = embeddings.map(e => {
    let similarityScore = 0;
    let sourceEmbedding: any = e.embedding;
    if (typeof sourceEmbedding === 'string') {
      try {
        if ((sourceEmbedding as string).trim().startsWith('[')) {
          sourceEmbedding = JSON.parse(sourceEmbedding as string);
        } else {
          sourceEmbedding = (sourceEmbedding as string).split(',').map(Number);
        }
      } catch (err) {
        console.error('Failed to parse embedding string for documentId:', e.documentId);
        return null;
      }
    }
    if (!Array.isArray(userEmbedding) || !Array.isArray(sourceEmbedding)) {
      console.error('Embedding is not an array for documentId:', e.documentId);
      return null;
    }
    try {
      similarityScore = cosineSimilarity(userEmbedding, sourceEmbedding);
    } catch (err) {
      console.error('[Vector Search] Error calculating similarity for embedding:', {
        documentId: e.documentId,
        error: err
      });
      return null;
    }
    const doc = docMap.get(e.documentId);
    const confidenceScore = typeof e.metadata?.confidence === 'number'
      ? e.metadata.confidence
      : 0.5;
    return {
      documentId: e.documentId,
      content: e.content,
      category: e.category || '',
      similarityScore,
      source: e.metadata?.sourceUrl || doc?.source || 'unknown',
      confidenceScore,
      sourceUrl: e.metadata?.sourceUrl
    };
  }).filter(Boolean);

  // 4. Sort results by similarity
  const validResults = results
    .filter(r => r !== null) as VectorSearchResult[];
  const sortedResults = validResults.sort((a, b) => b.similarityScore - a.similarityScore);

  // 5. Always return the top 3 results (or all if less than 3)
  return sortedResults.slice(0, 3);
}

export async function getConversationalAnswer(
  category: string,
  userMessage: string
): Promise<string> {
  // Preprocess the user message before embedding
  const cleanMessage = preprocessUserMessage(userMessage);
  // Generate embedding from the cleaned message
  const cleanedEmbedding = await generateEmbedding(cleanMessage);

  // 1. Get best KB matches
  const matches = await findBestVectorResultByCategory(cleanedEmbedding, category);

  // Log best match details for debugging/monitoring
  if (matches.length > 0) {
    console.log('[Vector Search] Best matches:', matches.map(m => ({
      documentId: m.documentId,
      similarityScore: m.similarityScore,
      confidenceScore: m.confidenceScore,
      source: m.source,
      sourceUrl: m.sourceUrl
    })));
  }

  // 2. If there are matches, construct a prompt with all results
  if (matches.length > 0) {
    const prompt = `
You are a helpful and friendly customer service assistant for YS Company.

Instructions:
- Answer the user's question as concisely and directly as possible. If a short answer is possible, give it in one sentence.
- After your answer, always add a friendly follow-up question that is relevant to the user's question, and dont hallucinate.
- If the user's question is about contacting, booking, or pricing, always include the relevant link or contact detail from the knowledge base if available.
- Do NOT mention the source, category, or say 'based on' or similar phrases. Respond as if you are a human expert from the company.
- Do not repeat information or over-explain.
- If none of the provided information answers the user's question, respond with a friendly negative affirmation and follow-up question that is relevant to the user's question, and dont hallucinate.
- IMPORTANT: Below are 3 different results from the knowledge base. Choose the most relevant one to answer the user's question. Do NOT combine information from different results unless they are clearly related to the same topic.
- After your answer, indicate which result you chose by saying "Chosen result: [result number]".

Knowledge Base Info:
${matches.map((m, index) => `Result ${index + 1}: "${m.content}"`).join('\n')}

User Question:
"${userMessage}"

Give a concise, conversational answer with a follow-up.
    `;

    // 3. Call the LLM
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: "You are a helpful assistant for a customer service chatbot." },
      { role: "user", content: prompt }
    ];
    try {
      const completion = await executeChatCompletion(messages, "gpt-4o", 0.7);
      const response = completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
      
      // Extract the chosen result number from the response
      const chosenResultMatch = response.match(/Chosen result: (\d+)/);
      if (chosenResultMatch) {
        const chosenIndex = parseInt(chosenResultMatch[1]) - 1;
        if (chosenIndex >= 0 && chosenIndex < matches.length) {
          console.log('\n[Vector Search] Chosen result content:', matches[chosenIndex].content);
        }
      }
      
      return response;
    } catch (error) {
      console.error("[Vector Search] Error in executeChatCompletion:", error);
      return "I'm sorry, I couldn't generate a response.";
    }
  }

  return "I'm sorry, I couldn't find a relevant answer in the knowledge base.";
}

/**
 * Preprocesses and normalizes a user message for embedding generation.
 * - Trims whitespace
 * - Normalizes multiple spaces
 * - Normalizes quotes and dashes
 * - Removes most special characters
 * - Removes space before punctuation
 * - Converts to lowercase
 */
function preprocessUserMessage(message: string): string {
  return message
    .trim() // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ') // Normalize multiple spaces to one
    .replace(/[""''«»]/g, '"') // Normalize quotes
    .replace(/[–—]/g, '-') // Normalize dashes
    .replace(/[^a-zA-Z0-9\s.,?!'\"]/g, '') // Remove most special characters
    .replace(/\s([?.!\"](?:\s|$))/g, '$1') // Remove space before punctuation
    .toLowerCase(); // Convert to lowercase
} 