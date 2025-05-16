import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import { generateEmbedding } from '@/lib/helpers/openai';
import { PageContent, WebPageCategory, VALID_CATEGORIES } from './types';
import { retry } from 'ts-retry-promise';
import { EMBEDDING_CONSTANTS } from './constants';
import { generateContentHash } from './utils';

interface CategorizedSection {
  category: WebPageCategory;
  content: string;
  title?: string;
  confidence: number;
}

export async function createEmbeddings(documents: PageContent[]): Promise<void> {
  console.log(`Starting createEmbeddings with ${documents.length} documents`);
  const supabase = createClient();

  // Accumulate content by category with section titles
  const categorizedContent = Object.fromEntries(
    VALID_CATEGORIES.map(cat => [cat, [] as CategorizedSection[]])
  ) as unknown as Record<WebPageCategory, CategorizedSection[]>;

  // Collect all content by category, preserving section titles
  for (const doc of documents) {
    console.log(`Processing document from ${doc.url}`);
    for (const section of doc.categorizedContent) {
      // Check for duplicates using content hash
      const sectionHash = await generateContentHash(section.content, 'en');
      const isDuplicate = categorizedContent[section.category].some(
        existing => existing.content === section.content
      );

      if (!isDuplicate) {
        console.log(`Adding new section to category ${section.category} with confidence ${section.confidence}`);
        categorizedContent[section.category].push({
          category: section.category,
          content: section.content,
          confidence: section.confidence
        });
      } else {
        console.log(`Skipping duplicate section in category ${section.category}`);
      }
    }
  }

  // Create one document per category
  for (const [category, sections] of Object.entries(categorizedContent)) {
    if (sections.length === 0) {
      console.log(`Skipping empty category ${category}`);
      continue;
    }

    try {
      console.log(`Processing category ${category} with ${sections.length} sections`);
      // Sort sections by confidence
      sections.sort((a, b) => b.confidence - a.confidence);

      // Combine sections with titles and confidence scores
      const combinedContent = sections
        .map(section => {
          const confidence = section.confidence.toFixed(2);
          return `[Confidence: ${confidence}] ${section.content}`;
        })
        .join('\n\n');

      const contentHash = await generateContentHash(combinedContent, 'en');
      console.log(`Generated content hash for category ${category}: ${contentHash}`);

      // Check if content already exists
      const { data: existingDoc, error: checkError } = await supabase
        .from('documents')
        .select('id')
        .eq('contentHash', contentHash)
        .eq('businessId', documents[0].businessId)
        .single();

      if (checkError) {
        console.error(`Error checking for existing document:`, checkError);
      }

      if (existingDoc) {
        console.log(`Skipping duplicate content for category ${category}`);
        continue;
      }

      console.log(`Creating new document for category ${category}`);
      const documentRecord = await retry(
        () => Document.add({
          businessId: documents[0].businessId,
          content: combinedContent,
          title: `${category} - Website Content`,
          source: documents[0].url,
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

      console.log(`Successfully created document with ID ${documentRecord.id}`);

      // Split content into chunks while preserving section boundaries and confidence scores
      const chunks: { content: string; confidence: number }[] = [];
      let currentChunk = '';
      let currentConfidence = 0;
      let chunkCount = 0;
      
      for (const section of sections) {
        const sectionText = `[Confidence: ${section.confidence.toFixed(2)}] ${section.content}`;
        
        if (currentChunk.length + sectionText.length > 1000) {
          if (currentChunk) {
            chunks.push({
              content: currentChunk,
              confidence: currentConfidence / chunkCount
            });
          }
          currentChunk = sectionText;
          currentConfidence = section.confidence;
          chunkCount = 1;
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n\n${sectionText}` : sectionText;
          currentConfidence += section.confidence;
          chunkCount++;
        }
      }
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          confidence: currentConfidence / chunkCount
        });
      }

      console.log(`Created ${chunks.length} chunks for category ${category}`);

      // Process chunks in batches with rate limiting
      for (let i = 0; i < chunks.length; i += EMBEDDING_CONSTANTS.BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_CONSTANTS.BATCH_SIZE);
        console.log(`Processing batch ${i / EMBEDDING_CONSTANTS.BATCH_SIZE + 1} of ${Math.ceil(chunks.length / EMBEDDING_CONSTANTS.BATCH_SIZE)}`);
        
        for (let attempt = 0; attempt < EMBEDDING_CONSTANTS.MAX_RETRIES; attempt++) {
          try {
            console.log(`Generating embeddings for batch (attempt ${attempt + 1}/${EMBEDDING_CONSTANTS.MAX_RETRIES})`);
            const embeddings = await Promise.all(
              batch.map(async (chunk, index) => {
                if (index > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                return generateEmbedding(chunk.content);
              })
            );

            console.log(`Successfully generated ${embeddings.length} embeddings`);

            // Process Supabase writes in smaller batches with delays
            for (let j = 0; j < batch.length; j += EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE) {
              const supabaseBatch = batch.slice(j, j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE);
              const embeddingBatch = embeddings.slice(j, j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE);
              
              console.log(`Inserting ${supabaseBatch.length} embeddings into database`);
              await Promise.all(supabaseBatch.map((chunk, k) =>
                retry(
                  () => Embedding.add({
                    documentId: documentRecord.id!,
                    content: chunk.content,
                    embedding: embeddingBatch[k],
                    chunkIndex: i + j + k,
                    category: category as WebPageCategory,
                    metadata: {
                      pageTitle: `${category} - Website Content`,
                      sourceUrl: documents[0].url,
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
                )
              ));

              console.log(`Successfully inserted batch of embeddings`);

              // Add delay between Supabase batches
              if (j + EMBEDDING_CONSTANTS.SUPABASE_BATCH_SIZE < batch.length) {
                await new Promise(resolve => setTimeout(resolve, EMBEDDING_CONSTANTS.SUPABASE_DELAY));
              }
            }
            break; // Success, exit retry loop
          } catch (error) {
            console.error(`Error processing batch (attempt ${attempt + 1}/${EMBEDDING_CONSTANTS.MAX_RETRIES}):`, error);
            if (attempt === EMBEDDING_CONSTANTS.MAX_RETRIES - 1) {
              throw error; // Re-throw on final attempt
            }
            const delay = EMBEDDING_CONSTANTS.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            console.warn(`Rate limit hit, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    } catch (error) {
      console.error(`Failed to process category ${category}:`, error);
      // Continue with next category instead of failing completely
      continue;
    }
  }
  console.log('Finished createEmbeddings');
} 
