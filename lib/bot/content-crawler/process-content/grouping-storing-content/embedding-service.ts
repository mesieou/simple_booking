import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import { generateEmbedding } from '@/lib/helpers/openai/functions/embeddings';
import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { DocumentCategory, VALID_CATEGORIES, EMBEDDING_CONFIG } from '../../config';
import { retry } from 'ts-retry-promise';
import { splitIntoSentences, generateContentHash, normalizeText, runConcurrentTasks } from '../../utils';
import { v4 as uuidv4 } from 'uuid';

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

export async function createEmbeddings(
  businessId: string,
  websiteUrl: string,
  categorizedSections: CategorizedSection[],
  chunkSize: number = 1000,
  concurrencyLimit: number = 5,
  totalPages: number,
  processedUrls: string[]
): Promise<string> {
  try {
    console.log('[Content Processor] Starting embeddings creation...');
    const embeddingsStartTime = Date.now();
    await processCategorizedContent(
      businessId,
      websiteUrl,
      categorizedSections,
      chunkSize,
      concurrencyLimit,
      totalPages,
      processedUrls
    );
    console.log(`[Content Processor] Embeddings creation completed in ${(Date.now() - embeddingsStartTime)/1000}s.`);
    return 'success';
  } catch (e) {
    console.error('[Content Processor] Embeddings creation failed:', e);
    return `error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function processCategorizedContent(
  businessId: string,
  websiteUrl: string,
  categorizedSections: CategorizedSection[],
  chunkSize: number,
  concurrencyLimit: number,
  totalPages: number,
  processedUrls: string[]
): Promise<void> {
  console.log(`Starting processCategorizedContent with ${categorizedSections.length} sections`);
  const supabase = createClient();

  // Group by category with robust deduplication
  const categorizedContent: Record<string, string[]> = {};
  const paragraphHashes: Record<string, Set<string>> = {};
  
  function hashParagraph(text: string) {
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
    const paragraphs = section.content.split(/\n{2,}/);
    for (let para of paragraphs) {
      const norm = normalizeText(para);
      if (norm.length < 40) continue;
      const hash = hashParagraph(norm);
      if (!paragraphHashes[category].has(hash)) {
        paragraphHashes[category].add(hash);
        categorizedContent[category].push(para.trim());
      }
    }
  }

  const categoryEntries = Object.entries(categorizedContent);
  await processCategories(categoryEntries, businessId, websiteUrl, chunkSize, concurrencyLimit, categorizedSections);
  await updateCrawlSession(businessId, totalPages, processedUrls, categorizedSections);
}

async function processCategories(
  categoryEntries: [string, string[]][],
  businessId: string,
  websiteUrl: string,
  chunkSize: number,
  concurrencyLimit: number,
  categorizedSections: CategorizedSection[]
): Promise<void> {
  for (const [category, paragraphs] of categoryEntries) {
    if (paragraphs.length === 0) continue;
    try {
      console.log(`[Content Processor] Processing category: ${category}`);
      const combinedContent = paragraphs.join('\n\n');
      const contentHash = generateContentHash(combinedContent, 'en');
      
      const documentRecord = await createDocument(businessId, category, combinedContent, websiteUrl, contentHash);
      const chunks = createChunks(categorizedSections, category, chunkSize);
      await processChunks(chunks, documentRecord, category, websiteUrl, contentHash, concurrencyLimit);
      
      console.log(`Finished category ${category}`);
    } catch (error) {
      console.error(`Failed to process category ${category}:`, error);
    }
  }
}

async function createDocument(
  businessId: string,
  category: string,
  content: string,
  websiteUrl: string,
  contentHash: string
): Promise<any> {
  return await retry(
    () => Document.add({
      businessId,
      content,
      title: `${category} - Website Content`,
      source: websiteUrl,
      type: 'website_page',
      category: category as DocumentCategory,
      contentHash
    }),
    {
      retries: EMBEDDING_CONFIG.MAX_RETRIES,
      backoff: 'exponential',
      backoffBase: EMBEDDING_CONFIG.INITIAL_RETRY_DELAY,
      timeout: EMBEDDING_CONFIG.FETCH_TIMEOUT
    }
  );
}

function createChunks(
  categorizedSections: CategorizedSection[],
  category: string,
  chunkSize: number
): { content: string; confidence: number }[] {
  const chunks: { content: string; confidence: number }[] = [];
  let currentChunk = '';
  let currentConfidence = 0;
  let chunkCount = 0;

  const sentences: { text: string; confidence: number }[] = [];
  const originalSections = categorizedSections.filter(s => normalizeText(s.category) === category);
  
  for (const section of originalSections) {
    const sectionText = `[Confidence: ${section.confidence.toFixed(2)}] ${section.content}`;
    const sectionSentences = splitIntoSentences(sectionText).map(s => ({ text: s, confidence: section.confidence }));
    sentences.push(...sectionSentences);
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

  return chunks;
}

async function processChunks(
  chunks: { content: string; confidence: number }[],
  documentRecord: any,
  category: string,
  websiteUrl: string,
  contentHash: string,
  concurrencyLimit: number
): Promise<void> {
  for (let j = 0; j < chunks.length; j++) {
    const chunk = chunks[j];
    try {
      const embedding = await embeddingInQueue(chunk.content);
      await retry(
        () => Embedding.add({
          documentId: documentRecord.id!,
          content: chunk.content,
          embedding,
          chunkIndex: j,
          category: category as DocumentCategory,
          metadata: {
            pageTitle: `${category} - Website Content`,
            sourceUrl: websiteUrl,
            contentHash,
            crawlTimestamp: Date.now(),
            language: 'en',
            confidence: chunk.confidence
          }
        }),
        {
          retries: EMBEDDING_CONFIG.MAX_RETRIES,
          backoff: 'exponential',
          backoffBase: EMBEDDING_CONFIG.INITIAL_RETRY_DELAY,
          timeout: EMBEDDING_CONFIG.FETCH_TIMEOUT
        }
      );
    } catch (err) {
      console.error('Failed to insert embedding', {
        error: err,
        payload: {
          documentId: documentRecord.id!,
          content: chunk.content,
          chunkIndex: j,
          category,
          metadata: {
            pageTitle: `${category} - Website Content`,
            sourceUrl: websiteUrl,
            contentHash,
            crawlTimestamp: Date.now(),
            language: 'en',
            confidence: chunk.confidence
          }
        },
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }
}

async function updateCrawlSession(
  businessId: string,
  totalPages: number,
  processedUrls: string[],
  categorizedSections: CategorizedSection[]
): Promise<void> {
  const supabase = createClient();
  const presentCategories = new Set(categorizedSections.map(section => section.category));
  const missingCategories = VALID_CATEGORIES.filter(
    (category: DocumentCategory) => !presentCategories.has(category)
  );

  const crawlSessionPayload = {
    id: uuidv4(),
    businessId,
    startTime: Date.now(),
    endTime: Date.now(),
    totalPages,
    successfulPages: processedUrls.length,
    failedPages: totalPages - processedUrls.length,
    categories: Object.fromEntries(Array.from(presentCategories).map(cat => [cat, 1])),
    errors: [],
    missingCategories
  };

  const { error: crawlSessionError } = await supabase.from('crawlSessions').insert([crawlSessionPayload]);
  if (crawlSessionError) {
    console.error('Supabase crawlSessions insert error:', {
      message: crawlSessionError.message,
      details: crawlSessionError.details,
      code: crawlSessionError.code,
      hint: crawlSessionError.hint,
      payload: crawlSessionPayload
    });
  }
} 