import { CrawlConfig, CategorizedContent, VALID_CATEGORIES, CONFIDENCE_CONFIG } from '../../config';
import { groupContentByCategory } from './content-grouper';
import { generateContentHash } from '../../utils';
import { CrawlSession } from '@/lib/models/crawl-session';
import { logger } from '../logger';
import { validateConfidence, meetsConfidenceThreshold, logConfidence } from '../../utils';
import { embeddingInQueue } from './embedding-creator';

export async function processContent(
  config: CrawlConfig, 
  categorizedSections: CategorizedContent[], 
  urls: string[], 
  processedUrls: string[]
): Promise<string> {
  try {
    console.log('[Content Processor] Starting content processing...');
    const startTime = Date.now();

    // 1. Group content by category (for document creation only)
    const { categorizedContent } = groupContentByCategory(categorizedSections);

    // Compute missing categories for missingInformation using categorizedSections (original logic)
    const presentCategories = new Set(categorizedSections.map(section => section.category));
    const missingCategories = VALID_CATEGORIES.filter(
      (category) => !presentCategories.has(category)
    );

    // 2. Prepare arrays for documents and embeddings
    const documents = [];
    const embeddings = [];

    // --- Document creation: one per category ---
    for (const [category, paragraphs] of Object.entries(categorizedContent)) {
      if (paragraphs.length === 0) {
        logger.logUrlFiltered(category, 'No content to process');
        continue;
      }

      try {
        console.log(`[Content Processor] Processing category: ${category}`);
        // Calculate average confidence for this category
        const categorySections = categorizedSections.filter(section => section.category === category);
        const avgConfidence = validateConfidence(
          categorySections.reduce((sum, section) => sum + section.confidence, 0) / categorySections.length
        );

        // Skip if confidence is too low
        if (!meetsConfidenceThreshold(avgConfidence)) {
          logger.logUrlFiltered(category, `Low confidence: ${avgConfidence.toFixed(2)}`);
          continue;
        }

        logConfidence(category, avgConfidence, 'document-creation');

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
          contentHash,
          confidence: avgConfidence
        });
      } catch (error) {
        logger.logUrlSkipped(category, error instanceof Error ? error.message : String(error));
        console.error(`[Content Processor] Failed to process category ${category}:`, error);
      }
    }

    // --- Embedding creation: one per original categorized chunk ---
    for (let i = 0; i < categorizedSections.length; i++) {
      const section = categorizedSections[i];
      // Find the document for this embedding by category
      const doc = documents.find(d => d.category === section.category);
      if (!doc) continue; // Should not happen, but safety check
      try {
        const embedding = await embeddingInQueue(section.content);
        embeddings.push({
          content: section.content,
          embedding,
          chunkIndex: i,
          category: section.category,
          metadata: {
            pageTitle: `${section.category} - Website Content`,
            sourceUrl: config.websiteUrl,
            contentHash: doc.contentHash,
            crawlTimestamp: Date.now(),
            language: 'en',
            confidence: section.confidence
          }
        });
        logger.logEmbedding(`${doc.contentHash}-${i}`, doc.contentHash, 'processed');
      } catch (error) {
        logger.logEmbedding(`${doc.contentHash}-${i}`, doc.contentHash, 'failed', error instanceof Error ? error.message : String(error));
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
      missingInformation: missingCategories.join(', '),
      confidenceStats: {
        averageConfidence: documents.reduce((sum, doc) => sum + (doc.confidence || 0), 0) / documents.length,
        lowConfidenceCategories: documents
          .filter(doc => doc.confidence && doc.confidence < CONFIDENCE_CONFIG.WARNING_THRESHOLD)
          .map(doc => doc.category),
        totalCategories: documents.length,
        filteredCategories: VALID_CATEGORIES.length - documents.length
      }
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