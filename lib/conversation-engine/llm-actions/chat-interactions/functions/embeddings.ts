import OpenAI from "openai";

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