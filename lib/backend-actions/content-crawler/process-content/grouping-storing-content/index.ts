import { CrawlConfig, CATEGORY_DISPLAY_NAMES, EMBEDDING_CONFIG } from '@/lib/general-config/general-config';
import { generateContentHash, runConcurrentTasks } from '@/lib/backend-actions/content-crawler/content-crawler-utils';
import { CrawlSession, CrawlSessionData } from '@/lib/database/models/crawl-session';
import { logger } from '@/lib/backend-actions/content-crawler/process-content/logger';
import { embeddingInQueue } from './embedding-creator';
import { Document, DocumentData } from '@/lib/database/models/documents';
import { EmbeddingData } from '../../../../database/models/embeddings';
import {
    savePdfDocument, saveUrlDocument,
    savePdfManifest, saveUrlManifest,
    saveUrlPageEmbeddingsArtifact
} from '../logger-artifact-savers';
import { LLMSegmentedChunk } from '../LLMSegmenterCategorizer';
import { v4 as uuidv4 } from 'uuid';

// GLOBAL MUTEX: Module-level deduplication to prevent infinite loops
const GLOBAL_EMBEDDING_MUTEX = new Map<string, Promise<void>>();
const GLOBAL_PROCESSED_HASHES = new Set<string>();

// Clear global state function for testing/cleanup
function clearGlobalEmbeddingState(): void {
  GLOBAL_EMBEDDING_MUTEX.clear();
  GLOBAL_PROCESSED_HASHES.clear();
  console.log('[ProcessContent] Global embedding state cleared');
}

// --- Utility Functions ---

/**
 * Extracts the PDF name from a PDF URL string.
 * e.g., "pdf-my-document.pdf#page=1" -> "my-document.pdf"
 */
const extractPdfNameFromPdfUrl = (pdfUrl: string | undefined): string | null => {
    if (typeof pdfUrl !== 'string' || !pdfUrl.startsWith('pdf-')) return null;
    const hashIndex = pdfUrl.indexOf('#');
    const nameEndIndex = hashIndex !== -1 ? hashIndex : undefined;
    // Remove 'pdf-' prefix and content after '#'
    return pdfUrl.substring(4, nameEndIndex);
};

/**
 * Generates a consistent source key for manifests, using PDF name for PDFs or URL for websites.
 */
const getSourceKey = (url: string | undefined): string => {
  if (typeof url !== 'string' || !url) {
    console.warn('[getSourceKey] Received invalid URL input:', url);
    return 'unknown_source_key'; 
  }
  const pdfName = extractPdfNameFromPdfUrl(url);
  if (pdfName) return `pdf-${pdfName}`; // Ensure PDF source keys are distinct
  return url; 
};

// --- Interfaces ---

/** Defines an entry for a document within a source manifest. */
interface ManifestDocumentEntry {
  documentId: string; // Initially contentHash, updated to actual DB ID post-insert.
  chunkOrder: number;
  category?: string;
  originalTextLength: number;
  preChunkSourceIndex?: number;
}

/** Defines the structure for a source manifest (for a single URL or PDF). */
interface SourceManifestData {
  sourceUrl: string;
  pageTitle?: string;
  isPdf: boolean;
  totalLlmChunks: number;
  documents: ManifestDocumentEntry[];
}

/** Defines the structure for a processed URL chunk, primarily for artifact logging. */
interface ProcessedUrlChunk {
  documentId: string; // contentHash
  chunkOrder: number;
  category?: string;
  originalText: string;
  originalTextLength: number;
  preChunkSourceIndex?: number;
  pageTitle?: string;
  confidence?: number;
}

/** Defines data for URL page embedding artifacts (summary of chunks for a URL). */
interface UrlPageEmbeddingData {
  sourceUrl: string;
  pageTitle?: string;
  isPdf: false; // Always false for this type
  totalLlmChunksOriginally: number;
  processedUrlChunks: ProcessedUrlChunk[];
}

/** Defines the overall state accumulated during content processing. */
interface ProcessingState {
  documentsToProcess: DocumentData[];
  manifestDataBySource: Record<string, SourceManifestData>;
  urlPageEmbeddingsMap: Map<string, UrlPageEmbeddingData>;
  processedContentHashes: Set<string>; // Track already processed content hashes
  embeddingAttempts: number; // Track total embedding attempts
  embeddingFailures: number; // Track embedding failures
}

// --- Initialization and Core Logic Helpers ---

