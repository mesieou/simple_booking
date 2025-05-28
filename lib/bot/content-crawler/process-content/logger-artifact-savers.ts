import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
    DIR_LOGS, DIR_DOMAINS, DIR_PDFS, DIR_RAW_CONTENT, DIR_CLEANED_TEXT, DIR_CHUNKS,
    DIR_PAGES, DIR_CHUNKS_BY_PAGE, DIR_CATEGORIZATION, DIR_RECATEGORIZATION, DIR_DOCUMENTS_EMBEDDINGS,
    FILE_SOURCE_HTML, FILE_CLEANED_TEXT, FILE_FULL_TEXT_PDF, FILE_INITIAL_CATEGORIES,
    FILE_RECATEGORIZATION_OUTPUT, FILE_MANIFEST, FILE_SUMMARY_JSON
} from './logger-constants';

// New constant for LLM interactions
export const DIR_LLM_INTERACTIONS = 'llm_interactions';
// New constant for Markdown Pre-Chunks
export const DIR_MARKDOWN_PRE_CHUNKS = '01a_markdown_pre_chunks';

// --- Path Helper & File System Methods ---

// Exporting _sanitizeName as getUrlIdentifier
export function getUrlIdentifier(name: string, maxLength: number = 200): string {
    let sanitized = name.replace(/^https?:\/\//, '');
    sanitized = sanitized.replace(/\//g, '_');
    sanitized = sanitized.replace(/[^\w.\-_]/g, '_');
    sanitized = sanitized.replace(/__+/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');

    if (sanitized.length > maxLength) {
        const hash = createHash('md5').update(name).digest('hex').substring(0, 8);
        sanitized = `${sanitized.substring(0, maxLength - hash.length - 1)}_${hash}`;
    }
    return sanitized || 'default';
}

function _ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function _getDomainFromUrl(url: string): string {
    if (typeof url !== 'string' || !url) { 
        console.warn('[_getDomainFromUrl] Received invalid URL input:', url);
        return 'unknown_domain'; 
    }
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        // Try a regex for common cases if new URL fails (e.g. for base URLs without scheme)
        const Rcom = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\.\s]+)/);
        if (Rcom && Rcom[1]) return Rcom[1];      
        console.warn(`[_getDomainFromUrl] Could not parse domain from URL: ${url}. Falling back to 'unknown_domain'.`);
        return 'unknown_domain';
    }
}

// Base path for all logs, to be initialized by the main logger class
let logsRootPathInternal: string = '';

export function initializeArtifactSavers(logsRoot: string) {
    logsRootPathInternal = logsRoot;
}

function _getDomainPath(domain: string): string {
    const sanitizedDomain = getUrlIdentifier(domain);
    const domainPath = path.join(logsRootPathInternal, DIR_DOMAINS, sanitizedDomain);
    _ensureDirExists(domainPath);
    return domainPath;
}

function _getUrlPath(domain: string, url: string): string {
    const domainPath = _getDomainPath(domain);
    let urlPart = 'root'; 
    try {
        const parsedUrl = new URL(url);
        const pathAndQuery = parsedUrl.pathname + parsedUrl.search;
        if (pathAndQuery && pathAndQuery !== '/') {
            urlPart = pathAndQuery;
        }
        if (urlPart === '/' || urlPart === '') urlPart = 'root';

    } catch (e) {
        if (typeof url === 'string' && domain && url.includes(domain)) {
            const afterDomain = url.substring(url.indexOf(domain) + domain.length);
            urlPart = afterDomain.startsWith('/') ? afterDomain : ('/' + afterDomain); // Ensure leading slash for path part
        } else {
            urlPart = 'unknown_url_path';
        }
        if (!urlPart || urlPart === '/') urlPart = 'root';
    }

    const urlIdentifier = getUrlIdentifier(urlPart); // Use the exported getUrlIdentifier (formerly _sanitizeName)
    const urlPath = path.join(domainPath, urlIdentifier);
    _ensureDirExists(urlPath);
    return urlPath;
}
  
function _getPdfPath(pdfName: string): string {
    const sanitizedPdfName = getUrlIdentifier(pdfName.replace(/\.pdf$/i, ''));
    const pdfPath = path.join(logsRootPathInternal, DIR_PDFS, sanitizedPdfName);
    _ensureDirExists(pdfPath);
    return pdfPath;
}

