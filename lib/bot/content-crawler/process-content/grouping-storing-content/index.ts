import { CrawlConfig, CategorizedContent, VALID_CATEGORIES, CONFIDENCE_CONFIG, Category, CATEGORY_DISPLAY_NAMES } from '../../config';
import { groupContentByCategory } from './content-grouper';
import { generateContentHash } from '../../utils';
import { CrawlSession } from '@/lib/models/crawl-session';
import { logger } from '../logger';
import { embeddingInQueue } from './embedding-creator';
import { DocumentData } from '@/lib/models/documents';

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
    const missingCategories = Object.values(Category)
      .filter(cat => typeof cat === 'number' && !presentCategories.has(cat))
      .map(cat => CATEGORY_DISPLAY_NAMES[cat as Category]);

    // 2. Prepare arrays for documents and embeddings
    const documents: DocumentData[] = [];
    const embeddings: any[] = [];

    // --- Debug: Log all document and section categories before embedding creation ---
    console.log('Document categories:', documents.map(d => d.category));
    console.log('Section categories:', categorizedSections.map(s => CATEGORY_DISPLAY_NAMES[s.category]));

    // --- Document creation: one per category ---
    for (const [categoryName, paragraphs] of Object.entries(categorizedContent)) {
      const categoryEntry = Object.entries(CATEGORY_DISPLAY_NAMES)
        .find(([_, name]) => name === categoryName);
      
      if (!categoryEntry || paragraphs.length === 0) {
        logger.logUrlFiltered(categoryName, 'No content to process');
        continue;
      }

      const category = Number(categoryEntry[0]) as Category;

      try {
        console.log(`[Content Processor] Processing category: ${categoryName}`);
        // Calculate average confidence for this category (no longer used for filtering)
        const categorySections = categorizedSections.filter(section => section.category === category);
        // Prepare document
        const combinedContent = paragraphs.join('\n\n');
        const contentHash = generateContentHash(combinedContent, 'en');
        documents.push({
          businessId: config.businessId,
          content: combinedContent,
          title: `${categoryName} - Website Content`,
          source: config.type === 'pdf' ? config.pdfNames?.[0] : config.websiteUrl,
          type: config.type || 'website_page',
          category: categoryName,
          contentHash,
          confidence: categorySections.reduce((sum, section) => sum + section.confidence, 0) / categorySections.length,
        });
      } catch (error) {
        logger.logUrlSkipped(categoryName, error instanceof Error ? error.message : String(error));
        console.error(`[Content Processor] Failed to process category ${categoryName}:`, error);
      }
    }

    // --- Embedding creation: one per original categorized chunk ---
    for (let i = 0; i < categorizedSections.length; i++) {
      const section = categorizedSections[i];
      // Find the document for this embedding by category display name
      const doc = documents.find(d => d.category === CATEGORY_DISPLAY_NAMES[section.category]);
      if (!doc) {
        console.warn(`[Embedding Skipped] No document found for chunk index ${i}, category: ${CATEGORY_DISPLAY_NAMES[section.category]}`);
        console.warn('Available document categories:', documents.map(d => d.category));
        continue;
      }
      try {
        const embedding = await embeddingInQueue(section.content);
        logger.logEmbeddingAttempt({
          embeddingId: `${doc.contentHash ?? ''}-${i}`,
          docId: doc.contentHash ?? '',
          category: CATEGORY_DISPLAY_NAMES[section.category],
          chunkIndex: i,
          metadata: {
            pageTitle: `${CATEGORY_DISPLAY_NAMES[section.category]} - Website Content`,
            sourceUrl: urls[i],
            contentHash: doc.contentHash ?? '',
            crawlTimestamp: Date.now(),
            language: 'en',
            confidence: section.confidence,
            confidenceReason: section.confidenceReason
          }
        });
        embeddings.push({
          content: section.content ?? '',
          embedding,
          chunkIndex: i,
          category: section.category,
          metadata: {
            pageTitle: `${CATEGORY_DISPLAY_NAMES[section.category]} - Website Content`,
            sourceUrl: urls[i],
            contentHash: doc.contentHash ?? '',
            crawlTimestamp: Date.now(),
            language: 'en',
            confidence: section.confidence,
            confidenceReason: section.confidenceReason
          }
        });
        logger.logEmbedding(`${doc.contentHash}-${i}`, doc.contentHash ?? '', 'processed');
      } catch (error) {
        logger.logEmbedding(`${doc.contentHash}-${i}`, doc.contentHash ?? '', 'failed', error instanceof Error ? error.message : String(error));
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
      categories: Object.fromEntries(Array.from(presentCategories).map(cat => [CATEGORY_DISPLAY_NAMES[cat], 1])),
      errors: [],
      missingInformation: missingCategories.join(', '),
      confidenceStats: {
        averageConfidence: documents.reduce((sum, doc) => sum + (doc.confidence || 0), 0) / documents.length,
        lowConfidenceCategories: documents
          .filter(doc => doc.confidence && doc.confidence < CONFIDENCE_CONFIG.WARNING_THRESHOLD)
          .map(doc => doc.category),
        totalCategories: documents.length,
        filteredCategories: Object.keys(CATEGORY_DISPLAY_NAMES).length - documents.length
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