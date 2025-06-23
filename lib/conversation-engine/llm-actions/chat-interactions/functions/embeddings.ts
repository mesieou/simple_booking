import OpenAI from "openai";
import { findBestVectorResult, type VectorSearchResult } from "./vector-search";
import { Service, ServiceData } from "@/lib/database/models/service";

export type { VectorSearchResult };

const BOOST_FACTORS: { [key: string]: number } = {
  'service': 2.0, // Increased boost for live service data
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  console.log(`[generateEmbedding] Attempting for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
  if (!text || text.trim().length === 0) {
    console.warn("[generateEmbedding] Received empty or whitespace-only text. Skipping API call, will throw error.");
    throw new Error("Cannot generate embedding for empty text.");
  }

  // START MOCK LOGIC
  if (process.env.MOCK_GPT === 'true') {
    console.log(`[generateEmbedding] MOCK MODE: Returning dummy embedding vector for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
    // Return a dummy vector of the correct dimension (1536 for text-embedding-3-small)
    // Using a simple array of 0.001 for differentiation from actual zeros if they were to occur.
    const dummyEmbedding = new Array(1536).fill(0.001);
    return dummyEmbedding;
  }
  // END MOCK LOGIC

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.replace(/\n/g, ' '),
    });
    
    if (response && response.data && response.data[0] && response.data[0].embedding) {
      console.log(`[generateEmbedding] SUCCESS for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
      return response.data[0].embedding;
    } else {
      console.error(`[generateEmbedding] UNEXPECTED RESPONSE structure from OpenAI. Response:`, JSON.stringify(response, null, 2));
      throw new Error("Unexpected response structure from OpenAI embedding API.");
    }
  } catch (error) {
    console.error(`[generateEmbedding] CAUGHT ERROR for text (first 80 chars): "${text.substring(0, 80).replace(/\n/g, ' ')}...". Error:`, error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to convert structured service data into a natural language text paragraph.
 * This text is optimized for semantic search and for an LLM to generate answers from.
 * @param service The service data object.
 * @returns A string containing the descriptive text of the service.
 */
function generateServiceDocumentContent(service: ServiceData): string {
  let priceDescription = '';
  if (service.pricingType === 'fixed' && service.fixedPrice !== undefined) {
      priceDescription = `The price is $${service.fixedPrice}.`;
  } else if (service.pricingType === 'per_minute' && service.ratePerMinute !== undefined) {
      const base = service.baseCharge ? `a base charge of $${service.baseCharge}` : '';
      const included = service.includedMinutes ? `the first ${service.includedMinutes} minutes included` : '';
      
      priceDescription = `The price is calculated at $${service.ratePerMinute} per minute`;

      if (base && included) {
          priceDescription += `, with ${base} and ${included}.`;
      } else if (base) {
          priceDescription += `, with ${base}.`;
      } else if (included) {
          priceDescription += `, with ${included}.`;
      } else {
          priceDescription += '.';
      }
  }

  const description = service.description || `A ${service.name} service.`;

  return `
    Service Name: ${service.name}.
    Description: ${description}
    The estimated duration for this service is ${service.durationEstimate} minutes.
    ${priceDescription}
    This service ${service.mobile ? 'is available for house calls' : 'is not available for house calls'}.
  `.trim().replace(/\s\s+/g, ' ');
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dotProduct / (magA * magB);
}

/**
 * RAG (Retrieval-Augmented Generation) function that combines embedding generation 
 * with vector search to find the most relevant documents for a user query.
 * It now searches both pre-existing documents and live service data.
 * 
 * @param businessId - The ID of the business to search within
 * @param userMessage - The user's message/query to search for
 * @returns Promise<VectorSearchResult[]> - Array of top 3 most relevant documents
 */
export async function RAGfunction(
  businessId: string,
  userMessage: string
): Promise<VectorSearchResult[]> {
  console.log(`[RAGfunction] Starting RAG search for business ${businessId} with message: "${userMessage.substring(0, 100)}..."`);
  
  try {
    const userEmbedding = await generateEmbedding(userMessage);
    console.log(`[RAGfunction] Successfully generated embedding for user message`);
    
    // Step 2: Perform vector search on documents and fetch live services in parallel
    const [documentResults, serviceInstances] = await Promise.all([
      findBestVectorResult(userEmbedding, businessId),
      Service.getByBusiness(businessId)
    ]);
    console.log(`[RAGfunction] Vector search returned ${documentResults.length} documents.`);
    console.log(`[RAGfunction] Fetched ${serviceInstances.length} live services.`);

    let serviceResults: VectorSearchResult[] = [];
    if (serviceInstances.length > 0) {
      const serviceData = serviceInstances.map(s => s.getData());
      const serviceContents = serviceData.map(generateServiceDocumentContent);

      // Batch generate embeddings for all services
      const serviceEmbeddingsResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: serviceContents,
      });
      const serviceEmbeddings = serviceEmbeddingsResponse.data.map(e => e.embedding);

      serviceResults = serviceData.map((service, index) => {
        const similarity = cosineSimilarity(userEmbedding, serviceEmbeddings[index]);
        return {
          documentId: service.id!,
          content: serviceContents[index],
          similarityScore: similarity,
          type: 'service',
          source: 'Business Service',
          title: service.name,
          category: 'Services',
          confidenceScore: 1.0,
        };
      });
      console.log(`[RAGfunction] Generated ${serviceResults.length} search results from live services.`);
    }

    // Step 3: Combine and re-rank matches by applying boost factors
    const allResults = [...documentResults, ...serviceResults];

    const reRankedMatches = allResults.map(match => {
      const isServiceDoc = match.source === 'Business Service';
      const boost = isServiceDoc ? (BOOST_FACTORS['service'] || 2.0) : 1;

      if (boost > 1) {
        console.log(`[RAGfunction] Boosting score for doc ID ${match.documentId} (Type: ${match.type}, Source: ${match.source}) by ${((boost - 1) * 100).toFixed(0)}%`);
      }
      return {
        ...match,
        similarityScore: match.similarityScore * boost
      };
    });

    // Step 4: Sort the matches by their new boosted score
    reRankedMatches.sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Step 5: Return top 3 documents
    const top3Results = reRankedMatches.slice(0, 3);
    console.log(`[RAGfunction] Returning top ${top3Results.length} boosted documents`);
    
    return top3Results;
  } catch (error) {
    console.error(`[RAGfunction] Error during RAG search:`, error);
    throw new Error(`RAG function failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 