/** Initializes and returns a new ProcessingState object. */
function _initializeProcessingState(): ProcessingState {
  return {
    documentsToProcess: [],
    manifestDataBySource: {},
    urlPageEmbeddingsMap: new Map(),
    processedContentHashes: new Set(),
    embeddingAttempts: 0,
    embeddingFailures: 0,
  };
}

/** Updates the manifest data for a given LLM chunk, creating a new manifest if needed. */
function _updateManifestForChunk(
  llmChunk: LLMSegmentedChunk,
  contentHash: string,
  categoryName: string,
  isPdfChunk: boolean,
  sourceKey: string, 
  manifestDataBySource: Record<string, SourceManifestData>
): void {
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
}

/** Creates a DocumentData object from an LLM chunk originating from a PDF. */
function _createPdfDocumentData(
  llmChunk: LLMSegmentedChunk,
  config: CrawlConfig,
  contentHash: string,
  categoryName: string
): DocumentData {
  return {
    businessId: config.businessId,
    content: llmChunk.chunkText,
    title: `${llmChunk.pageTitle || 'Untitled PDF'} - ${categoryName} (Chunk ${llmChunk.chunkOrder}, Pre ${llmChunk.preChunkSourceIndex ?? 'N/A'})`.substring(0, 250),
    source: llmChunk.sourceUrl, 
    type: 'pdf',
    category: categoryName,
    contentHash,
    confidence: llmChunk.confidence,
    sessionId: undefined, // Session ID will be assigned before DB insert
    preChunkSourceIndex: llmChunk.preChunkSourceIndex,
  };
}

/** Creates a DocumentData object from an LLM chunk from a website URL and updates URL artifact data. */
function _createUrlDocumentData(
  llmChunk: LLMSegmentedChunk,
  config: CrawlConfig,
  contentHash: string,
  categoryName: string,
  state: ProcessingState // For updating urlPageEmbeddingsMap
): DocumentData {
  if (!state.urlPageEmbeddingsMap.has(llmChunk.sourceUrl)) {
    state.urlPageEmbeddingsMap.set(llmChunk.sourceUrl, {
      sourceUrl: llmChunk.sourceUrl,
      pageTitle: llmChunk.pageTitle,
      isPdf: false, 
      totalLlmChunksOriginally: 0, 
      processedUrlChunks: []
    });
  }
  const pageDataForArtifact = state.urlPageEmbeddingsMap.get(llmChunk.sourceUrl)!;
  const processedChunkForArtifact: ProcessedUrlChunk = {
      documentId: contentHash, 
      chunkOrder: llmChunk.chunkOrder,
      category: categoryName,
      originalText: llmChunk.chunkText,
      originalTextLength: llmChunk.chunkText.length,
      preChunkSourceIndex: llmChunk.preChunkSourceIndex,
      pageTitle: llmChunk.pageTitle,
      confidence: llmChunk.confidence,
  };
  pageDataForArtifact.processedUrlChunks.push(processedChunkForArtifact);
  pageDataForArtifact.totalLlmChunksOriginally = pageDataForArtifact.processedUrlChunks.length;

  return {
    businessId: config.businessId,
    content: llmChunk.chunkText,
    title: `${llmChunk.pageTitle || 'Untitled Page'} - ${categoryName} (Chunk ${llmChunk.chunkOrder}, Pre ${llmChunk.preChunkSourceIndex ?? 'N/A'})`.substring(0, 250),
    source: llmChunk.sourceUrl,
    type: 'website_page',
    category: categoryName,
    contentHash,
    confidence: llmChunk.confidence,
    sessionId: undefined, // Session ID will be assigned before DB insert
    preChunkSourceIndex: llmChunk.preChunkSourceIndex,
  };
}

// --- Main Processing Steps as Helper Functions ---

/** Initializes a new crawl session in the database. */
async function _initializeSession(config: CrawlConfig, processedPageUrls: string[], processedRootUrls: string[]): Promise<{sessionId: string; sessionInstance: CrawlSessionData}> {
  const newSessionId = uuidv4();
  const initialSessionData: CrawlSessionData = { // Explicitly CrawlSessionData
    id: newSessionId, // Assign generated UUID
    businessId: config.businessId,
    startTime: Date.now(),
    totalPages: 0, 
    successfulPages: processedRootUrls.length,
    failedPages: processedPageUrls.length - processedRootUrls.length,
    categories: {},
    errors: [],
    // endTime will be set at the very end
  };
  // REMOVED: const sessionInstance = await CrawlSession.add(initialSessionData);
  // REMOVED: if (!sessionInstance || !sessionInstance.id) {
  // REMOVED:   throw new Error("Failed to create or retrieve session instance ID during initialization.");
  // REMOVED: }
  console.log(`[ProcessContent] In-memory Session initialized: ${newSessionId}, Business ID: ${config.businessId}`);
  return { sessionId: newSessionId, sessionInstance: initialSessionData }; // Return in-memory data
}

