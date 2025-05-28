import { CrawlConfig, Category, CATEGORY_DISPLAY_NAMES, ExtractedPatterns, PROCESS_CONTENT_CONFIG, defaultConfig } from '@/lib/config/config';
import { 
    saveLlmInteraction, // Will be removed for main processing, kept if other interactions exist
    getUrlIdentifier, 
    savePageMainPrompt, 
    savePageMainResponse 
} from './logger-artifact-savers';
import crypto from 'crypto';

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
  promptUsed: string;
  modelUsed: string;
  originalContentCharacterLength: number; // Length of the pre-chunk processed
}

async function mockLLMForSegmentationAndCategorization(
  preChunkContent: string, // Renamed from mainPageContent
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig,
  preChunkIndex?: number, // New
  totalPreChunksForUrl?: number // New
): Promise<LLMSegmenterResult> {
  const preChunkContext = preChunkIndex !== undefined && totalPreChunksForUrl !== undefined 
                          ? `Pre-chunk ${preChunkIndex + 1}/${totalPreChunksForUrl}` 
                          : `Full content`;

  console.log(`[MOCK LLM Segmenter] Processing ${preChunkContext} for URL: ${sourceUrl}, Content length: ${preChunkContent.length}`);
  
  const categoryDisplayValues = Object.values(Category).filter(v => typeof v === 'number').map(v => CATEGORY_DISPLAY_NAMES[v as Category]).join(', ');
  const targetWordsInPrompt = config.chunkSize ?? defaultConfig.chunkSize;
  
  // Create a structured object for the prompt details
  const promptDetails = {
    preChunkContext,
    sourceUrl,
    pageTitle: pageTitle || 'N/A',
    businessId: config.businessId,
    contentType: "Markdown with hints (# for headings, * or - for list items, ``` for code blocks)",
    segmentationGoal: `Segment into distinct semantic chunks (target ~${targetWordsInPrompt} words each, which is roughly ${targetWordsInPrompt * 1.33} tokens)`,
    categorizationGoal: `Categorize each using ONLY these categories: ${categoryDisplayValues}`,
    outputFormat: "JSON: [{chunkOrder, chunkText, category (numeric enum value for Category type), confidence (0.0-1.0), sourceUrl, pageTitle}]",
    contentPrefix: preChunkContent.substring(0, 2000) // Store a prefix of the content for reference
    // Note: The full preChunkContent is used below to form the actual LLM prompt string, 
    // but we log only a prefix here to keep the promptDetails object manageable if content is huge.
    // The actual content processed by the LLM is in the 'prompt' variable below.
  };

  // Save the structured prompt details directly using the imported function
  try {
    await savePageMainPrompt(sourceUrl, promptDetails);
  } catch (logError) {
    console.error(`[MOCK LLM Segmenter] Failed to save page main prompt for ${sourceUrl}:`, logError);
    // Decide if you want to proceed if logging fails. For now, we will.
  }

  const prompt = `
    ${preChunkContext} from URL ${sourceUrl} (Title: ${pageTitle || 'N/A'}) for business ID ${config.businessId}:
    The content below may contain Markdown hints: '#' for headings, '*' or '-' for list items, and \`\`\` for code blocks. Use these structural hints to guide semantic segmentation.
    ---
    ${preChunkContent.substring(0, 2000)} 
    ---
    Segment the above into distinct semantic chunks (target ~${targetWordsInPrompt} words each, which is roughly ${targetWordsInPrompt * 1.33} tokens) and categorize each using ONLY these categories: ${categoryDisplayValues}.
    Output JSON: [{chunkOrder, chunkText, category (numeric enum value for Category type), confidence (0.0-1.0), sourceUrl, pageTitle}]
  `;

  await new Promise(resolve => setTimeout(resolve, 100)); 

  const mockChunks: LLMSegmentedChunk[] = [];
  const categories = Object.values(Category).filter(v => typeof v === 'number') as Category[];
  
  const approxWordsPerMockChunk = config.chunkSize ?? defaultConfig.chunkSize;
  const words = preChunkContent.split(/\s+/).filter(w => w.length > 0);
  let currentWordIndex = 0;
  const minChunkWordsGlobal = PROCESS_CONTENT_CONFIG.LOGGER.MIN_CHUNK_WORDS;
  const minChunkLengthGlobal = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MIN_CHUNK_LENGTH;

  for (let i = 0; i < Math.min(5, Math.ceil(words.length / approxWordsPerMockChunk) +1 ); i++) { 
    if (currentWordIndex >= words.length && preChunkContent.trim()) break;
    const chunkWords = words.slice(currentWordIndex, currentWordIndex + approxWordsPerMockChunk);
    
    if (chunkWords.length < minChunkWordsGlobal && !(mockChunks.length === 0 && words.length < minChunkWordsGlobal && words.length > 0) ) { 
        if (currentWordIndex < words.length) { 
             const lastChunkText = words.slice(currentWordIndex).join(' ').trim();
             if (lastChunkText.length >= minChunkLengthGlobal && lastChunkText.split(/\s+/).length >= minChunkWordsGlobal) {
                 mockChunks.push({
                    chunkOrder: mockChunks.length + 1,
                    chunkText: lastChunkText,
                    category: categories[(mockChunks.length) % categories.length], 
                    confidence: Math.random() * 0.2 + 0.75, 
                    sourceUrl: sourceUrl,
                    pageTitle: pageTitle,
                    preChunkSourceIndex: preChunkIndex,
                });
             }
        }
        break;
    } 
    if (chunkWords.length === 0 && mockChunks.length > 0) break;
    if (chunkWords.length === 0 && mockChunks.length === 0 && words.length === 0) break; 

    const currentChunkText = chunkWords.length > 0 ? chunkWords.join(' ') : (mockChunks.length === 0 ? preChunkContent.trim() : '');
    if (!currentChunkText.trim() && mockChunks.length === 0 && words.length > 0) { 
        currentWordIndex += approxWordsPerMockChunk;
        continue;
    }
    if (!currentChunkText.trim()) continue;

    mockChunks.push({
      chunkOrder: mockChunks.length + 1,
      chunkText: currentChunkText,
      category: categories[mockChunks.length === 0 ? 0 : (mockChunks.length -1) % categories.length], 
      confidence: Math.random() * 0.2 + 0.75, 
      sourceUrl: sourceUrl,
      pageTitle: pageTitle,
      preChunkSourceIndex: preChunkIndex,
    });
    currentWordIndex += approxWordsPerMockChunk;
    const lastAddedChunk = mockChunks[mockChunks.length-1];
    if(lastAddedChunk && lastAddedChunk.chunkText.trim().length < minChunkLengthGlobal && mockChunks.length > 1) {
        mockChunks.pop(); 
    }
  }
  
  if (mockChunks.length === 0 && preChunkContent.trim().length >= minChunkLengthGlobal && preChunkContent.trim().split(/\s+/).length >= minChunkWordsGlobal) {
       mockChunks.push({
          chunkOrder: 1,
          chunkText: preChunkContent.trim(),
          category: Category.GENERAL_INFORMATION, 
          confidence: 0.75,
          sourceUrl: sourceUrl,
          pageTitle: pageTitle,
          preChunkSourceIndex: preChunkIndex,
        });
  }

  return {
    llmSegmentedChunks: mockChunks.filter(c => c.chunkText.trim().length >= minChunkLengthGlobal && c.chunkText.trim().split(/\s+/).length >= minChunkWordsGlobal),
    promptUsed: prompt,
    modelUsed: "mock-gpt-4o-segmenter",
    originalContentCharacterLength: preChunkContent.length, // Reflects pre-chunk length
  };
}

