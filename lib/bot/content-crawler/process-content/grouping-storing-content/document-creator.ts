import { Document } from '@/lib/models/documents';
import { DocumentCategory, EMBEDDING_CONFIG, CategorizedSection } from '../../config';
import { generateContentHash } from '../../utils';
import { retry } from 'ts-retry-promise';
import { createChunksForEmbeddings } from './embedding-content-chunker';

export async function createDocument(
  businessId: string,
  category: string,
  content: string,
  websiteUrl: string
): Promise<any> {
  const contentHash = generateContentHash(content, 'en');
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

export function createChunks(
  categorizedSections: CategorizedSection[],
  category: string,
  chunkSize: number
) {
  return createChunksForEmbeddings(categorizedSections, category, chunkSize);
} 