/** Transforms LLM segmented chunks into initial DocumentData objects. */
function _prepareInitialDocumentsFromChunks(
  llmSegmentedChunks: LLMSegmentedChunk[],
  config: CrawlConfig,
  state: ProcessingState
): void {
  console.log('[ProcessContent] Step 1: Preparing initial DocumentData objects from LLM chunks...');
  let duplicatesSkipped = 0;
  
  for (const llmChunk of llmSegmentedChunks) {
    if (!llmChunk || !llmChunk.chunkText || llmChunk.chunkText.trim() === '') {
      console.warn('[ProcessContent] Encountered an empty or invalid LLM chunk. Skipping.', { 
        sourceUrl: llmChunk?.sourceUrl, chunkOrder: llmChunk?.chunkOrder 
      });
      continue;
    }

    const langForHash = 'en'; // Placeholder, consider llmChunk.language if available or config
    const contentHash = generateContentHash(
      llmChunk.chunkText + (llmChunk.sourceUrl || '') + llmChunk.chunkOrder + (llmChunk.preChunkSourceIndex ?? ''),
      langForHash
    );
    
    // GLOBAL DEDUPLICATION CHECK: Skip if this content hash has already been processed globally
    if (GLOBAL_PROCESSED_HASHES.has(contentHash)) {
      console.log(`[ProcessContent] Skipping globally processed content hash: ${contentHash} (source: ${llmChunk.sourceUrl}, chunk: ${llmChunk.chunkOrder})`);
      duplicatesSkipped++;
      continue;
    }
    
    // LOCAL DEDUPLICATION CHECK: Skip if this content hash has already been processed in this session
    if (state.processedContentHashes.has(contentHash)) {
      console.log(`[ProcessContent] Skipping session duplicate content hash: ${contentHash} (source: ${llmChunk.sourceUrl}, chunk: ${llmChunk.chunkOrder})`);
      duplicatesSkipped++;
      continue;
    }
    
    // Mark this content hash as processed both globally and locally
    GLOBAL_PROCESSED_HASHES.add(contentHash);
    state.processedContentHashes.add(contentHash);
    
    const categoryName = llmChunk.category ? (CATEGORY_DISPLAY_NAMES[llmChunk.category] || 'Uncategorized') : 'Uncategorized';
    const sourceKey = getSourceKey(llmChunk.sourceUrl);
    const isPdfChunk = llmChunk.sourceUrl?.startsWith('pdf-') || false;

    _updateManifestForChunk(llmChunk, contentHash, categoryName, isPdfChunk, sourceKey, state.manifestDataBySource);

    let document: DocumentData;
    if (isPdfChunk) {
      document = _createPdfDocumentData(llmChunk, config, contentHash, categoryName);
    } else {
      document = _createUrlDocumentData(llmChunk, config, contentHash, categoryName, state);
    }
    state.documentsToProcess.push(document);
  }
  console.log(`[ProcessContent] Step 1 completed. ${state.documentsToProcess.length} documents created and ready for embedding. ${duplicatesSkipped} duplicates skipped.`);
}

