import { Embedding } from "@/lib/database/models/embeddings";
import { Document } from "@/lib/database/models/documents";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/general-config/general-config";
import { executeChatCompletion, OpenAIChatMessage } from "../openai-config/openai-core";
import { generateEmbedding } from "@/lib/conversation-engine/llm-actions/chat-interactions/functions/embeddings";
import { createClient } from "@/lib/database/supabase/server";

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
 * - `getBestKnowledgeMatch`:
 *   Takes a user's message, generates an embedding, and finds the single best
 *   matching document from the knowledge base using vector search. It returns
 *   the raw text content of that document.
 *
 * - `preprocessUserMessage`:
 *   A utility function to clean and normalize user messages before generating embeddings,
 *   improving the quality of vector search.
 *
 * Helper functions for cosine similarity and category key mapping are also included.
 */

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

export async function findBestVectorResult(
  userEmbedding: number[],
  businessId: string
): Promise<VectorSearchResult[]> {
  const supa = await createClient();

  const { data, error } = await supa.rpc('match_documents', {
    business_id_filter: businessId,
    query_embedding: userEmbedding,
    match_count: 5,
  });

  if (error) {
    console.error('[Vector Search] Error calling RPC function "match_documents":', error);
    return [];
  }

  if (!data) {
    console.log('[Vector Search] No results returned from RPC function.');
    return [];
  }
  
  // The 'data' returned from the RPC is already the sorted, filtered results.
  // We just need to map it to the expected 'VectorSearchResult' interface.
  return data.map((item: any) => ({
    documentId: item.id,
    content: item.content,
    category: item.category,
    similarityScore: item.similarity,
    source: item.source || 'Database',
    confidenceScore: item.similarity, // Use similarity as confidence for now
    sourceUrl: item.source
  }));
}

/**
 * Retrieves the raw text content of the best knowledge base match for a user's query.
 * @param userMessage The user's question.
 * @param businessId The ID of the business to search within.
 * @returns A promise that resolves to the string content of the best match, or null if no match is found.
 */
export async function getBestKnowledgeMatch(
  userMessage: string,
  businessId: string
): Promise<string | null> {
  // Preprocess the user message before embedding
  const cleanMessage = preprocessUserMessage(userMessage);
  // Generate embedding from the cleaned message
  const cleanedEmbedding = await generateEmbedding(cleanMessage);

  // 1. Get best KB matches using the new RPC-based search across all categories
  const matches = await findBestVectorResult(cleanedEmbedding, businessId);

  // If no matches are found, return null.
  if (matches.length === 0) {
    console.log('[Vector Search] No relevant documents found.');
    return null;
  }

  // Log the best match for debugging.
  const bestMatch = matches[0];
  console.log('[Vector Search] Best match found:', {
    documentId: bestMatch.documentId,
    similarityScore: bestMatch.similarityScore,
    content: bestMatch.content.substring(0, 150) + '...',
    source: bestMatch.source,
  });

  // 2. Return the raw text content of the top result.
  return bestMatch.content;
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