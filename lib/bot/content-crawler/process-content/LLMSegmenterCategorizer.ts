import { CrawlConfig, Category, CATEGORY_DISPLAY_NAMES, PROCESS_CONTENT_CONFIG, defaultConfig, CategorizedContent } from '@/lib/config/config';
import { 
    savePageMainPrompt, // savePageMainPrompt is now called within actualCategorizeWebsiteContent
    savePageMainResponse 
} from './logger-artifact-savers';
import crypto from 'crypto';
import { categorizeWebsiteContent as actualCategorizeWebsiteContent, CategorizationApiOutput } from '@/lib/helpers/openai/functions/content-analysis';

// Output structure for each LLM-defined chunk
export interface LLMSegmentedChunk {
  chunkOrder: number;
  chunkText: string;
  category: Category; // Enum value
  categoryName?: string; // Display name, can be added post-LLM
  confidence?: number; // Optional from LLM, or default
  sourceUrl: string;
  pageTitle?: string;
  preChunkSourceIndex?: number; // To know which pre-chunk this came from
}

// Result from the main function
export interface LLMSegmenterResult {
  llmSegmentedChunks: LLMSegmentedChunk[];
  promptUsed: string;       // This will be the prompt returned by actualCategorizeWebsiteContent
  modelUsed: string;        // This will be the model reported by actualCategorizeWebsiteContent
  originalContentCharacterLength: number;
}

// Removed the internal mockLLMForSegmentationAndCategorization function entirely.
// All categorization logic (real or mock) is now handled by actualCategorizeWebsiteContent.

export async function segmentAndCategorizeByLLM(
  preChunkContent: string, 
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig,
  preChunkIndex?: number, 
  totalPreChunksForUrl?: number 
): Promise<LLMSegmenterResult> {
  
  console.log(`[LLMSegmenterCategorizer] Calling actualCategorizeWebsiteContent from content-analysis.ts for URL: ${sourceUrl}`);
  
  // Always call the function from content-analysis.ts.
  // It will internally decide whether to use a real LLM or its own mock based on process.env.MOCK_GPT.
  const categorizationOutput: CategorizationApiOutput = await actualCategorizeWebsiteContent(
    preChunkContent,
    config.businessId,
    sourceUrl
  );

  // Adapt the output from actualCategorizeWebsiteContent to LLMSegmentedChunk[]
  // The categorizeWebsiteContent is expected to return CategorizedContent[] which aligns well.
  const llmSegmentedChunks: LLMSegmentedChunk[] = categorizationOutput.result.map((item: CategorizedContent, index: number) => ({
      chunkOrder: index + 1, // Or item.chunkOrder if the API provides it for segmented chunks
      chunkText: item.content,
      category: item.category as Category, // Ensure type assertion if needed
      categoryName: CATEGORY_DISPLAY_NAMES[item.category as Category] || 'Unknown',
      confidence: item.confidence,
      sourceUrl: item.url, // actualCategorizeWebsiteContent should set this to the sourceUrl
      pageTitle: pageTitle, 
      preChunkSourceIndex: preChunkIndex 
  }));
  
  const result: LLMSegmenterResult = {
    llmSegmentedChunks,
    promptUsed: categorizationOutput.prompt, // Prompt used by actualCategorizeWebsiteContent
    // modelUsed will be determined by what actualCategorizeWebsiteContent returns or a fixed value if not provided by it
    modelUsed: process.env.MOCK_GPT === 'true' ? 'mock-from-content-analysis' : (config.botType === 'mobile-quote-booking' ? "gpt-4-turbo" : "gpt-4o"), // Reflects the model that would be used or was mocked by content-analysis
    originalContentCharacterLength: preChunkContent.length,
  };
  
  // Add categoryName and ensure preChunkSourceIndex for all chunks
  result.llmSegmentedChunks.forEach(chunk => {
      if (!chunk.categoryName) { // Double check if not set during mapping
        chunk.categoryName = CATEGORY_DISPLAY_NAMES[chunk.category] || 'Unknown';
      }
      if (chunk.preChunkSourceIndex === undefined && preChunkIndex !== undefined) {
        chunk.preChunkSourceIndex = preChunkIndex;
      }
  });

  // The prompt (promptDetails) is now saved within actualCategorizeWebsiteContent.
  // We only need to save the response structure here.
  await savePageMainResponse(sourceUrl, {
      modelUsed: result.modelUsed,
      originalContentCharacterLength: result.originalContentCharacterLength,
      // Log a prefix of chunk text to keep the response artifact manageable
      llmSegmentedChunks: result.llmSegmentedChunks.map(chunk => ({
          chunkOrder: chunk.chunkOrder,
          chunkText: chunk.chunkText.substring(0, 500), 
          category: chunk.category,
          categoryName: chunk.categoryName,
          confidence: chunk.confidence,
          preChunkSourceIndex: chunk.preChunkSourceIndex
      })),
      promptUsedLength: result.promptUsed.length 
  });

  return result;
}