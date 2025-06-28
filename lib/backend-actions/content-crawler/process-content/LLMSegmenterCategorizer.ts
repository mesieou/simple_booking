import { CrawlConfig, Category, CATEGORY_DISPLAY_NAMES, PROCESS_CONTENT_CONFIG, /* defaultConfig, */ CategorizedContent } from '@/lib/general-config/general-config';
import { savePageMainResponse } from './logger-artifact-savers';
import { categorizeWebsiteContent as actualCategorizeWebsiteContent, CategorizationApiOutput } from '../../../shared/llm/functions/content-analysis';

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
  domain: string; // Added domain
  sessionId: string; // Added sessionId
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

/**
 * Segments and categorizes a given piece of pre-chunked text content using an LLM.
 * This function acts as a wrapper around `actualCategorizeWebsiteContent` (which handles the direct LLM call),
 * adapting its output to the `LLMSegmentedChunk` format and managing local logging of the response.
 *
 * @param preChunkContent The raw text content of a pre-defined chunk to be processed.
 * @param sourceUrl The original URL from which the content was derived.
 * @param pageTitle The title of the source page, if available.
 * @param config The crawl configuration, primarily used to pass `businessId` to the categorizer.
 * @param preChunkIndex Optional index of this pre-chunk if the content for a URL was split into multiple pre-chunks.
 *                      This helps in tracking the origin of the LLM-segmented chunks.
 * @returns A Promise that resolves to an `LLMSegmenterResult` object, containing the array of
 *          `LLMSegmentedChunk`s, the prompt used, the model name, and the original content length.
 */
export async function segmentAndCategorizeByLLM(
  preChunkContent: string, 
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig,
  preChunkIndex?: number // Removed totalPreChunksForUrl as it was unused
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
      // domain and sessionId will be added by the caller (generateLlmSegmentedChunksForSinglePage)
  } as LLMSegmentedChunk)); // Added type assertion to ensure all fields are covered, even if some are undefined initially
  
  const result: LLMSegmenterResult = {
    llmSegmentedChunks,
    promptUsed: categorizationOutput.prompt, // Prompt used by actualCategorizeWebsiteContent
    // modelUsed will be determined by what actualCategorizeWebsiteContent returns or a fixed value if not provided by it
    modelUsed: process.env.MOCK_GPT === 'true' ? 'mock-from-content-analysis' : (config.botType === 'mobile-quote-booking' ? "gpt-4-turbo" : "gpt-4o"), // Reflects the model that would be used or was mocked by content-analysis
    originalContentCharacterLength: preChunkContent.length,
  };
  
  // The prompt (promptDetails) is now saved within actualCategorizeWebsiteContent.
  // We only need to save the response structure here.
  await savePageMainResponse(sourceUrl, {
      modelUsed: result.modelUsed,
      originalContentCharacterLength: result.originalContentCharacterLength,
      // Save the full chunk text without truncation for proper debugging
      llmSegmentedChunks: result.llmSegmentedChunks.map(chunk => ({
          chunkOrder: chunk.chunkOrder,
          chunkText: chunk.chunkText, // Remove the .substring(0, 500) truncation
          category: chunk.category,
          categoryName: chunk.categoryName,
          confidence: chunk.confidence,
          preChunkSourceIndex: chunk.preChunkSourceIndex
      })),
      promptUsedLength: result.promptUsed.length 
  });

  return result;
}