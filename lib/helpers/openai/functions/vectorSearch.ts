import { Embedding } from "@/lib/models/embeddings";
import { Document } from "@/lib/models/documents";
import { Category, CATEGORY_DISPLAY_NAMES } from "@/lib/bot/content-crawler/config";
import { executeChatCompletion, OpenAIChatMessage } from "@/lib/helpers/openai/openai-core";
import { generateEmbedding } from "@/lib/helpers/openai/functions/embeddings";

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
): Promise<VectorSearchResult | null> {
  // 1. Get embeddings for the given category (support string or index)
  const categoryKey = getCategoryKey(category);
  const embeddings = await Embedding.getByCategory(categoryKey);
  if (!embeddings.length) return null;

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

  // 4. Sort and return the best result
  const validResults = results.filter(r => r !== null) as VectorSearchResult[];
  const best = validResults.sort((a, b) => b.similarityScore - a.similarityScore)[0];
  if (best) {
    console.log('[Vector Search] Best match:', best);
  }
  return best || null;
}

export async function getConversationalAnswer(
  category: string,
  userMessage: string
): Promise<string> {
  // Preprocess the user message before embedding
  const cleanMessage = preprocessUserMessage(userMessage);
  // Generate embedding from the cleaned message
  const cleanedEmbedding = await generateEmbedding(cleanMessage);

  // 1. Get best KB match
  const bestMatch = await findBestVectorResultByCategory(cleanedEmbedding, category);

  // Log best match details for debugging/monitoring
  if (bestMatch) {
    console.log('[Vector Search] Best match:', {
      documentId: bestMatch.documentId,
      similarityScore: bestMatch.similarityScore,
      confidenceScore: bestMatch.confidenceScore,
      source: bestMatch.source,
      sourceUrl: bestMatch.sourceUrl
    });
  }

  // 2. If a match is found, construct a prompt for the LLM
  if (bestMatch) {
    const prompt = `
You are a helpful and friendly customer service assistant for YS Company.
Answer the user's question using the following information from our knowledge base, but do NOT mention the source, category, or say 'based on' or similar phrases. Respond as if you are a human expert from the company.

Keep your answer as short and direct as possible (ideally 1-2 sentences). If a direct answer is possible, give it directly and briefly. Do not repeat information or over-explain.

Knowledge Base Info:
"${bestMatch.content}"

User Question:
"${userMessage}"

Give a concise, conversational answer.
    `;

    // 3. Call the LLM using centralized OpenAI core
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: "You are a helpful assistant for a customer service chatbot." },
      { role: "user", content: prompt }
    ];
    try {
      const completion = await executeChatCompletion(messages, "gpt-4o", 0.7);
      return completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
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