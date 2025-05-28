import { CrawlConfig, CategorizedContent, CONFIDENCE_CONFIG, Category, CATEGORY_DISPLAY_NAMES, TextChunk, defaultConfig, ExtractedPatterns } from '@/lib/config/config';
import { generateContentHash, runConcurrentTasks } from '@/lib/bot/content-crawler/utils';
import { CrawlSession } from '@/lib/models/crawl-session';
import { logger } from '@/lib/bot/content-crawler/process-content/logger';
import { embeddingInQueue } from './embedding-creator';
import { DocumentData } from '@/lib/models/documents';
import {
    savePdfInitialCategories, saveUrlInitialCategories, savePdfDocument, saveUrlDocument,
    savePdfEmbedding, saveUrlEmbedding, savePdfManifest, saveUrlManifest
} from '../logger-artifact-savers';

const extractPdfNameFromPdfUrl = (pdfUrl: string | undefined): string | null => {
    if (typeof pdfUrl !== 'string' || !pdfUrl.startsWith('pdf:')) return null;
    const hashIndex = pdfUrl.indexOf('#');
    const nameEndIndex = hashIndex !== -1 ? hashIndex : undefined;
    return pdfUrl.substring(4, nameEndIndex);
};

const getSourceKey = (url: string | undefined): string => {
  if (typeof url !== 'string' || !url) {
    console.warn('[getSourceKey] Received invalid URL input:', url);
    return 'unknown_source_key'; 
  }
  const pdfName = extractPdfNameFromPdfUrl(url);
  if (pdfName) return `pdf:${pdfName}`;
  return url; 
};

