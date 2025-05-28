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
    // console.log(`[LoggerSavers] Attempting to save raw HTML for ${url} to ${filePath}`);
    if (!htmlContent || htmlContent.trim() === '') {
        console.warn(`[LoggerSavers] Attempting to save empty raw HTML for ${url}. File not saved.`);
        // fs.writeFileSync(filePath, "<!-- Empty content from source -->"); // Optionally save a placeholder
        return;
    }
    try {
        fs.writeFileSync(filePath, htmlContent);
        // console.log(`[LoggerSavers] Successfully saved raw HTML for ${url} to ${filePath}`);
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

export function saveUrlEmbedding(url: string, embeddingId: string, embeddingData: any): void {
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const docsEmbedsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    try {
        fs.writeFileSync(path.join(docsEmbedsPath, `embedding_${getUrlIdentifier(embeddingId)}.json`), JSON.stringify(embeddingData, null, 2));
    } catch (error) {
        console.error(`Failed to save URL embedding ${embeddingId} for ${url}: ${error}`);
    }
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
    
    // Custom replacer function for JSON.stringify
    const replacer = (key: string, value: any) => {
      if (value instanceof Error) {
        // Serialize error properties explicitly, as JSON.stringify by default converts Error to {}
        const error: { [key: string]: any } = {};
        Object.getOwnPropertyNames(value).forEach(propName => {
          error[propName] = (value as any)[propName];
        });
        return error;
      }
      if (typeof value === 'bigint') {
        return value.toString(); // Convert BigInt to string
      }
      // Add handling for other non-serializable types if necessary
      return value;
    };

    try {
      const jsonString = JSON.stringify(summaryData, replacer, 2);
      fs.writeFileSync(summaryFilePath, jsonString);
      console.log(`\nDetailed summary written to: ${summaryFilePath}`);
    } catch (error) {
      console.error(`Failed to write summary.json: ${error}`);
      // As a fallback, try to stringify with a very basic approach if the replacer itself causes issues or if data is too complex
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

// New function to save all chunks for a URL to a single JSON file
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

// New function to save LLM interactions
export async function saveLlmInteraction(url: string, interactionId: string, prompt: any, response: any): Promise<void> {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveLlmInteraction.');
        return;
    }
    const domain = _getDomainFromUrl(url);
    const urlPath = _getUrlPath(domain, url);
    const llmInteractionPath = _getArtifactPath(urlPath, DIR_LLM_INTERACTIONS);
    const sanitizedInteractionId = getUrlIdentifier(interactionId, 100); // Sanitize interactionId as well
    const filePath = path.join(llmInteractionPath, `${sanitizedInteractionId}.json`);
    try {
        const interactionData = { prompt, response };
        await fs.promises.writeFile(filePath, JSON.stringify(interactionData, null, 2));
    } catch (error) {
        console.error(`Failed to save LLM interaction ${interactionId} for ${url} to ${filePath}: ${error}`);
    }
} 