function _getArtifactPath(baseItemPath: string, artifactDirName: string): string {
    const artifactPath = path.join(baseItemPath, artifactDirName);
    _ensureDirExists(artifactPath);
    return artifactPath;
}

// --- Artifact Saving Methods ---

export function saveRawHtml(url: string, htmlContent: string): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const rawContentPath = _getArtifactPath(urlPath, DIR_RAW_CONTENT);
    const filePath = path.join(rawContentPath, FILE_SOURCE_HTML);
    if (!htmlContent || htmlContent.trim() === '') {
        console.warn(`[LoggerSavers] Attempting to save empty raw HTML for ${url}. File not saved.`);
        return;
    }
    try {
        fs.writeFileSync(filePath, htmlContent);
    } catch (error) {
        console.error(`[LoggerSavers] Critical error saving raw HTML for ${url} to ${filePath}:`, error);
    }
}

export function saveCleanedTextForUrl(url: string, textContent: string): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const cleanedTextPath = _getArtifactPath(urlPath, DIR_CLEANED_TEXT);
    const filePath = path.join(cleanedTextPath, FILE_CLEANED_TEXT);
    try {
        fs.writeFileSync(filePath, textContent);
    } catch (error) {
        console.error(`Failed to save cleaned text for ${url} to ${filePath}: ${error}`);
    }
}

export function saveUrlChunk(url: string, chunkIndex: number, chunkContent: string): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const chunksPath = _getArtifactPath(urlPath, DIR_CHUNKS);
    try {
        fs.writeFileSync(path.join(chunksPath, `chunk_${chunkIndex}.txt`), chunkContent);
    } catch (error) {
        console.error(`Failed to save URL chunk ${chunkIndex} for ${url}: ${error}`);
    }
}
  
export function saveUrlCategorizationPrompt(url: string, chunkIndex: number, prompt: string): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const categorizationPath = _getArtifactPath(urlPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, `chunk_${chunkIndex}_prompt.txt`), prompt);
    } catch (error) {
        console.error(`Failed to save URL cat prompt for chunk ${chunkIndex}, ${url}: ${error}`);
    }
}

export function saveUrlCategorizationResponse(url: string, chunkIndex: number, response: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const categorizationPath = _getArtifactPath(urlPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, `chunk_${chunkIndex}_response.json`), JSON.stringify(response, null, 2));
    } catch (error) {
        console.error(`Failed to save URL cat response for chunk ${chunkIndex}, ${url}: ${error}`);
    }
}

export function saveUrlInitialCategories(url: string, categories: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url); 
    const categorizationPath = _getArtifactPath(urlPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, FILE_INITIAL_CATEGORIES), JSON.stringify(categories, null, 2));
    } catch (error) {
        console.error(`Failed to save URL initial categories for ${url}: ${error}`);
    }
}

export function saveUrlRecategorizationOutput(url: string, output: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const recategorizationPath = _getArtifactPath(urlPath, DIR_RECATEGORIZATION);
    try {
        fs.writeFileSync(path.join(recategorizationPath, FILE_RECATEGORIZATION_OUTPUT), JSON.stringify(output, null, 2));
    } catch (error) {
        console.error(`Failed to save URL recat output for ${url}: ${error}`);
    }
}

export function saveUrlDocument(url: string, docId: string, documentData: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const docsEmbedsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    try {
        fs.writeFileSync(path.join(docsEmbedsPath, `doc_${getUrlIdentifier(docId)}.json`), JSON.stringify(documentData, null, 2));
    } catch (error) {
        console.error(`Failed to save URL document ${docId} for ${url}: ${error}`);
    }
}

/**
 * DEPRECATED: Embeddings for URLs should now be saved as part of the documentData 
 * in `saveUrlDocument` (i.e., within the doc_{id}.json file).
 * This function will no longer write a separate embedding file.
 * The calling code should add the embedding vector to the documentData object 
 * and stop calling this function.
 */
export function saveUrlEmbedding(url: string, embeddingId: string, embeddingData: any): void {
    console.warn(`[LoggerSavers] DEPRECATION WARNING: saveUrlEmbedding for URL ${url} (embeddingId: ${embeddingId}) is deprecated.`);
    console.warn(`[LoggerSavers] The embedding should be included directly in the documentData object passed to saveUrlDocument.`);
    console.warn(`[LoggerSavers] No separate embedding_{id}.json file will be created by this function anymore.`);
    // Original functionality (now removed):
    // const domain = _getDomainFromUrl(url);
    // const urlPath = _getUrlPath(domain, url);
    // const docsEmbedsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    // try {
    //     fs.writeFileSync(path.join(docsEmbedsPath, `embedding_${getUrlIdentifier(embeddingId)}.json`), JSON.stringify(embeddingData, null, 2));
    // } catch (error) {
    //     console.error(`Failed to save URL embedding ${embeddingId} for ${url}: ${error}`);
    // }
}
  
