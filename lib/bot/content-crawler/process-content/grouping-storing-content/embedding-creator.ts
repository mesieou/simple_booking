import { Embedding } from '@/lib/models/embeddings';
import { DocumentCategory, EMBEDDING_CONFIG, ContentChunk } from '../../config';
import { generateEmbedding } from '@/lib/helpers/openai/functions/embeddings';
import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { retry } from 'ts-retry-promise';
import { logger } from '../logger';

// Helper to wrap generateEmbedding in the OpenAI queue
export function embeddingInQueue(text: string): Promise<number[]> {
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

export async function createEmbeddingsForChunks(
  chunks: ContentChunk[],
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
      
      logger.logEmbeddingAttempt({
        embeddingId: `${documentRecord.id}-${j}`,
        docId: documentRecord.id!,
        category,
        chunkIndex: j,
        metadata: {
          pageTitle: `${category} - Website Content`,
          sourceUrl: websiteUrl,
          contentHash,
          crawlTimestamp: Date.now(),
          language: 'en',
          confidence: chunk.confidence
        }
      });
      await retry(
        () => Embedding.add({
          documentId: documentRecord.id!,
          content: chunk.content,
          embedding,
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
        }),
        {
          retries: EMBEDDING_CONFIG.MAX_RETRIES,
          backoff: 'exponential',
          backoffBase: EMBEDDING_CONFIG.INITIAL_RETRY_DELAY,
          timeout: EMBEDDING_CONFIG.FETCH_TIMEOUT
        }
      );
      logger.logEmbedding(`${documentRecord.id}-${j}`, documentRecord.id, 'processed');
    } catch (err) {
      logger.logEmbedding(`${documentRecord.id}-${j}`, documentRecord.id, 'failed', err instanceof Error ? err.message : String(err));
      throw err; // Propagate error to trigger retry
    }
  }
} 