export async function processContent(
  config: CrawlConfig, 
  llmDefinedCategorizedChunks: CategorizedContent[], 
  processedPageUrls: string[],
  processedRootUrls: string[],
  llmDefinedChunksForManifest: TextChunk[] 
): Promise<string> {
  try {
    console.log('[Content Processor] Processing LLM-defined chunks...');
    const startTime = Date.now();
    const finalDocuments: DocumentData[] = []; 
    const finalLoggedEmbeddings: Array<any & { originalSourceUrl: string }> = [];

    const initialCategoriesBySource: Record<string, { categories: Set<Category>, isPdf: boolean, pdfName?: string, representativeUrl: string }> = {};
    llmDefinedCategorizedChunks.forEach(section => {
      if (!section.url || section.category === undefined) {
        console.warn('[Content Processor] Skipping LLM chunk due to invalid URL or category:', section);
        return; 
      }
      const sourceKey = getSourceKey(section.url);
      if (!initialCategoriesBySource[sourceKey]) {
        const pdfName = extractPdfNameFromPdfUrl(section.url);
        initialCategoriesBySource[sourceKey] = { 
            categories: new Set(), 
            isPdf: !!pdfName, 
            pdfName: pdfName ?? undefined, 
            representativeUrl: pdfName ? `pdf:${pdfName}` : sourceKey 
        };
      }
      initialCategoriesBySource[sourceKey].categories.add(section.category);
    });

    for (const key in initialCategoriesBySource) {
      const item = initialCategoriesBySource[key];
      const categoryNames = Array.from(item.categories).map(c => CATEGORY_DISPLAY_NAMES[c as Category] || 'Unknown Category');
      if (item.isPdf && item.pdfName) {
        savePdfInitialCategories(item.pdfName, { source: item.representativeUrl, categories: categoryNames });
      } else {
        saveUrlInitialCategories(item.representativeUrl, { source: item.representativeUrl, categories: categoryNames });
      }
    }

    for (const section of llmDefinedCategorizedChunks) {
      await logger.logDocumentCreationAttempt(); 

      const categoryName = CATEGORY_DISPLAY_NAMES[section.category as Category] || 'Unknown Category';
      
      try {
        const contentHash = generateContentHash(section.content, 'en');

        const document: DocumentData = {
          businessId: config.businessId,
          content: section.content,
          title: `${categoryName} - ${section.url}`.substring(0, 250),
          source: section.url, 
          type: config.type || (section.url.startsWith('pdf:') ? 'pdf' : 'website_page'),
          category: categoryName,
          contentHash,
          confidence: section.confidence,
          sessionId: undefined,
        };
        finalDocuments.push(document);

        const sectionPdfName = extractPdfNameFromPdfUrl(section.url);
        if (sectionPdfName) {
          savePdfDocument(sectionPdfName, contentHash, document);
        } else {
          saveUrlDocument(section.url, contentHash, document);
        }
        await logger.logDocumentCreated();
        await logger.logCategoryProcessed(categoryName);

      } catch (error) {
        await logger.logDocumentFailed();
        console.error(`[Content Processor] Failed to create document for LLM chunk from ${section.url}, category ${categoryName}:`, error);
        await logger.logCategorizationFailed();
      }
    }
    
    const embeddingCreationConcurrency = config.concurrency ?? defaultConfig.concurrency;
    const embeddingTaskGenerator = async function*(): AsyncGenerator<() => Promise<void>> {
      for (let i = 0; i < finalDocuments.length; i++) {
        const doc = finalDocuments[i];
        yield async () => {
          if (!doc.content || !doc.source || !doc.contentHash) {
             console.warn(`[Embedding Creation] Skipped: Invalid document for embedding (index ${i})`, doc.title);
             return;
          }
          try {
            await logger.logEmbeddingAttempt();
            const embeddingVector = await embeddingInQueue(
              doc.content,
              doc.source, 
              doc.contentHash 
            );
            const embeddingArtifactId = `${doc.contentHash}_llm_chunk_emb`; 
            const embeddingData = { 
              content: doc.content,
              embedding: embeddingVector,
              category: doc.category,
              metadata: {
                pageTitle: doc.title, 
                sourceUrl: doc.source,
                documentContentHash: doc.contentHash,
                crawlTimestamp: Date.now(),
                language: 'en',
                confidence: doc.confidence,
              }
            };

            const docPdfName = extractPdfNameFromPdfUrl(doc.source as string);
            if (docPdfName) {
              savePdfEmbedding(docPdfName, embeddingArtifactId, embeddingData);
            } else {
              saveUrlEmbedding(doc.source as string, embeddingArtifactId, embeddingData);
            }
            await logger.logEmbeddingSuccess();
            finalLoggedEmbeddings.push({ 
                ...embeddingData, 
                originalSourceUrl: doc.source, 
            });
          } catch (error) {
            await logger.logEmbeddingFailure();
            console.error(`[Content Processor] Failed to create embedding for LLM-defined doc ${doc.title}:`, error);
          }
        };
      }
    };
    await runConcurrentTasks(embeddingTaskGenerator, embeddingCreationConcurrency);

    const manifestDataBySource: Record<string, { 
        llmDefinedChunks: TextChunk[],
        documents: DocumentData[],
        embeddings: any[]
    }> = {};

    llmDefinedChunksForManifest.forEach(chunk => {
      const sourceKey = getSourceKey(chunk.sourcePageUrl);
      if (!manifestDataBySource[sourceKey]) {
        manifestDataBySource[sourceKey] = { llmDefinedChunks: [], documents: [], embeddings: [] };
      }
      manifestDataBySource[sourceKey].llmDefinedChunks.push(chunk);
    });

    finalDocuments.forEach(doc => {
      const sourceKey = getSourceKey(doc.source as string);
      if (!manifestDataBySource[sourceKey]) {
        manifestDataBySource[sourceKey] = { llmDefinedChunks: [], documents: [], embeddings: [] };
      }
      manifestDataBySource[sourceKey].documents.push(doc);
    });

    finalLoggedEmbeddings.forEach(emb => {
      const sourceKey = getSourceKey(emb.originalSourceUrl);
       if (!manifestDataBySource[sourceKey]) {
        manifestDataBySource[sourceKey] = { llmDefinedChunks: [], documents: [], embeddings: [] };
      }
      manifestDataBySource[sourceKey].embeddings.push(emb);
    });
    
    for (const sourceKey in manifestDataBySource) {
      const data = manifestDataBySource[sourceKey];
      const pdfName = extractPdfNameFromPdfUrl(sourceKey); 
      if (pdfName) {
        savePdfManifest(pdfName, data);
      } else {
        saveUrlManifest(sourceKey, data);
      }
    }

    const presentCategoriesFromLLM = new Set(finalDocuments.map(doc => doc.category));
    const sessionData = {
      businessId: config.businessId,
      startTime: startTime,
      endTime: Date.now(),
      totalPages: processedPageUrls.length,
      successfulPages: processedRootUrls.length,
      failedPages: (config.type === 'pdf' ? (config.pdfNames?.length || 0) : (config.websiteUrl ? 1:0) ) - processedRootUrls.length,
      categories: Object.fromEntries(Array.from(presentCategoriesFromLLM).map(catName => [catName as string, finalDocuments.filter(d => d.category === catName).length])),
      errors: [], 
      missingInformation: Object.values(CATEGORY_DISPLAY_NAMES)
        .filter(displayName => !presentCategoriesFromLLM.has(displayName))
        .join(', '),
      confidenceStats: { 
        averageConfidence: finalDocuments.reduce((sum, doc) => sum + (doc.confidence || 0), 0) / (finalDocuments.length || 1),
        lowConfidenceCategories: finalDocuments
          .filter(doc => doc.confidence && doc.confidence < CONFIDENCE_CONFIG.WARNING_THRESHOLD)
          .map(doc => doc.category as string),
        totalCategories: finalDocuments.length,
      }
    };

    await CrawlSession.addSessionWithDocumentsAndEmbeddings(sessionData, finalDocuments, finalLoggedEmbeddings);

    console.log(`[Content Processor] Processing of LLM-defined chunks completed in ${(Date.now() - startTime)/1000}s`);
    return 'success';
  } catch (error) {
    console.error('[Content Processor] Processing of LLM-defined chunks failed catastrophically:', error);
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
} 