export function saveUrlManifest(url: string, manifestData: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url); 
    try {
        fs.writeFileSync(path.join(urlPath, FILE_MANIFEST), JSON.stringify(manifestData, null, 2));
    } catch (error) {
        console.error(`Failed to save URL manifest for ${url}: ${error}`);
    }
}

export function savePdfRawText(pdfName: string, textContent: string): void {
    const pdfPath = _getPdfPath(pdfName);
    const rawContentPath = _getArtifactPath(pdfPath, DIR_RAW_CONTENT);
    try {
        fs.writeFileSync(path.join(rawContentPath, FILE_FULL_TEXT_PDF), textContent);
    } catch (error) {
        console.error(`Failed to save raw text for PDF ${pdfName}: ${error}`);
    }
}

export function savePdfPageText(pdfName: string, pageNumber: number, textContent: string): void {
    const pdfPath = _getPdfPath(pdfName);
    const pagesPath = _getArtifactPath(pdfPath, DIR_PAGES);
    try {
        fs.writeFileSync(path.join(pagesPath, `page_${pageNumber}.txt`), textContent);
    } catch (error) {
        console.error(`Failed to save page ${pageNumber} text for PDF ${pdfName}: ${error}`);
    }
}
  
export function savePdfPageChunk(pdfName: string, pageNumber: number, chunkIndex: number, chunkContent: string): void {
    const pdfPath = _getPdfPath(pdfName);
    const chunksByPagePath = _getArtifactPath(pdfPath, DIR_CHUNKS_BY_PAGE);
    const pageSpecificChunkPath = path.join(chunksByPagePath, `page_${pageNumber}`);
    _ensureDirExists(pageSpecificChunkPath);
    try {
        fs.writeFileSync(path.join(pageSpecificChunkPath, `chunk_${chunkIndex}.txt`), chunkContent);
    } catch (error) {
        console.error(`Failed to save chunk ${chunkIndex} for page ${pageNumber}, PDF ${pdfName}: ${error}`);
    }
}

export function savePdfCategorizationPrompt(pdfName: string, identifier: string, prompt: string): void { 
    const pdfPath = _getPdfPath(pdfName);
    const categorizationPath = _getArtifactPath(pdfPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, `${identifier}_prompt.txt`), prompt);
    } catch (error) {
        console.error(`Failed to save PDF cat prompt for ${identifier}, PDF ${pdfName}: ${error}`);
    }
}

export function savePdfCategorizationResponse(pdfName: string, identifier: string, response: any): void {
    const pdfPath = _getPdfPath(pdfName);
    const categorizationPath = _getArtifactPath(pdfPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, `${identifier}_response.json`), JSON.stringify(response, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF cat response for ${identifier}, PDF ${pdfName}: ${error}`);
    }
}

export function savePdfInitialCategories(pdfName: string, categories: any): void {
    const pdfPath = _getPdfPath(pdfName);
    const categorizationPath = _getArtifactPath(pdfPath, DIR_CATEGORIZATION);
    try {
        fs.writeFileSync(path.join(categorizationPath, FILE_INITIAL_CATEGORIES), JSON.stringify(categories, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF initial categories for ${pdfName}: ${error}`);
    }
}

