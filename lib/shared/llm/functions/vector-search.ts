import { Embedding } from "@/lib/database/models/embeddings";
import { Document } from "@/lib/database/models/documents";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/general-config/general-config";
import { executeChatCompletion, OpenAIChatMessage } from "../openai/openai-core";
import { generateEmbedding } from "@/lib/shared/llm/functions/embeddings";
import { getEnvironmentServerClient } from "@/lib/database/supabase/environment";

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

// --- CONFIGURATION FOR SCORE BOOSTING ---
// We define boost factors for specific document types to give them priority.
// A factor of 1.2 means a 20% boost in similarity score.
const BOOST_FACTORS: { [key: string]: number } = {
  'service': 1.2,
};

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
  type?: string;
}

export async function findBestVectorResult(
  userEmbedding: number[],
  businessId: string
): Promise<VectorSearchResult[]> {
  const supa = getEnvironmentServerClient();

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
    sourceUrl: item.source,
    type: item.type
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
  
  console.log(`[Vector Search] Top result before boosting: Type='${matches[0].type}', Score=${matches[0].similarityScore}, ID=${matches[0].documentId}`);

  // 2. Re-rank matches by applying boost factors
  const reRankedMatches = matches.map(match => {
    // The document's type might be null or undefined, so we use a fallback key.
    const typeKey = match.type || 'default';
    const boost = BOOST_FACTORS[typeKey] || 1; // Default boost is 1 (no change)

    if (boost > 1) {
      console.log(`[Vector Search] Boosting score for document ID ${match.documentId} (Type: ${typeKey}) by ${((boost - 1) * 100).toFixed(0)}%`);
    }

    return {
      ...match,
      boostedScore: match.similarityScore * boost
    };
  });

  // 3. Sort the matches by their new boosted score
  reRankedMatches.sort((a, b) => b.boostedScore - a.boostedScore);


  // 4. The best match is now the first one in the re-ranked list.
  const bestMatch = reRankedMatches[0];
  console.log(`[Vector Search] Best match after boosting: Type='${bestMatch.type}', Final Score=${bestMatch.boostedScore}, ID=${bestMatch.documentId}`);

  // Log the best match for debugging.
  // const bestMatch = matches[0]; // Old logic
  console.log('[Vector Search] Final chosen match details:', {
    documentId: bestMatch.documentId,
    originalScore: bestMatch.similarityScore,
    boostedScore: bestMatch.boostedScore,
    content: bestMatch.content.substring(0, 150) + '...',
    source: bestMatch.source,
    type: bestMatch.type
  });

  // 5. Return the raw text content of the top result.
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

export async function enrichServiceDataWithVectorSearch(
  services: { id: string; name: string }[],
  businessId: string
): Promise<any[]> {
  console.log('[Vector Search] Enriching service data for:', services.map(s => s.name).join(', '));
  // 1. Perform a vector search to find relevant documents
  const serviceListQuery = `list of all services with their prices and durations: ${services.map(s => s.name).join(', ')}`;
  const searchResults = await findBestVectorResult(await generateEmbedding(serviceListQuery), businessId);

  if (searchResults.length === 0) {
    console.log('[Vector Search] No documents found for service enrichment.');
    return services; // Return original services if no info found
  }

  // 2. Consolidate the content from the search results
  const contextText = searchResults.map(r => r.content).join('\n\n---\n\n');

  // 3. Use an LLM to extract and structure the information
  const systemPrompt = `You are an expert data extraction tool. Your task is to analyze the provided knowledge base text and extract specific details (price and duration) for a given list of services.

  CRITICAL RULES:
  1.  You MUST analyze the "Knowledge Base Text".
  2.  For each "Service Name" in the input list, find its price and estimated duration in the text.
  3.  The price should be a single number (e.g., 45, not "$40-50"). If there's a range, take the average.
  4.  The duration should be in minutes (e.g., 60).
  5.  If a detail (price or duration) for a specific service is not found in the text, you MUST use a value of 'null' for it.
  6.  Your response MUST be a valid JSON array of objects, with each object containing "id", "name", "fixedPrice", and "durationEstimate".
  7.  Do NOT include any services that are not in the original service list.
  8.  Do not add any explanation or conversational text. Your output must ONLY be the JSON array.`;

  const userPrompt = `CONTEXT:
  - Service List (JSON): ${JSON.stringify(services, null, 2)}
  - Knowledge Base Text:
  ---
  ${contextText}
  ---

  Based on the Knowledge Base Text, provide a JSON array with the extracted price and duration for each service in the list.`;

  try {
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    const llmResult = await executeChatCompletion(messages, 'gpt-4o', 0.1, 1000);
    const jsonOutput = llmResult.choices[0]?.message?.content?.trim();
    
    if (jsonOutput) {
      const enrichedServices = JSON.parse(jsonOutput);
      console.log('[Vector Search] Successfully enriched service data:', enrichedServices);
      return enrichedServices;
    }
  } catch (error) {
    console.error('[Vector Search] Failed to enrich service data via LLM:', error);
  }

  // Fallback to original services if enrichment fails
  return services;
} 