/** Generates embeddings for all documents in the processing state. */
async function _generateEmbeddingsForDocuments(state: ProcessingState): Promise<void> {
  console.log(`[ProcessContent] Step 2: Generating embeddings for ${state.documentsToProcess.length} documents...`);
  
  // OPTIMIZATION: Pre-filter documents to only process those that actually need embeddings
  const documentsNeedingEmbeddings = state.documentsToProcess.filter(doc => {
    // Skip documents without contentHash
    if (!doc.contentHash) {
      console.warn(`[ProcessContent] Filtering out document from ${doc.source || 'unknown'} - no contentHash`);
      return false;
    }
    
    // Skip documents without content
    if (!doc.content || doc.content.trim() === '') {
      console.warn(`[ProcessContent] Filtering out document ${doc.contentHash} - no content`);
      return false;
    }
    
    // Skip documents that already have embeddings
    if (doc.embedding && doc.embedding.length > 0) {
      console.log(`[ProcessContent] Filtering out document ${doc.contentHash} - already has embedding`);
      return false;
    }
    
    return true;
  });
  
  console.log(`[ProcessContent] After filtering: ${documentsNeedingEmbeddings.length} documents need embeddings (filtered out ${state.documentsToProcess.length - documentsNeedingEmbeddings.length})`);
  
  if (documentsNeedingEmbeddings.length === 0) {
    console.log("[ProcessContent] No documents need embeddings after filtering.");
    return;
  }

  // Circuit breaker check
  if (state.embeddingAttempts >= EMBEDDING_CONFIG.MAX_ATTEMPTS) {
    console.error(`[ProcessContent] CIRCUIT BREAKER: Maximum embedding attempts (${EMBEDDING_CONFIG.MAX_ATTEMPTS}) reached. Stopping to prevent infinite loop.`);
    return;
  }

  // Create tasks only for documents that need processing
  const embeddingTasks = documentsNeedingEmbeddings.map((doc, index) => 
    () => _generateAndAssignEmbeddingWithCircuitBreaker(doc, index, state)
  );
  
  // Use higher concurrency for embedding generation since rate limiter handles throttling
  const embeddingConcurrency = Math.min(embeddingTasks.length, 10); // Up to 10 concurrent embeddings
  console.log(`[ProcessContent] Processing ${embeddingTasks.length} embedding tasks with concurrency ${embeddingConcurrency}`);
  
  await runConcurrentTasks(async function*() { for (const task of embeddingTasks) yield task; }, embeddingConcurrency);
  
  // Final circuit breaker check
  if (state.embeddingAttempts >= EMBEDDING_CONFIG.MIN_ATTEMPTS_FOR_FAILURE_CHECK) {
    const failureRate = state.embeddingFailures / state.embeddingAttempts;
    if (failureRate > EMBEDDING_CONFIG.MAX_FAILURE_RATE) {
      console.error(`[ProcessContent] HIGH FAILURE RATE: ${(failureRate * 100).toFixed(1)}% of embeddings failed (${state.embeddingFailures}/${state.embeddingAttempts}). Consider checking OpenAI API status.`);
    }
  }
  
  console.log(`[ProcessContent] Step 2 completed. Embeddings generated (or attempted) for all documents. Stats: ${state.embeddingAttempts} attempts, ${state.embeddingFailures} failures.`);
}

