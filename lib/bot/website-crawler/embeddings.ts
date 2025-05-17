import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import { generateEmbedding } from '@/lib/helpers/openai';
import { WebPageCategory, VALID_CATEGORIES } from './types';
import { retry } from 'ts-retry-promise';
import { EMBEDDING_CONSTANTS } from './constants';
import { splitIntoSentences, generateContentHash } from './utils';

interface CategorizedSection {
  category: WebPageCategory | string;
  content: string;
  confidence: number;
}

/**
 * Accepts the output of sendMergedTextToGpt4Turbo (array of categorized sections),
 * groups by category, sorts by confidence, and creates embeddings for each chunk.
 * @param businessId The business ID for the documents
 * @param websiteUrl The website URL (for source)
 * @param categorizedSections Array of { category, content, confidence }
 * @param chunkSize Max characters per chunk (default 1000)
 * @param concurrencyLimit Max parallel embedding requests (default 3)
 */
export async function createEmbeddingsFromCategorizedSections(
  businessId: string,
  websiteUrl: string,
  categorizedSections: CategorizedSection[],
  chunkSize: number = 1000,
  concurrencyLimit: number = 3
): Promise<void> {
  console.log(`Starting createEmbeddingsFromCategorizedSections with ${categorizedSections.length} sections`);
  const supabase = createClient();

  // Group by category
  const categorizedContent: Record<string, CategorizedSection[]> = {};
  for (const section of categorizedSections) {
    if (!categorizedContent[section.category]) {
      categorizedContent[section.category] = [];
    }
    categorizedContent[section.category].push(section);
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
  const categoryTasks = Object.entries(categorizedContent).map(([category, sections]) => async () => {
    if (sections.length === 0) return;
    try {
      // Sort by confidence
      sections.sort((a, b) => b.confidence - a.confidence);
      // Combine content
      const combinedContent = sections
        .map(section => `[Confidence: ${section.confidence.toFixed(2)}] ${section.content}`)
        .join('\n\n');

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
          category: category as WebPageCategory,
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
      for (const section of sections) {
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
            results[cur] = await tasks[cur]();
          }
        };
        await Promise.all(Array.from({ length: concurrency }, run));
        return results;
      };

      for (let i = 0; i < chunks.length; i += EMBEDDING_CONSTANTS.BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_CONSTANTS.BATCH_SIZE);
        // Limit parallel embedding generation
        const embeddingTasks = batch.map(chunk => () => generateEmbedding(chunk.content));
        const embeddings = await limit(embeddingTasks, concurrencyLimit);
        const addTasks = batch.map((chunk, j) => () => retry(
          () => Embedding.add({
            documentId: documentRecord.id!,
            content: chunk.content,
            embedding: embeddings[j],
            chunkIndex: i + j,
            category: category as WebPageCategory,
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
        ));
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
    categorizedSections.map(section => section.category)
  );
  const missingCategories = VALID_CATEGORIES.filter(
    cat => !presentCategories.has(cat)
  );

  // Save crawl session
  await supabase.from('crawlSessions').insert([{
    businessId: businessId,
    startTime: Date.now(),
    endTime: Date.now(),
    totalPages: categorizedSections.length,
    successfulPages: categorizedSections.length,
    failedPages: 0,
    categories: Array.from(presentCategories),
    errors: [],
    missingInformation: JSON.stringify(missingCategories)
  }]);

  console.log('Finished createEmbeddingsFromCategorizedSections');
} 