export function savePdfRecategorizationOutput(pdfName: string, output: any): void {
    const pdfPath = _getPdfPath(pdfName);
    const recategorizationPath = _getArtifactPath(pdfPath, DIR_RECATEGORIZATION);
    try {
        fs.writeFileSync(path.join(recategorizationPath, FILE_RECATEGORIZATION_OUTPUT), JSON.stringify(output, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF recat output for ${pdfName}: ${error}`);
    }
}

export function savePdfDocument(pdfName: string, docId: string, documentData: any): void {
    const pdfPath = _getPdfPath(pdfName);
    const docsEmbedsPath = _getArtifactPath(pdfPath, DIR_DOCUMENTS_EMBEDDINGS);
    try {
        fs.writeFileSync(path.join(docsEmbedsPath, `doc_${getUrlIdentifier(docId)}.json`), JSON.stringify(documentData, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF document ${docId} for ${pdfName}: ${error}`);
    }
}
  
export function savePdfEmbedding(pdfName: string, embeddingId: string, embeddingData: any): void {
    const pdfPath = _getPdfPath(pdfName);
    const docsEmbedsPath = _getArtifactPath(pdfPath, DIR_DOCUMENTS_EMBEDDINGS);
    try {
        fs.writeFileSync(path.join(docsEmbedsPath, `embedding_${getUrlIdentifier(embeddingId)}.json`), JSON.stringify(embeddingData, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF embedding ${embeddingId} for ${pdfName}: ${error}`);
    }
}

export function savePdfManifest(pdfName: string, manifestData: any): void {
    const pdfPath = _getPdfPath(pdfName);
    // The manifest should be at the root of the specific PDF's log directory.
    try {
        fs.writeFileSync(path.join(pdfPath, FILE_MANIFEST), JSON.stringify(manifestData, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF manifest for ${pdfName}: ${error}`);
    }
}

export function saveSummaryJson(baseOutputPath: string, summaryData: any): void {
    const summaryFilePath = path.join(baseOutputPath, FILE_SUMMARY_JSON);
    
    const replacer = (key: string, value: any) => {
      if (value instanceof Error) {
        const error: { [key: string]: any } = {};
        Object.getOwnPropertyNames(value).forEach(propName => {
          error[propName] = (value as any)[propName];
        });
        return error;
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };

    try {
      const jsonString = JSON.stringify(summaryData, replacer, 2);
      fs.writeFileSync(summaryFilePath, jsonString);
      console.log(`\nDetailed summary written to: ${summaryFilePath}`);
    } catch (error) {
      console.error(`Failed to write summary.json: ${error}`);
      try {
        console.log('[Fallback] Attempting to write summary.json with minimal serialization...');
        const minimalSummary = {
          errorDuringSerialization: true,
          message: 'Original summaryData could not be fully serialized. This is a partial log.',
          processingStatsKeys: summaryData.processingStats ? Object.keys(summaryData.processingStats) : [],
          durationSeconds: summaryData.durationSeconds,
          allFoundUrlsCount: summaryData.allFoundUrls ? summaryData.allFoundUrls.length : 0,
          urlLogsCount: summaryData.urlLogs ? summaryData.urlLogs.length : 0,
        };
        fs.writeFileSync(summaryFilePath, JSON.stringify(minimalSummary, null, 2));
        console.log(`[Fallback] Minimal summary written to: ${summaryFilePath}`);
      } catch (fallbackError) {
        console.error(`Failed to write even a minimal fallback summary.json: ${fallbackError}`);
      }
    }
}

export async function saveUrlChunks(url: string, chunks: Array<{ id: string, text: string, [key: string]: any }>): Promise<void> {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveUrlChunks.');
        return;
    }
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const chunksDirPath = _getArtifactPath(urlPath, DIR_CHUNKS);
    const filePath = path.join(chunksDirPath, 'chunks.json');
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(chunks, null, 2));
    } catch (error) {
        console.error(`Failed to save URL chunks for ${url} to ${filePath}: ${error}`);
    }
}

export async function saveLlmInteraction(url: string, interactionId: string, prompt: any, response: any): Promise<void> {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveLlmInteraction.');
        return;
    }

    // If interactionId contains a special marker, skip file saving as it's handled in a summary artifact
    if (interactionId.includes('_embed_data_for_summary_')) {
        console.log(`[LoggerSavers] Skipping individual file save for LLM interaction '${interactionId}' as data is part of a summary artifact.`);
        return;
    }

    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const docsEmbeddingsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    const sanitizedInteractionId = getUrlIdentifier(interactionId, 100);
    
    const promptFilePath = path.join(docsEmbeddingsPath, `${sanitizedInteractionId}_prompt.json`);
    const responseFilePath = path.join(docsEmbeddingsPath, `${sanitizedInteractionId}_response.json`);

    try {
        await fs.promises.writeFile(promptFilePath, JSON.stringify(prompt, null, 2));
    } catch (error) {
        console.error(`Failed to save LLM prompt for interaction ${interactionId} for ${url} to ${promptFilePath}: ${error}`);
    }

    try {
        await fs.promises.writeFile(responseFilePath, JSON.stringify(response, null, 2));
    } catch (error) {
        console.error(`Failed to save LLM response for interaction ${interactionId} for ${url} to ${responseFilePath}: ${error}`);
    }
}