/** Generates and assigns an embedding to a single DocumentData object with circuit breaker protection. */
async function _generateAndAssignEmbeddingWithCircuitBreaker(doc: DocumentData, index: number, state: ProcessingState): Promise<void> {
  // Circuit breaker check
  if (state.embeddingAttempts >= EMBEDDING_CONFIG.MAX_ATTEMPTS) {
    console.warn(`[Embedding] CIRCUIT BREAKER: Maximum attempts reached, skipping embedding for document`);
    return;
  }

  // CRITICAL: Ensure contentHash exists - if not, skip this document entirely
  if (!doc.contentHash) {
    console.warn(`[Embedding] Document from source ${doc.source || 'unknown'} has no contentHash, skipping embedding.`);
    return;
  }

  // ATOMIC CHECK 1: If already successfully processed globally (by another worker) and this doc instance reflects that, skip.
  // This handles cases where the doc instance might have been updated by the original worker if objects are shared,
  // or if GLOBAL_PROCESSED_HASHES is the most up-to-date record.
  if (GLOBAL_PROCESSED_HASHES.has(doc.contentHash) && doc.embedding && doc.embedding.length > 0) {
     console.log(`[Embedding] Document with hash ${doc.contentHash} was already processed and embedded by another worker (verified by this instance). Skipping.`);
     return;
  }
  
  // ATOMIC CHECK 2: Mutex for active processing. If another worker is on it, wait.
  if (GLOBAL_EMBEDDING_MUTEX.has(doc.contentHash)) {
    console.log(`[Embedding] Document with hash ${doc.contentHash} is actively being processed by another worker, waiting for completion...`);
    try {
      await GLOBAL_EMBEDDING_MUTEX.get(doc.contentHash);
      // After waiting, check if the document is now globally processed or if this instance has an embedding.
      if (doc.embedding && doc.embedding.length > 0) {
          console.log(`[Embedding] Document with hash ${doc.contentHash} now has embedding after waiting for another worker. Worker finished.`);
      } else if (GLOBAL_PROCESSED_HASHES.has(doc.contentHash)) {
           console.log(`[Embedding] Document with hash ${doc.contentHash} was marked as processed globally after waiting for another worker. Worker finished.`);
      } else {
          console.warn(`[Embedding] Document with hash ${doc.contentHash} still lacks embedding after waiting for another worker, and not globally processed. Will be re-evaluated if still needed in a future pass.`);
      }
    } catch (e) {
        console.error(`[Embedding] Error while waiting for other worker on hash ${doc.contentHash}:`, e);
        // If waiting failed, the original worker's finally block should clear the mutex.
        // This worker will return, and the document might be picked up again if still needed.
    }
    return; // Crucially, return, do not proceed to embed again in this worker.
  }

  // ATOMIC CHECK 3: Skip if document (this specific instance) already has an embedding 
  // (e.g., from a previous partial run if state was reloaded, or if it was populated by the awaited promise above in some scenarios)
  if (doc.embedding && doc.embedding.length > 0) {
    console.log(`[Embedding] Document with hash ${doc.contentHash} (this instance) already has embedding (${doc.embedding.length} dimensions), skipping.`);
    // Ensure it's marked globally if it has an embedding and wasn't already.
    if (!GLOBAL_PROCESSED_HASHES.has(doc.contentHash)) {
        GLOBAL_PROCESSED_HASHES.add(doc.contentHash);
        console.log(`[Embedding] Marked ${doc.contentHash} as globally processed due to existing embedding on this instance.`);
    }
    return;
  }

  // Create and store the processing promise for this document
  const processingPromise = (async () => {
    state.embeddingAttempts++;
    doc.embeddingInputText = doc.content; // Store the input text

    if (!doc.content || doc.content.trim() === '') {
      console.warn(`[Embedding] Document with hash ${doc.contentHash} from source ${doc.source} has no content or is empty, skipping embedding.`);
      logger.logUrlFailed(doc.source || 'unknown_source', `Embedding skipped for doc hash ${doc.contentHash}: No content`);
      doc.embeddingAttemptResult = { error: 'No content or empty content' }; // Log error on doc
      return;
    }

    try {
      await logger.logEmbeddingAttempt(); 
      const embeddingStartTime = Date.now();
      const interactionBaseId = doc.contentHash || `doc_idx_${index}_${Date.now()}`;
      const embeddingVector = await embeddingInQueue(doc.content, doc.source || 'unknown_source', interactionBaseId, doc.content.length);
      const embeddingEndTime = Date.now();

      if (embeddingVector && embeddingVector.length > 0) {
        doc.embedding = embeddingVector;
        doc.embeddingAttemptResult = { vectorSample: embeddingVector.slice(0,3) }; // Log sample on doc
        if (doc.contentHash) {
            GLOBAL_PROCESSED_HASHES.add(doc.contentHash); 
        } else {
            console.error(`[Embedding] CRITICAL: contentHash became undefined before adding to GLOBAL_PROCESSED_HASHES for doc from ${doc.source}. This should not happen.`);
        }
        console.log(`[Embedding] Successfully generated embedding for doc hash ${doc.contentHash} from source ${doc.source} in ${embeddingEndTime - embeddingStartTime}ms.`);
        await logger.logEmbeddingSuccess(); 
      } else {
        console.error(`[Embedding] Failed to generate embedding for doc hash ${doc.contentHash}. Embedding vector was null or empty.`);
        logger.logUrlFailed(doc.source || 'unknown_source', `Embedding generation failed for doc hash ${doc.contentHash} (null/empty vector)`);
        doc.embeddingAttemptResult = { error: 'Embedding vector null or empty' }; // Log error on doc
        await logger.logEmbeddingFailure(); 
        state.embeddingFailures++;
      }
    } catch (error: any) {
      console.error(`[Embedding] Error during embedding generation for doc hash ${doc.contentHash}:`, error);
      logger.logUrlFailed(doc.source || 'unknown_source', `Embedding error for doc hash ${doc.contentHash}: ${error.message || 'Unknown error'}`);
      doc.embeddingAttemptResult = { error: error.message, stack: error.stack }; // Log error on doc
      await logger.logEmbeddingFailure(); 
      state.embeddingFailures++;
    }
  })();

  // Store the promise and execute it
  if (!doc.contentHash) {
    console.error("[Embedding] CRITICAL: contentHash became undefined before mutex set. This should not happen.");
    return;
  }
  const currentContentHash: string = doc.contentHash; 
  GLOBAL_EMBEDDING_MUTEX.set(currentContentHash, processingPromise);
  
  try {
    await processingPromise;
  } finally {
    // Always clean up the mutex when done
    GLOBAL_EMBEDDING_MUTEX.delete(currentContentHash);
  }
}

