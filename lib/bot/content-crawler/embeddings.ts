import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import { generateEmbedding } from '@/lib/helpers/openai/openai-helpers';
import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { VALID_CATEGORIES, DocumentCategory } from './types';
import { retry } from 'ts-retry-promise';
import { EMBEDDING_CONSTANTS } from './constants';
import { splitIntoSentences, generateContentHash, normalizeText } from './utils';
import { deduplicateParagraphs } from './content-processor';
import { v4 as uuidv4 } from 'uuid';
import { analyzeContent } from './content-analysis';

interface CategorizedSection {
  category: DocumentCategory;
  content: string;
  confidence: number;
}

// Helper to wrap generateEmbedding in the OpenAI queue
function embeddingInQueue(text: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    pushToQueue(async () => {
      try {
        const result = await generateEmbedding(text);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Accepts the output of sendMergedTextToGpt4Turbo (array of categorized sections),
 * groups by category, sorts by confidence, and creates embeddings for each chunk.
 * @param businessId The business ID for the documents
 * @param websiteUrl The website URL (for source)
 * @param categorizedSections Array of { category, content, confidence }
 * @param chunkSize Max characters per chunk (default 1000)
 * @param concurrencyLimit Max parallel embedding requests (default 3)
 * @param totalPages Total number of pages
 * @param embeddedUrls Array of embedded URLs
 */
export async function createEmbeddingsFromCategorizedSections(
  businessId: string,
  websiteUrl: string,
  categorizedSections: CategorizedSection[],
  chunkSize: number,
  concurrencyLimit: number,
  totalPages: number,
  embeddedUrls: string[]
): Promise<void> {
  console.log(`Starting createEmbeddingsFromCategorizedSections with ${categorizedSections.length} sections`);
  const supabase = createClient();

  // Group by category with robust deduplication
  const categorizedContent: Record<string, string[]> = {};
  const paragraphHashes: Record<string, Set<string>> = {};
  function hashParagraph(text: string) {
    // Simple hash for deduplication
    let hash = 0, i, chr;
    if (text.length === 0) return hash.toString();
    for (i = 0; i < text.length; i++) {
      chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString();
  }
  for (const section of categorizedSections) {
    const category = normalizeText(section.category);
    if (!categorizedContent[category]) {
      categorizedContent[category] = [];
      paragraphHashes[category] = new Set();
    }
    // Split section content into paragraphs
    const paragraphs = section.content.split(/\n{2,}/);
    for (let para of paragraphs) {
      const norm = normalizeText(para);
      if (norm.length < 40) continue; // skip very short
      const hash = hashParagraph(norm);
      if (!paragraphHashes[category].has(hash)) {
        paragraphHashes[category].add(hash);
        categorizedContent[category].push(para.trim());
      }
    }
  }

  // Helper for concurrency-limited Promise.all
  async function limitConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
    const results: T[] = [];
    let i = 0;
    const run = async () => {
      while (i < tasks.length) {
        const cur = i++;
        results[cur] = await tasks[cur]();
      }
    };
    await Promise.all(Array.from({ length: concurrency }, run));
    return results;
  }

  // Prepare per-category processing tasks
  const categoryTasks = Object.entries(categorizedContent).map(([category, paragraphs]) => async () => {
    if (paragraphs.length === 0) return;
    try {
      console.log(`[Embeddings] Processing category: ${category}`);
      // Merge unique paragraphs for this category
      const combinedContent = paragraphs.join('\n\n');
      // Log merged content for debugging
      console.log(`\n[DEBUG] Merged content for category '${category}':\n${combinedContent}\n[END MERGED CONTENT]\n`);

      // Use robust content hash
      const contentHash = generateContentHash(combinedContent, 'en');
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('contentHash', contentHash)
        .eq('businessId', businessId)
        .single();
      if (existingDoc) {
        console.log(`Skipping duplicate content for category ${category}`);
        return;
      }

      // Create document
      const documentRecord = await retry(
        () => Document.add({
          businessId,
          content: combinedContent,
          title: `${category} - Website Content`,
          source: websiteUrl,
          type: 'website_page',
          category: category as DocumentCategory,
          contentHash: contentHash
        }),
        {
          retries: EMBEDDING_CONSTANTS.MAX_RETRIES,
          backoff: 'exponential',
          backoffBase: EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY,
          timeout: EMBEDDING_CONSTANTS.FETCH_TIMEOUT
        }
      );

      // Smarter chunking by sentences
      const chunks: { content: string; confidence: number }[] = [];
      let currentChunk = '';
      let currentConfidence = 0;
      let chunkCount = 0;
      let sentences: { text: string; confidence: number }[] = [];
      // For chunking, use all original sections for this category
      const originalSections = categorizedSections.filter(s => normalizeText(s.category) === category);
      for (const section of originalSections) {
        const sectionText = `[Confidence: ${section.confidence.toFixed(2)}] ${section.content}`;
        const sectionSentences = splitIntoSentences(sectionText).map(s => ({ text: s, confidence: section.confidence }));
        sentences = sentences.concat(sectionSentences);
      }
      for (const sentenceObj of sentences) {
        if ((currentChunk + (currentChunk ? ' ' : '') + sentenceObj.text).length > chunkSize) {
          if (currentChunk) {
            chunks.push({
              content: currentChunk,
              confidence: currentConfidence / chunkCount
            });
          }
          currentChunk = sentenceObj.text;
          currentConfidence = sentenceObj.confidence;
          chunkCount = 1;
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${sentenceObj.text}` : sentenceObj.text;
          currentConfidence += sentenceObj.confidence;
          chunkCount++;
        }
      }
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          confidence: currentConfidence / chunkCount
        });
      }

      // Parallelized embedding creation with concurrency limit
      const limit = async <T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> => {
        const results: T[] = [];
        let i = 0;
        const run = async () => {
          while (i < tasks.length) {
            const cur = i++;
            results[cur] = await tasks[cur]()
          }
        };
        await Promise.all(Array.from({ length: concurrency }, run));
        return results;
      };

      for (let i = 0; i < chunks.length; i += EMBEDDING_CONSTANTS.BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_CONSTANTS.BATCH_SIZE);
        // Limit parallel embedding generation
        const embeddingTasks = batch.map(chunk => () => embeddingInQueue(chunk.content));
        const embeddings = await limit(embeddingTasks, concurrencyLimit);
        const addTasks = batch.map((chunk, j) => async () => {
          try {
            await retry(
              () => Embedding.add({
                documentId: documentRecord.id!,
                content: chunk.content,
                embedding: embeddings[j],
                chunkIndex: i + j,
                category: category as DocumentCategory,
                metadata: {
                  pageTitle: `${category} - Website Content`,
                  sourceUrl: websiteUrl,
                  contentHash: contentHash,
                  crawlTimestamp: Date.now(),
                  language: 'en',
                  confidence: chunk.confidence
                }
              }),
              {
                retries: EMBEDDING_CONSTANTS.MAX_RETRIES,
                backoff: 'exponential',
                backoffBase: EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY,
                timeout: EMBEDDING_CONSTANTS.FETCH_TIMEOUT
              }
            );
          } catch (err) {
            console.error('Failed to insert embedding', {
              error: err,
              payload: {
                documentId: documentRecord.id!,
                content: chunk.content,
                chunkIndex: i + j,
                category,
                metadata: {
                  pageTitle: `${category} - Website Content`,
                  sourceUrl: websiteUrl,
                  contentHash: contentHash,
                  crawlTimestamp: Date.now(),
                  language: 'en',
                  confidence: chunk.confidence
                }
              },
              stack: err instanceof Error ? err.stack : undefined
            });
            throw err;
          }
        });
        await limit(addTasks, concurrencyLimit);
      }
      console.log(`Finished category ${category}`);
    } catch (error) {
      console.error(`Failed to process category ${category}:`, error);
      return;
    }
  });

  // Run all category tasks in parallel, with a global concurrency limit (default: 3)
  await limitConcurrency(categoryTasks, concurrencyLimit);

  const presentCategories = new Set(
    categorizedSections.map(section => normalizeText(section.category))
  );

  // Log when information analysis is being done
  console.log('[Embeddings] Running information analysis...');
  const analysisResult = await analyzeContent(categorizedSections, websiteUrl);
  console.log('[Embeddings] Information analysis complete.');

  // Update crawl session payload to store analysisResult
  const crawlSessionPayload = {
    id: uuidv4(),
    businessId: businessId,
    startTime: Date.now(),
    endTime: Date.now(),
    totalPages,
    successfulPages: embeddedUrls.length,
    failedPages: totalPages - embeddedUrls.length,
    categories: Object.fromEntries(Array.from(presentCategories).map(cat => [cat, 1])),
    errors: [],
    analysisResult // Store the analysis result
  };
  const { data: crawlSessionData, error: crawlSessionError } = await supabase.from('crawlSessions').insert([crawlSessionPayload]);
  if (crawlSessionError) {
    console.error('Supabase crawlSessions insert error:', {
      message: crawlSessionError.message,
      details: crawlSessionError.details,
      code: crawlSessionError.code,
      hint: crawlSessionError.hint,
      payload: crawlSessionPayload
    });
  } else {
    console.log('Supabase crawlSessions insert success:', crawlSessionData);
  }

  console.log('Finished createEmbeddingsFromCategorizedSections');
} 
