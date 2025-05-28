import { CrawlConfig, Category, CATEGORY_DISPLAY_NAMES, defaultConfig, CONFIDENCE_CONFIG } from '@/lib/config/config';
import { generateContentHash, runConcurrentTasks } from '@/lib/bot/content-crawler/utils';
import { CrawlSession } from '@/lib/models/crawl-session';
import { logger } from '@/lib/bot/content-crawler/process-content/logger';
import { embeddingInQueue } from './embedding-creator';
import { DocumentData } from '@/lib/models/documents';
import {
    savePdfDocument, saveUrlDocument,
    savePdfEmbedding, savePdfManifest, saveUrlManifest,
    saveUrlPageEmbeddingsArtifact
} from '../logger-artifact-savers';
import { LLMSegmentedChunk } from '../LLMSegmenterCategorizer';

// Define the expected structure for the result of embeddingInQueue
interface EmbeddingQueueResult {
  vector: number[];
  prompt?: any; // The prompt used to generate the embedding
  fullLlmResponse?: any; // The full response from the LLM for the embedding
}

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

interface ManifestDocumentEntry {
  documentId: string;
  chunkOrder: number;
  category?: string;
  originalTextLength: number;
  preChunkSourceIndex?: number;
}

interface SourceManifestData {
  sourceUrl: string;
  pageTitle?: string;
  isPdf: boolean;
  totalLlmChunks: number;
  documents: ManifestDocumentEntry[];
}

interface EmbeddingDataForSession {
  content: string;
  embedding: number[];
  businessId: string;
  source: string;
  type: 'website_page' | 'pdf' | undefined;
  category?: string;
  contentHash: string;
  metadata?: { 
    documentContentHash?: string;
    [key: string]: any;
  };
}

interface ProcessedUrlChunk {
  documentId: string;
  chunkOrder: number;
  category?: string;
  originalText: string;
  originalTextLength: number;
  preChunkSourceIndex?: number;
  pageTitle?: string;
  confidence?: number;
  embeddingVector?: number[];
  embeddingLlmPrompt?: any;
  embeddingLlmResponse?: any;
}

interface UrlPageEmbeddingData {
  sourceUrl: string;
  pageTitle?: string;
  isPdf: false;
  totalLlmChunksOriginally: number;
  processedUrlChunks: ProcessedUrlChunk[];
}

