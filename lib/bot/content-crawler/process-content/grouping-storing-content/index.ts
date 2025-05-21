import { CrawlConfig, CategorizedContent } from '../../config';
import { groupContentByCategory } from './content-grouper';
import { createDocument, createChunks } from './document-creator';
import { createEmbeddingsForChunks } from './embedding-creator';
import { updateCrawlSession } from './crawl-session-manager';
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

    // 2. Process each category
    for (const [category, paragraphs] of Object.entries(categorizedContent)) {
      if (paragraphs.length === 0) {
        logger.logUrlFiltered(category, 'No content to process');
        continue;
      }

      try {
        console.log(`[Content Processor] Processing category: ${category}`);
        
        // 2.1 Create document
        const combinedContent = paragraphs.join('\n\n');
        const documentRecord = await createDocument(
          config.businessId,
          category,
          combinedContent,
          config.websiteUrl
        );

        // 2.2 Create chunks and embeddings
        const chunks = createChunks(categorizedSections, category, 1000); // Default chunk size
        await createEmbeddingsForChunks(
          chunks,
          documentRecord,
          category,
          config.websiteUrl,
          documentRecord.contentHash,
          5 // Default concurrency limit
        );

        logger.logCategoryProcessed(category);
        console.log(`[Content Processor] Finished processing category: ${category}`);
      } catch (error) {
        logger.logUrlSkipped(category, error instanceof Error ? error.message : String(error));
        console.error(`[Content Processor] Failed to process category ${category}:`, error);
      }
    }

    // 3. Update crawl session
    await updateCrawlSession(
      config.businessId,
      urls,
      processedUrls,
      categorizedSections
    );

    console.log(`[Content Processor] Content processing completed in ${(Date.now() - startTime)/1000}s`);
    return 'success';
  } catch (error) {
    console.error('[Content Processor] Content processing failed:', error);
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
} 