export async function savePageMainPrompt(url: string, promptDetails: any): Promise<void> {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping savePageMainPrompt.');
        return;
    }
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const categorizationArtifactPath = _getArtifactPath(urlPath, DIR_CATEGORIZATION);
    const filePath = path.join(categorizationArtifactPath, 'page_categorization_prompt.json');
    try {
        const jsonToSave = JSON.stringify(promptDetails, null, 2);
        await fs.promises.writeFile(filePath, jsonToSave);
    } catch (error) {
        console.error(`Failed to save page main prompt for ${url} to ${filePath}: ${error}`);
    }
}

export async function savePageMainResponse(url: string, responseContent: any): Promise<void> {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping savePageMainResponse.');
        return;
    }
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const categorizationArtifactPath = _getArtifactPath(urlPath, DIR_CATEGORIZATION);
    const filePath = path.join(categorizationArtifactPath, 'page_categorization_response.json');
    let contentToSave: string;
    if (typeof responseContent === 'string') {
        try {
            const parsed = JSON.parse(responseContent);
            contentToSave = JSON.stringify(parsed, null, 2);
        } catch (e) {
            contentToSave = responseContent;
        }
    } else {
        contentToSave = JSON.stringify(responseContent, null, 2);
    }
    try {
        await fs.promises.writeFile(filePath, contentToSave);
    } catch (error) {
        console.error(`Failed to save page main response for ${url} to ${filePath}: ${error}`);
    }
}

export function saveMarkdownPreChunk(
    originalUrl: string,
    preChunkIndex: number,
    content: string
): string | undefined {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveMarkdownPreChunk.');
        return undefined;
    }
    const domain = _getDomainFromUrl(originalUrl);
    const urlPath = _getUrlPath(domain, originalUrl);
    const preChunksArtifactPath = _getArtifactPath(urlPath, DIR_MARKDOWN_PRE_CHUNKS);
    
    const fileName = `pre_chunk_${preChunkIndex}.txt`;
    const filePath = path.join(preChunksArtifactPath, fileName);

    try {
        fs.writeFileSync(filePath, content);
        return filePath;
    } catch (error) {
        console.error(`[LoggerSavers] Failed to save markdown pre-chunk ${preChunkIndex} for ${originalUrl} to ${filePath}:`, error);
        return undefined;
    }
}

export function saveMarkdownPreChunkManifest(
    originalUrl: string,
    manifestData: any
): void {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveMarkdownPreChunkManifest.');
        return;
    }
    const domain = _getDomainFromUrl(originalUrl);
    const urlPath = _getUrlPath(domain, originalUrl);
    const preChunksArtifactPath = _getArtifactPath(urlPath, DIR_MARKDOWN_PRE_CHUNKS);

    const manifestFilePath = path.join(preChunksArtifactPath, 'pre_chunks_manifest.json');

    try {
        fs.writeFileSync(manifestFilePath, JSON.stringify(manifestData, null, 2));
    } catch (error) {
        console.error(`[LoggerSavers] Failed to save markdown pre-chunk manifest for ${originalUrl} to ${manifestFilePath}:`, error);
    }
}

// --- New function for saving consolidated page embeddings artifact for URLs ---
export function saveUrlPageEmbeddingsArtifact(sourceUrl: string, pageEmbeddingsData: any): void {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveUrlPageEmbeddingsArtifact.');
        return;
    }
    const domain = _getDomainFromUrl(sourceUrl);
    const urlPath = _getUrlPath(domain, sourceUrl); // This is the base path for the URL's artifacts
    const docsEmbedsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    
    // Using a fixed name for the summary file, or derive from sourceUrl if more specificity is needed later
    const summaryFileName = '_page_embeddings_summary.json'; 
    const filePath = path.join(docsEmbedsPath, summaryFileName);

    try {
        fs.writeFileSync(filePath, JSON.stringify(pageEmbeddingsData, null, 2));
        console.log(`[LoggerSavers] Successfully saved consolidated page embeddings for ${sourceUrl} to ${filePath}`);
    } catch (error) {
        console.error(`[LoggerSavers] Failed to save consolidated page embeddings for ${sourceUrl} to ${filePath}:`, error);
    }
} 