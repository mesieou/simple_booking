import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import { generateEmbedding } from '@/lib/helpers/openai';
import { PageContent } from './types';
import { retry } from 'ts-retry-promise';
import { EMBEDDING_CONSTANTS } from './constants';

export async function createEmbeddings(documents: PageContent[]): Promise<void> {
  const supabase = createClient();

  for (const doc of documents) {
    try {
      // Detect language
      const lang = doc.metadata.language;
      
      // Generate content hash including language
      const contentHash = doc.contentHash;

      // Check if content already exists
      const { data } = await supabase
        .from('documents')
        .select('id')
        .eq('contentHash', contentHash)
        .eq('businessId', doc.businessId)
        .single();

      if (data) {
        console.log(`Skipping duplicate content for ${doc.url} (${lang})`);
        continue;
      }

      const documentRecord = await retry(
        () => Document.add({
          businessId: doc.businessId,
          content: doc.content,
          title: doc.title,
          source: doc.url,
          type: 'website_page',
          category: doc.category,
          contentHash: contentHash
        }),
        {
          retries: EMBEDDING_CONSTANTS.MAX_RETRIES,
          backoff: 'exponential',
          backoffBase: EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY,
          timeout: EMBEDDING_CONSTANTS.FETCH_TIMEOUT
        }
      );

      // Split content into chunks
      const chunks = doc.content.split(/\s+/).reduce((acc: string[], word: string) => {
        const currentChunk = acc[acc.length - 1] || '';
        if (currentChunk.length + word.length + 1 > 1000) {
          acc.push(word);
        } else {
          acc[acc.length - 1] = currentChunk ? `${currentChunk} ${word}` : word;
        }
        return acc;
      }, []);

      // Process chunks in batches with rate limiting
      for (let i = 0; i < chunks.length; i += EMBEDDING_CONSTANTS.BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_CONSTANTS.BATCH_SIZE);
        
        for (let attempt = 0; attempt < EMBEDDING_CONSTANTS.MAX_RETRIES; attempt++) {
          try {
            const embeddings = await Promise.all(
              batch.map(async (chunk, index) => {
                if (index > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                return generateEmbedding(chunk);
              })
            );

            // Process Supabase writes in smaller batches with delays
            for (let j = 0; j < batch.length; j += EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE) {
              const supabaseBatch = batch.slice(j, j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE);
              const embeddingBatch = embeddings.slice(j, j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE);
              
              await Promise.all(supabaseBatch.map((chunk, k) =>
                retry(
                  () => Embedding.add({
                    documentId: documentRecord.id!,
                    content: chunk,
                    embedding: embeddingBatch[k],
                    chunkIndex: i + j + k,
                    category: doc.category,
                    metadata: {
                      pageTitle: doc.title,
                      sourceUrl: doc.url,
                      contentHash: contentHash,
                      crawlTimestamp: doc.metadata.crawlTimestamp,
                      language: lang
                    }
                  }),
                  {
                    retries: EMBEDDING_CONSTANTS.MAX_RETRIES,
                    backoff: 'exponential',
                    backoffBase: EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY,
                    timeout: EMBEDDING_CONSTANTS.FETCH_TIMEOUT
                  }
                )
              ));

              // Add delay between Supabase batches
              if (j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE < batch.length) {
                await new Promise(resolve => setTimeout(resolve, EMBEDDING_CONSTANTS.SUPABASE_DELAY));
              }
            }
            break; // Success, exit retry loop
          } catch (error) {
            if (attempt === EMBEDDING_CONSTANTS.MAX_RETRIES - 1) {
              console.error(`Failed to process batch after ${EMBEDDING_CONSTANTS.MAX_RETRIES} attempts:`, error);
              throw error; // Re-throw on final attempt
            }
            const delay = EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            console.warn(`Rate limit hit, retrying in ${delay}ms... (attempt ${attempt + 1}/${EMBEDDING_CONSTANTS.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } catch (error) {
      console.error(`Failed to process document ${doc.url}:`, error);
      // Continue with next document instead of failing completely
      continue;
    }
  }
} 