/** Logs primary artifacts like manifests and URL page embedding summaries. */
function _saveSummaryArtifacts(state: ProcessingState): void {
  console.log('[ProcessContent] Step 3: Logging primary summary artifacts (manifests)...');
  // Save manifests
  for (const sourceKey in state.manifestDataBySource) {
    const manifest = state.manifestDataBySource[sourceKey];
    if (manifest.isPdf) {
      const pdfName = extractPdfNameFromPdfUrl(manifest.sourceUrl);
      if (pdfName) savePdfManifest(pdfName, manifest);
    } else {
      saveUrlManifest(manifest.sourceUrl, manifest);
    }
  }
  // REMOVED: Saving URL page embedding summaries, as per user request for consolidation
  // state.urlPageEmbeddingsMap.forEach((pageData, url) => {
  //     pageData.totalLlmChunksOriginally = pageData.processedUrlChunks.length; 
  //     saveUrlPageEmbeddingsArtifact(url, pageData);
  // });
  console.log('[ProcessContent] Step 3 completed. Primary summary artifacts (manifests) logged.');
}

// NEW HELPER FUNCTION for incremental document artifact saving
/** Saves individual JSON artifacts for a list of documents (typically for a single page). */
function _savePageDocumentJsonArtifacts(documentsForPage: DocumentData[]): void {
  if (!documentsForPage || documentsForPage.length === 0) {
    return;
  }
  const pageSource = documentsForPage[0]?.source || 'unknown_page_source';
  console.log(`[ProcessContentPerPage] Saving JSON artifacts for ${documentsForPage.length} documents from page: ${pageSource}`);
  
  for (const doc of documentsForPage) {
    if (!doc.contentHash) {
      console.warn(`[ProcessContentPerPage] Document from source ${doc.source || 'unknown'} is missing contentHash, cannot save artifact.`, { type: doc.type });
      continue;
    }
    // Only save artifact if embedding was successful or if we intend to save all regardless.
    // Assuming we save if contentHash exists, and embedding field is optional for the artifact.
    if (doc.type === 'pdf') {
      const pdfName = extractPdfNameFromPdfUrl(doc.source);
      if (pdfName) {
        savePdfDocument(pdfName, doc.contentHash, doc);
      } else {
        console.warn(`[ProcessContentPerPage] Could not extract PDF name from source ${doc.source} for PDF document artifact saving.`);
      }
    } else if (doc.type === 'website_page') {
      if (doc.source) {
        saveUrlDocument(doc.source, doc.contentHash, doc);
      } else {
        console.warn(`[ProcessContentPerPage] Document with contentHash ${doc.contentHash} is missing source URL, cannot save URL document artifact.`);
      }
    } else {
      console.warn(`[ProcessContentPerPage] Unknown document type '${doc.type}' for document with contentHash ${doc.contentHash}, artifact not saved.`);
    }
  }
  console.log(`[ProcessContentPerPage] Finished saving JSON artifacts for page: ${pageSource}`);
}