export async function processContent(
  config: CrawlConfig, 
  llmSegmentedChunks: LLMSegmentedChunk[],
  processedPageUrls: string[],
  processedRootUrls: string[]
): Promise<string> {
  try {
    console.log(`[Content Processor] Processing ${llmSegmentedChunks.length} LLM-defined semantic chunks...`);
    const startTime = Date.now();
    
    const pdfDocumentsToEmbed: Array<DocumentData & { preChunkSourceIndex?: number }> = []; 
    const urlDocumentsDataForSession: Array<DocumentData & { embedding?: number[], preChunkSourceIndex?: number }> = [];

    const manifestDataBySource: Record<string, SourceManifestData> = {};
    const urlPageEmbeddingsMap: Map<string, UrlPageEmbeddingData> = new Map();

    for (const llmChunk of llmSegmentedChunks) {
      await logger.logDocumentCreationAttempt(); 

      const categoryName = llmChunk.categoryName || CATEGORY_DISPLAY_NAMES[llmChunk.category as Category] || 'Unknown Category';
      const contentHash = generateContentHash(llmChunk.chunkText, 'en');
      const sourceKey = getSourceKey(llmChunk.sourceUrl);
      const isPdfChunk = !!extractPdfNameFromPdfUrl(llmChunk.sourceUrl);

      if (!manifestDataBySource[sourceKey]) {
          manifestDataBySource[sourceKey] = {
              sourceUrl: llmChunk.sourceUrl, 
              pageTitle: llmChunk.pageTitle,
              isPdf: isPdfChunk,
              totalLlmChunks: 0,
              documents: []
          };
      }
      const manifestDocEntry: ManifestDocumentEntry = {
          documentId: contentHash,
          chunkOrder: llmChunk.chunkOrder,
          category: categoryName,
          originalTextLength: llmChunk.chunkText.length,
          preChunkSourceIndex: llmChunk.preChunkSourceIndex
      };
      manifestDataBySource[sourceKey].documents.push(manifestDocEntry);
      manifestDataBySource[sourceKey].totalLlmChunks++;

      if (isPdfChunk) {
        const pdfName = extractPdfNameFromPdfUrl(llmChunk.sourceUrl)!;
        const document: DocumentData & { preChunkSourceIndex?: number } = {
          businessId: config.businessId,
          content: llmChunk.chunkText,
          title: `${llmChunk.pageTitle || 'Untitled PDF'} - ${categoryName} (Chunk ${llmChunk.chunkOrder}, Pre ${llmChunk.preChunkSourceIndex ?? 'N/A'})`.substring(0, 250),
          source: llmChunk.sourceUrl, 
          type: 'pdf',
          category: categoryName,
          contentHash,
          confidence: llmChunk.confidence,
          sessionId: undefined, 
          preChunkSourceIndex: llmChunk.preChunkSourceIndex
        };
        savePdfDocument(pdfName, contentHash, document);
        pdfDocumentsToEmbed.push(document);
      } else {
        if (!urlPageEmbeddingsMap.has(llmChunk.sourceUrl)) {
          urlPageEmbeddingsMap.set(llmChunk.sourceUrl, {
            sourceUrl: llmChunk.sourceUrl,
            pageTitle: llmChunk.pageTitle,
            isPdf: false,
            totalLlmChunksOriginally: 0,
            processedUrlChunks: []
          });
        }
        const pageData = urlPageEmbeddingsMap.get(llmChunk.sourceUrl)!;

        pageData.processedUrlChunks.push({
          documentId: contentHash,
          chunkOrder: llmChunk.chunkOrder,
          category: categoryName,
          originalText: llmChunk.chunkText,
          originalTextLength: llmChunk.chunkText.length,
          preChunkSourceIndex: llmChunk.preChunkSourceIndex,
          pageTitle: llmChunk.pageTitle,
          confidence: llmChunk.confidence
        });
        
        urlDocumentsDataForSession.push({
            businessId: config.businessId,
            content: llmChunk.chunkText,
            title: `${llmChunk.pageTitle || 'Untitled'} - ${categoryName} (Chunk ${llmChunk.chunkOrder}, Pre ${llmChunk.preChunkSourceIndex ?? 'N/A'})`.substring(0, 250),
            source: llmChunk.sourceUrl,
            type: 'website_page',
            category: categoryName,
            contentHash,
            confidence: llmChunk.confidence,
            sessionId: undefined,
            preChunkSourceIndex: llmChunk.preChunkSourceIndex
        });
      }
      await logger.logDocumentCreated();
      await logger.logCategoryProcessed(categoryName);
    }

    for (const pageData of Array.from(urlPageEmbeddingsMap.values())) {
        pageData.totalLlmChunksOriginally = llmSegmentedChunks.filter(c => c.sourceUrl === pageData.sourceUrl).length;
    }
    
    const embeddingCreationConcurrency = defaultConfig.concurrency;
    
    const itemsToEmbed = [
        ...pdfDocumentsToEmbed.map(doc => ({ ...doc, isPdf: true })), 
        ...Array.from(urlPageEmbeddingsMap.values())
    ];

    const embeddingTaskGenerator = async function*(): AsyncGenerator<() => Promise<void>> {
      for (let i = 0; i < itemsToEmbed.length; i++) {
        const item = itemsToEmbed[i];
        
        if (item.isPdf) {
          const doc = item as DocumentData & { isPdf: true, preChunkSourceIndex?: number };
          yield async () => {
            if (!doc.content || !doc.source || !doc.contentHash) {
               console.warn(`[Embedding Creation PDF] Skipped: Invalid document for embedding`, doc.title);
               return;
            }
            try {
              await logger.logEmbeddingAttempt();
              const embeddingResult = (await embeddingInQueue(
                doc.content,
                doc.source,
                `${doc.contentHash}_embed_data_for_summary_pdf_${i}`
              )) as unknown as EmbeddingQueueResult | null;

              if (!embeddingResult || !embeddingResult.vector) {
                  console.warn(`[Embedding Creation PDF] Embedding vector is null for doc ${doc.title}.`);
                  await logger.logEmbeddingFailure();
                  return;
              }
              const pdfName = extractPdfNameFromPdfUrl(doc.source as string)!;
              const embeddingArtifactId = `${doc.contentHash}_emb`; 
              const embeddingDataForArtifact = { 
                contentHash: doc.contentHash, 
                embedding: embeddingResult.vector,
                sourceUrl: doc.source, 
                category: doc.category,
                pageTitle: doc.title,
                crawlTimestamp: new Date().toISOString(),
              };
              savePdfEmbedding(pdfName, embeddingArtifactId, embeddingDataForArtifact);
              await logger.logEmbeddingSuccess();
            } catch (error) {
              await logger.logEmbeddingFailure();
              console.error(`[Content Processor PDF] Failed to create embedding for doc ${doc.title} (hash: ${doc.contentHash}):`, error);
            }
          };
        } else {
          const pageData = item as UrlPageEmbeddingData;
          for (let j = 0; j < pageData.processedUrlChunks.length; j++) {
            const chunk = pageData.processedUrlChunks[j];
            yield async () => {
              if (!chunk.originalText || !chunk.documentId) {
                 console.warn(`[Embedding Creation URL] Skipped: Invalid chunk for embedding`, chunk.documentId);
                 return;
              }
              try {
                await logger.logEmbeddingAttempt();
                const embeddingResult = (await embeddingInQueue(
                  chunk.originalText,
                  pageData.sourceUrl,
                  `${chunk.documentId}_embed_data_for_summary_url_${j}`
                )) as unknown as EmbeddingQueueResult | null;

                if (!embeddingResult || !embeddingResult.vector) {
                    console.warn(`[Embedding Creation URL] Embedding vector is null for chunk ${chunk.documentId}.`);
                    await logger.logEmbeddingFailure();
                    return;
                }
                chunk.embeddingVector = embeddingResult.vector;
                chunk.embeddingLlmPrompt = embeddingResult.prompt;
                chunk.embeddingLlmResponse = embeddingResult.fullLlmResponse;
                
                const sessionDoc = urlDocumentsDataForSession.find(d => d.contentHash === chunk.documentId);
                if (sessionDoc) {
                    sessionDoc.embedding = embeddingResult.vector;
                }

                await logger.logEmbeddingSuccess();
              } catch (error) {
                await logger.logEmbeddingFailure();
                console.error(`[Content Processor URL] Failed to create embedding for chunk ${chunk.documentId} from ${pageData.sourceUrl}:`, error);
              }
            };
          }
        }
      }
    };
    await runConcurrentTasks(embeddingTaskGenerator, embeddingCreationConcurrency);
    
    for (const [sourceUrl, pageData] of Array.from(urlPageEmbeddingsMap.entries())) {
      saveUrlPageEmbeddingsArtifact(sourceUrl, pageData);
    }

    for (const sourceKey in manifestDataBySource) {
      const data = manifestDataBySource[sourceKey];
      data.documents.sort((a,b) => a.chunkOrder - b.chunkOrder);
      const pdfName = extractPdfNameFromPdfUrl(sourceKey); 
      if (pdfName) {
        savePdfManifest(pdfName, data);
      } else {
        saveUrlManifest(sourceKey, data);
      }
    }
    
    const finalDocumentsForSession: DocumentData[] = [
        ...(pdfDocumentsToEmbed.map(doc => ({...doc, embedding: (doc as any).embeddingVectorFromStorage }))),
        ...urlDocumentsDataForSession
    ];
    
    const embeddingsForSessionStorage: EmbeddingDataForSession[] = [];
    finalDocumentsForSession.forEach(doc => {
        if ((doc as any).embedding && doc.contentHash) {
            embeddingsForSessionStorage.push({
                content: doc.content,
                embedding: (doc as any).embedding,
                businessId: config.businessId,
                source: doc.source as string,
                type: doc.type as 'website_page' | 'pdf' | undefined,
                category: doc.category,
                contentHash: doc.contentHash,
                metadata: {
                    documentContentHash: doc.contentHash,
                    pageTitle: doc.title,
                    chunkOrderLLM: (doc as any).metadata?.chunkOrderInSource,
                    preChunkSourceIndex: (doc as any).preChunkSourceIndex 
                }
            });
        }
    });

    const presentCategoriesFromLLM = new Set(finalDocumentsForSession.map(doc => doc.category));
    const sessionData = {
      businessId: config.businessId,
      startTime: startTime,
      endTime: Date.now(),
      totalPages: processedPageUrls.length,
      successfulPages: processedRootUrls.length,
      failedPages: processedPageUrls.length - processedRootUrls.length,
      totalLlmChunksProcessed: llmSegmentedChunks.length,
      totalDocumentsCreated: finalDocumentsForSession.length,
      totalEmbeddingsCreated: embeddingsForSessionStorage.length,
      categories: Object.fromEntries(Array.from(presentCategoriesFromLLM).map(catName => [catName as string, finalDocumentsForSession.filter(d => d.category === catName).length])),
      errors: [],
      missingInformation: Object.values(CATEGORY_DISPLAY_NAMES)
        .filter(displayName => !presentCategoriesFromLLM.has(displayName))
        .join(', '),
      confidenceStats: { 
        averageConfidence: finalDocumentsForSession.reduce((sum, doc) => sum + (doc.confidence || 0), 0) / (finalDocumentsForSession.length || 1),
        minConfidence: Math.min(...finalDocumentsForSession.map(d => d.confidence || 1.0).filter(c => c !== undefined && c !== null)),
        maxConfidence: Math.max(...finalDocumentsForSession.map(d => d.confidence || 0.0).filter(c => c !== undefined && c !== null)),
        lowConfidenceDocuments: finalDocumentsForSession
          .filter(doc => doc.confidence && doc.confidence < (CONFIDENCE_CONFIG.WARNING_THRESHOLD || 0.7))
          .map(doc => ({ id: doc.contentHash, title: doc.title, category: doc.category, confidence: doc.confidence })),
        totalDocuments: finalDocumentsForSession.length,
      }
    };

    await CrawlSession.addSessionWithDocumentsAndEmbeddings(sessionData, finalDocumentsForSession, embeddingsForSessionStorage);

    console.log(`[Content Processor] Processing of ${llmSegmentedChunks.length} LLM-defined chunks completed in ${(Date.now() - startTime)/1000}s. ${finalDocumentsForSession.length} documents created, ${embeddingsForSessionStorage.length} embeddings processed.`);
    return 'success';
  } catch (error) {
    console.error('[Content Processor] Processing of LLM-defined chunks failed catastrophically:', error);
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
} 