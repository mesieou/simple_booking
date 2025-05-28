import { CrawlConfig, Category, CATEGORY_DISPLAY_NAMES, ExtractedPatterns, PROCESS_CONTENT_CONFIG, defaultConfig } from '@/lib/config/config';
import { saveLlmInteraction, getUrlIdentifier } from './logger-artifact-savers';
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
}

// Result from the main function
export interface LLMSegmenterResult {
  llmSegmentedChunks: LLMSegmentedChunk[];
  promptUsed: string;
  modelUsed: string;
  originalContentCharacterLength: number;
}

// TODO: Replace this with your actual LLM API call logic and sophisticated prompt engineering
async function mockLLMForSegmentationAndCategorization(
  mainPageContent: string,
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig 
): Promise<LLMSegmenterResult> {
  console.log(`[MOCK LLM Segmenter] Processing URL: ${sourceUrl}, Content length: ${mainPageContent.length}`);
  
  const categoryDisplayValues = Object.values(Category).filter(v => typeof v === 'number').map(v => CATEGORY_DISPLAY_NAMES[v as Category]).join(', ');
  const targetWordsInPrompt = config.chunkSize ?? defaultConfig.chunkSize;
  const prompt = `
    Page Content from ${sourceUrl} (Title: ${pageTitle || 'N/A'}) for business ID ${config.businessId}:
    ---
    ${mainPageContent.substring(0, 2000)} 
    ---
    Segment the above into distinct semantic chunks (target ~${targetWordsInPrompt} words each, which is roughly ${targetWordsInPrompt * 1.33} tokens) and categorize each using: ${categoryDisplayValues}.
    Output JSON: [{chunkOrder, chunkText, category (numeric enum value for Category type), confidence (0.0-1.0), sourceUrl, pageTitle}]
  `;

  await new Promise(resolve => setTimeout(resolve, 100)); 

  const mockChunks: LLMSegmentedChunk[] = [];
  const categories = Object.values(Category).filter(v => typeof v === 'number') as Category[];
  
  const approxWordsPerMockChunk = config.chunkSize ?? defaultConfig.chunkSize;
  const words = mainPageContent.split(/\s+/).filter(w => w.length > 0); // Filter out empty strings from split
  let currentWordIndex = 0;
  const minChunkWordsGlobal = PROCESS_CONTENT_CONFIG.LOGGER.MIN_CHUNK_WORDS; // Correct path to MIN_CHUNK_WORDS
  const minChunkLengthGlobal = PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MIN_CHUNK_LENGTH;

  for (let i = 0; i < Math.min(5, Math.ceil(words.length / approxWordsPerMockChunk) +1 ); i++) { 
    if (currentWordIndex >= words.length && mainPageContent.trim()) break;
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
                });
             }
        }
        break;
    } 
    if (chunkWords.length === 0 && mockChunks.length > 0) break;
    if (chunkWords.length === 0 && mockChunks.length === 0 && words.length === 0) break; 

    const currentChunkText = chunkWords.length > 0 ? chunkWords.join(' ') : (mockChunks.length === 0 ? mainPageContent.trim() : '');
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
    });
    currentWordIndex += approxWordsPerMockChunk;
    const lastAddedChunk = mockChunks[mockChunks.length-1];
    if(lastAddedChunk && lastAddedChunk.chunkText.trim().length < minChunkLengthGlobal && mockChunks.length > 1) {
        mockChunks.pop(); 
    }
  }
  
  if (mockChunks.length === 0 && mainPageContent.trim().length >= minChunkLengthGlobal && mainPageContent.trim().split(/\s+/).length >= minChunkWordsGlobal) {
       mockChunks.push({
          chunkOrder: 1,
          chunkText: mainPageContent.trim(),
          category: Category.GENERAL_INFORMATION, 
          confidence: 0.75,
          sourceUrl: sourceUrl,
          pageTitle: pageTitle,
        });
  }

  return {
    llmSegmentedChunks: mockChunks.filter(c => c.chunkText.trim().length >= minChunkLengthGlobal && c.chunkText.trim().split(/\s+/).length >= minChunkWordsGlobal),
    promptUsed: prompt,
    modelUsed: "mock-gpt-4o-segmenter",
    originalContentCharacterLength: mainPageContent.length,
  };
}

export async function segmentAndCategorizeByLLM(
  mainPageContent: string,
  sourceUrl: string,
  pageTitle: string | undefined,
  config: CrawlConfig
): Promise<LLMSegmenterResult> {
  
  const modelToUse = config.botType === 'mobile-quote-booking' ? "gpt-4-turbo" : "gpt-4o"; // Example: make model configurable

  const result = await mockLLMForSegmentationAndCategorization(mainPageContent, sourceUrl, pageTitle, config);
  
  result.llmSegmentedChunks.forEach(chunk => {
      chunk.categoryName = CATEGORY_DISPLAY_NAMES[chunk.category] || 'Unknown';
  });

  const interactionId = `semantic_segment_cat_${crypto.randomBytes(6).toString('hex')}`;
  await saveLlmInteraction(sourceUrl, interactionId, result.promptUsed, {
    modelUsed: result.modelUsed,
    parsedChunks: result.llmSegmentedChunks, 
    originalContentCharacterLength: result.originalContentCharacterLength,
  });

  return result;
} 