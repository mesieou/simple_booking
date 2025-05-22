import { CrawlConfig, CategorizedContent, VALID_CATEGORIES } from '../../config';
import { groupContentByCategory } from './content-grouper';
import { createChunks } from './document-creator';
import { embeddingInQueue } from './embedding-creator';
import { generateContentHash } from '../../utils';
import { CrawlSession } from '@/lib/models/crawl-session';
import { logger } from '../logger';

export async function processContent(
  config: CrawlConfig, 
  categorizedSections: CategorizedContent[], 
  urls: string[], 
  processedUrls: string[]
): Promise<string> {
  try {
    console.log('[Content Processor] Starting content processing...');
    const startTime = Date.now();

    // 1. Group content by category
    const { categorizedContent } = groupContentByCategory(categorizedSections);

    // Compute missing categories for missingInformation using categorizedSections (original logic)
    const presentCategories = new Set(categorizedSections.map(section => section.category));
    const missingCategories = VALID_CATEGORIES.filter(
      (category) => !presentCategories.has(category)
    );

    // 2. Prepare arrays for documents and embeddings
    const documents = [];
    const embeddings = [];

    for (const [category, paragraphs] of Object.entries(categorizedContent)) {
      if (paragraphs.length === 0) {
        logger.logUrlFiltered(category, 'No content to process');
        continue;
      }

      try {
        console.log(`[Content Processor] Processing category: ${category}`);
        // Prepare document
        const combinedContent = paragraphs.join('\n\n');
        const contentHash = generateContentHash(combinedContent, 'en');
        documents.push({
          businessId: config.businessId,
          content: combinedContent,
          title: `${category} - Website Content`,
          source: config.websiteUrl,
          type: config.type || 'website_page',
          category,
          contentHash
        });

        // Prepare chunks and embeddings
        const chunks = createChunks(categorizedSections, category, 1000); // Default chunk size
        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          const embedding = await embeddingInQueue(chunk.content);
          embeddings.push({
            content: chunk.content,
            embedding,
            chunkIndex: j,
            category,
            metadata: {
              pageTitle: `${category} - Website Content`,
              sourceUrl: config.websiteUrl,
              contentHash,
              crawlTimestamp: Date.now(),
              language: 'en',
              confidence: chunk.confidence
            }
          });
        }

        logger.logCategoryProcessed(category);
        console.log(`[Content Processor] Finished processing category: ${category}`);
      } catch (error) {
        logger.logUrlSkipped(category, error instanceof Error ? error.message : String(error));
        console.error(`[Content Processor] Failed to process category ${category}:`, error);
      }
    }

    // 3. Prepare sessionData
    const sessionData = {
      businessId: config.businessId,
      startTime: Date.now(),
      endTime: Date.now(),
      totalPages: urls.length,
      successfulPages: processedUrls.length,
      failedPages: urls.length - processedUrls.length,
      categories: Object.fromEntries(Array.from(presentCategories).map(cat => [cat, 1])),
      errors: [],
      missingInformation: missingCategories.join(', ')
    };

    // 4. Store everything in one go
    await CrawlSession.addSessionWithDocumentsAndEmbeddings(sessionData, documents, embeddings);

    console.log(`[Content Processor] Content processing completed in ${(Date.now() - startTime)/1000}s`);
    return 'success';
  } catch (error) {
    console.error('[Content Processor] Content processing failed:', error);
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
} 