export async function segmentAndCategorizeByLLM(
  preChunkContent: string, // Renamed from mainPageContent
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig,
  preChunkIndex?: number, // New
  totalPreChunksForUrl?: number // New
): Promise<LLMSegmenterResult> {
  
  const modelToUse = config.botType === 'mobile-quote-booking' ? "gpt-4-turbo" : "gpt-4o";

  // Pass new parameters to the (mock) LLM call
  const result = await mockLLMForSegmentationAndCategorization(
    preChunkContent, 
    sourceUrl, 
    pageTitle, 
    config,
    preChunkIndex,
    totalPreChunksForUrl
  );
  
  result.llmSegmentedChunks.forEach(chunk => {
      chunk.categoryName = CATEGORY_DISPLAY_NAMES[chunk.category] || 'Unknown';
      // Ensure preChunkSourceIndex is set on each chunk if not already by mock
      if (chunk.preChunkSourceIndex === undefined && preChunkIndex !== undefined) {
        chunk.preChunkSourceIndex = preChunkIndex;
      }
  });

  const baseInteractionId = `semantic_segment_cat`;
  const chunkContext = preChunkIndex !== undefined && totalPreChunksForUrl !== undefined 
                       ? `_prechunk_${preChunkIndex + 1}_of_${totalPreChunksForUrl}` // Use 1-based index for logging
                       : `_full`;
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const interactionId = `${baseInteractionId}${chunkContext}_${uniqueId}`;
  
  // Remove the old saveLlmInteraction call for this main categorization step
  // await saveLlmInteraction(sourceUrl, interactionId, result.promptUsed, {
  //     modelUsed: result.modelUsed,
  //     parsedChunks: result.llmSegmentedChunks, 
  //     originalContentCharacterLength: result.originalContentCharacterLength, // This is pre-chunk length now
  //     preChunkSourceIndex: preChunkIndex,
  //     totalPreChunksForUrl: totalPreChunksForUrl
  // });

  // Use new functions to save plain text prompt and structured response
  // if (result.promptUsed) { // This is removed as prompt is now saved as structured object by the function that creates it
  //     await savePageMainPrompt(sourceUrl, result.promptUsed);
  // }
  // Save the relevant parts of the LLMSegmenterResult as the main response
  await savePageMainResponse(sourceUrl, {
      modelUsed: result.modelUsed,
      originalContentCharacterLength: result.originalContentCharacterLength,
      llmSegmentedChunks: result.llmSegmentedChunks.map(chunk => ({
          chunkOrder: chunk.chunkOrder,
          chunkText: chunk.chunkText,
          category: chunk.category,
          categoryName: chunk.categoryName,
          confidence: chunk.confidence,
          // sourceUrl and pageTitle are already known from the context of sourceUrl, 
          // and preChunkSourceIndex might be too granular for this top-level response.txt
      })),
      // interactionContext: interactionId // You can uncomment this if you want the ID in the response.txt too
  });

  return result;
}