// RENAMED and REFACTORED: Was _persistDocumentsToDatabase
/** Collects documents and their embeddings that are ready for final database insertion. */
function _collectDocumentsAndEmbeddingsForFinalSave(
  state: ProcessingState,
  // sessionId is no longer needed here, it will be part of the main session data
): {
  collectedDocsData: Omit<DocumentData, 'id' | 'sessionId'>[]; // Documents ready for DB, session association handled by caller/persistence layer
  successfulPageSources: Set<string>; 
} {
  console.log('[ProcessContent] Collecting documents with their embeddings for final save...');
  const docsForSave: Omit<DocumentData, 'id' | 'sessionId'>[] = [];
  // REMOVED: const embeddingsForSave: (Omit<EmbeddingData, 'id' | 'documentId'> & { metadata: { documentContentHash: string }, content: string })[] = [];

  const successfulPageSources = new Set<string>();

  for (const doc of state.documentsToProcess) {
    // Save document if it has content, a contentHash, and an embedding vector
    if (doc.content && doc.contentHash && doc.embedding && doc.embedding.length > 0) {
      docsForSave.push({
        businessId: doc.businessId, 
        content: doc.content,
        title: doc.title,
        source: doc.source,
        type: doc.type,
        category: doc.category, 
        contentHash: doc.contentHash,
        confidence: doc.confidence,
        preChunkSourceIndex: doc.preChunkSourceIndex,
        embedding: doc.embedding, // Store embedding directly in the document data
        embeddingInputText: doc.embeddingInputText, // Store input text directly
        embeddingAttemptResult: doc.embeddingAttemptResult, // Store attempt result directly
        // sessionId is intentionally omitted here; CrawlSession.addSessionWithDocumentsAndEmbeddings is expected to associate docs with the session
      });

      // REMOVED: Population of embeddingsForSave
      
      if (doc.source) {
        successfulPageSources.add(doc.source);
      }

    } else {
      if (!doc.contentHash) console.warn(`[ProcessContent] Doc from ${doc.source || 'unknown_source'} skipped for DB save: missing contentHash`);
      else if (!doc.content) console.warn(`[ProcessContent] Doc ${doc.contentHash} skipped for DB save: missing content`);
      else if (!doc.embedding || doc.embedding.length === 0) console.warn(`[ProcessContent] Doc ${doc.contentHash} skipped for DB save: missing embedding`);
    }
  }

  console.log(`[ProcessContent] Collected ${docsForSave.length} documents (with embeddeddings) for saving.`);
  console.log(`[ProcessContent] Successful pages (with at least one saved chunk): ${successfulPageSources.size}`);
  
  return { collectedDocsData: docsForSave, successfulPageSources };
}

/** Logs final messages regarding session completion. */
export async function finalizeContentProcessing(
  processingState: ProcessingState,
  sessionInstance: CrawlSessionData 
): Promise<string> { 
  console.log('[ProcessContentFinalize] Finalizing content processing...');
  

  // Update sessionInstance with final details
  sessionInstance.endTime = Date.now();
  
  const { collectedDocsData, successfulPageSources } = _collectDocumentsAndEmbeddingsForFinalSave(processingState);

  // Update categories in sessionInstance
  const finalCategories: Record<string, number> = {};
  collectedDocsData.forEach(doc => { 
    if (doc.category) {
      finalCategories[doc.category] = (finalCategories[doc.category] || 0) + 1;
    }
  });
  sessionInstance.categories = finalCategories;

  // Update page counts
  sessionInstance.totalPages = Object.keys(processingState.manifestDataBySource).length;
  sessionInstance.successfulPages = successfulPageSources.size;
  sessionInstance.failedPages = sessionInstance.totalPages - sessionInstance.successfulPages;
  
  _saveSummaryArtifacts(processingState); 

  if (collectedDocsData.length > 0) {
    console.log(`[ProcessContentFinalize] Attempting to save session ${sessionInstance.id} with ${collectedDocsData.length} documents (embeddings included) to database...`);
    try {
      // Pass an empty array for the embeddings parameter, as embeddings are now part of collectedDocsData
      const { session: dbSession, savedDocuments } = await CrawlSession.addSessionWithDocumentsAndEmbeddings(
        sessionInstance, 
        collectedDocsData,
        { useServiceRole: true }
      );
      console.log(`[ProcessContentFinalize] Successfully saved session ${dbSession.id} with ${savedDocuments.length} documents.`);
      
      if (savedDocuments.length > 0) {
        const docIdMap = new Map(savedDocuments.map(sd => [sd.contentHash, sd.id]));
        for (const sourceKey in processingState.manifestDataBySource) {
          const manifest = processingState.manifestDataBySource[sourceKey];
          manifest.documents.forEach(md => {
            const dbId = docIdMap.get(md.documentId); 
            if (dbId) md.documentId = dbId;
          });
        }
        _saveSummaryArtifacts(processingState); 
        console.log('[ProcessContentFinalize] Re-saved manifests with updated document DB IDs.');
      }

    } catch (dbError: any) {
      console.error(`[ProcessContentFinalize] Failed to save session ${sessionInstance.id} and its documents/embeddings:`, dbError);
      sessionInstance.errors.push({ url: 'session_save_error', error: `Failed to save session/docs/embeddings: ${dbError.message}`});
      // Attempt to save the session with the error noted
      try {
        await CrawlSession.add(sessionInstance, { useServiceRole: true });
        console.warn(`[ProcessContentFinalize] Saved session ${sessionInstance.id} with error information after primary save failed.`);
      } catch (sessionSaveError: any) {
        console.error(`[ProcessContentFinalize] CRITICAL: Failed to save even the error state for session ${sessionInstance.id}:`, sessionSaveError);
      }
      throw dbError; 
    }
  } else {
    console.log(`[ProcessContentFinalize] No documents with embeddings to save to the database for session ${sessionInstance.id}. Saving a session entry with current stats.`);
    try {
        await CrawlSession.add(sessionInstance, { useServiceRole: true }); 
        console.log(`[ProcessContentFinalize] Successfully saved session ${sessionInstance.id} (no new documents/embeddings).`);
    } catch (sessionOnlyError: any) {
        console.error(`[ProcessContentFinalize] Critical error: Failed to save session ${sessionInstance.id} (no new documents/embeddings):`, sessionOnlyError);
        throw sessionOnlyError;
    }
  }

  console.log(`[ProcessContentFinalize] Content processing for session ${sessionInstance.id} finalized successfully.`);
  return sessionInstance.id!; 
}

