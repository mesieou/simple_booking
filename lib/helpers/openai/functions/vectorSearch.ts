import { Embedding } from "@/lib/models/embeddings";
import { Document } from "@/lib/models/documents";
import { VALID_CATEGORIES } from "@/lib/bot/content-crawler/config";
import { executeChatCompletion, OpenAIChatMessage } from "@/lib/helpers/openai/openai-core";

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Accepts string (category) and returns string (index or original)
function getCategoryKey(category: string): string {
  const idx = VALID_CATEGORIES.indexOf(category as any);
  return idx === -1 ? category : idx.toString();
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
      source: doc?.source || 'unknown',
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
  userEmbedding: number[],
  category: string,
  userMessage: string
): Promise<string> {
  // 1. Get best KB match (already done)
  const bestMatch = await findBestVectorResultByCategory(userEmbedding, category);

  // 2. If a match is found, construct a prompt for the LLM
  if (bestMatch) {
    const prompt = `
You are a helpful assistant. Use the following information to answer the user's question.

Knowledge Base Info:
"${bestMatch.content}"

User Question:
"${userMessage}"

Answer in a clear, friendly, and concise way.
    `;

    // 3. Call the LLM using centralized OpenAI core
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: "You are a helpful assistant for a customer service chatbot." },
      { role: "user", content: prompt }
    ];
    try {
      const completion = await executeChatCompletion(messages, "gpt-3.5-turbo", 0.7);
      return completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("[Vector Search] Error in executeChatCompletion:", error);
      return "I'm sorry, I couldn't generate a response.";
    }
  }

  return "I'm sorry, I couldn't find a relevant answer in the knowledge base.";
} 