// --- Main Exported Function ---

/**
 * Initializes the content processing pipeline by creating a crawl session and an initial processing state.
 * This should be called once before processing individual pages.
 * @param config The crawl configuration.
 * @param processedPageUrls List of all URLs for which processing was attempted (for stats).
 * @param processedRootUrls List of successfully processed root URLs (for stats).
 * @returns A Promise that resolves to an object containing the database sessionId and the initial ProcessingState.
 */
export async function initializeContentProcessing(
  config: CrawlConfig,
  processedPageUrls: string[],
  processedRootUrls: string[]
): Promise<{ sessionId: string; processingState: ProcessingState; sessionInstance: CrawlSessionData }> {
  clearGlobalEmbeddingState(); 
  const { sessionId, sessionInstance } = await _initializeSession(config, processedPageUrls, processedRootUrls);
  const processingState = _initializeProcessingState();
  console.log(`[ProcessContent] Content processing initialized. Session ID: ${sessionId}`);
  return { sessionId, processingState, sessionInstance }; // sessionInstance is now the in-memory CrawlSessionData
}

/**
 * Processes and generates embeddings for LLM segmented chunks from a single page.
 * This function updates the provided ProcessingState.
 * @param chunksForPage Array of LLM segmented chunks for a single page.
 * @param config The crawl configuration.
 * @param sessionId The database session ID for this processing run.
 * @param state The current ProcessingState object, which will be mutated.
 */
export async function processAndEmbedChunksPerPage(
  chunksForPage: LLMSegmentedChunk[],
  config: CrawlConfig,
  _sessionId: string, // sessionId is mainly for final DB persistence, not directly used per page here yet
  state: ProcessingState
): Promise<void> {
  if (chunksForPage.length === 0) {
    console.log('[ProcessContentPerPage] No chunks provided for this page. Skipping.');
    return;
  }
  const sourceUrlForPage = chunksForPage[0]?.sourceUrl || 'unknown_page';
  console.log(`[ProcessContentPerPage] Processing ${chunksForPage.length} chunks for page: ${sourceUrlForPage}`);

  // Keep track of documents added in this specific call to save them incrementally
  const initialDocCount = state.documentsToProcess.length;

  _prepareInitialDocumentsFromChunks(chunksForPage, config, state);
  
  const newDocumentsAdded = state.documentsToProcess.slice(initialDocCount);

  await _generateEmbeddingsForDocuments(state); // This will attempt to embed for all in state that need it.
                                            // The newDocumentsAdded are now part of state.documentsToProcess.

  // Save artifacts only for the documents processed in this call that now have embeddings
  const successfullyEmbeddedNewDocs = newDocumentsAdded.filter(doc => doc.embedding && doc.embedding.length > 0);
  if (successfullyEmbeddedNewDocs.length > 0) {
    _savePageDocumentJsonArtifacts(successfullyEmbeddedNewDocs);
  } else {
    console.log(`[ProcessContentPerPage] No new documents from ${sourceUrlForPage} were successfully embedded in this pass.`);
  }

  console.log(`[ProcessContentPerPage] Finished processing and embedding for page: ${sourceUrlForPage}. Current total docs in state: ${state.documentsToProcess.length}`);
}

// Export the clear function for external cleanup if needed
export { clearGlobalEmbeddingState };