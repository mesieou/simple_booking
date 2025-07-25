import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import {
    DIR_LOGS, DIR_DOMAINS, DIR_PDFS, DIR_RAW_CONTENT, DIR_CLEANED_TEXT, DIR_CHUNKS,
    DIR_PAGES, DIR_CHUNKS_BY_PAGE, DIR_CATEGORIZATION, DIR_RECATEGORIZATION, DIR_DOCUMENTS_EMBEDDINGS,
    FILE_SOURCE_HTML, FILE_CLEANED_TEXT, FILE_FULL_TEXT_PDF, FILE_INITIAL_CATEGORIES,
    FILE_RECATEGORIZATION_OUTPUT, FILE_MANIFEST, FILE_SUMMARY_JSON
} from './logger-constants';

export const DIR_MARKDOWN_PRE_CHUNKS = '01a_markdown_pre_chunks';

export function getUrlIdentifier(name: string, maxLength: number = 200): string {
    // For PDF pages, combine PDF name and page number
    if (name.includes('#page=')) {
        const pdfMatch = name.match(/^pdf-([^#]+)#page=(\d+)/);
        if (pdfMatch && pdfMatch[1] && pdfMatch[2]) {
            const baseName = pdfMatch[1].replace(/\.pdf$/i, '');
            return `pdf-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-page-${pdfMatch[2]}`;
        }
    }
    
    // For PDF files, extract just the base name without extension
    if (name.startsWith('pdf-')) {
        const pdfMatch = name.match(/^pdf-([^#]+)/);
        if (pdfMatch && pdfMatch[1]) {
            const baseName = pdfMatch[1].replace(/\.pdf$/i, '');
            return `pdf-${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        }
    }

    // For regular URLs, create a simple hash-based name
    const hash = createHash('md5').update(name).digest('hex').substring(0, 12);
    return `url-${hash}`;
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
    // If it's a PDF URL, extract the base PDF name as the "domain" for grouping
    if (url.startsWith('pdf-')) {
        const match = url.match(/^pdf-([^#]+)/);
        return match ? getUrlIdentifier(match[1].replace(/\.pdf$/i, '')) : 'unknown_pdf_document';
    }
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        const Rcom = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\.\s]+)/);
        if (Rcom && Rcom[1]) return Rcom[1];      
        console.warn(`[_getDomainFromUrl] Could not parse domain from URL: ${url}. Falling back to 'unknown_domain'.`);
        return 'unknown_domain';
    }
}

let logsRootPathInternal: string = '';

export function initializeArtifactSavers(logsRoot: string) {
    logsRootPathInternal = logsRoot;
}

function _getDomainPath(domainOrPdfName: string, isPdf: boolean = false): string {
    const sanitizedName = getUrlIdentifier(domainOrPdfName);
    const baseDir = isPdf ? DIR_PDFS : DIR_DOMAINS;
    const itemPath = path.join(logsRootPathInternal, baseDir, sanitizedName);
    _ensureDirExists(itemPath);
    return itemPath;
}

// New helper for PDF page paths
function _getPdfPagePath(pdfName: string, pageNumber: number): string {
    const sanitizedPdfName = getUrlIdentifier(pdfName.replace(/\.pdf$/i, ''));
    const pdfBasePath = path.join(logsRootPathInternal, DIR_PDFS, sanitizedPdfName);
    _ensureDirExists(pdfBasePath);
    const pageSpecificPath = path.join(pdfBasePath, `page_${pageNumber}`);
    _ensureDirExists(pageSpecificPath);
    return pageSpecificPath;
}

function _getUrlPath(domainInput: string, url: string): string {
    // Check if it's a PDF page URL
    if (url.startsWith('pdf-') && url.includes('#page=')) {
        const pdfNameMatch = url.match(/^pdf-([^#]+)#page=(\d+)/);
        if (pdfNameMatch && pdfNameMatch[1] && pdfNameMatch[2]) {
            const pdfName = pdfNameMatch[1];
            const pageNumber = parseInt(pdfNameMatch[2], 10);
            // The 'domainInput' for PDF urls will be the pdfName itself (without .pdf extension)
            // from the modified _getDomainFromUrl
            return _getPdfPagePath(domainInput, pageNumber);
        }
    }

    // Existing logic for website URLs
    const domainPath = _getDomainPath(domainInput, false); // false indicates it's a domain, not a PDF name
    let urlPart = 'root'; 
    try {
        const parsedUrl = new URL(url);
        const pathAndQuery = parsedUrl.pathname + parsedUrl.search;
        if (pathAndQuery && pathAndQuery !== '/') {
            urlPart = pathAndQuery;
        }
        if (urlPart === '/' || urlPart === '') urlPart = 'root';
    } catch (e) {
        if (typeof url === 'string' && domainInput && url.includes(domainInput)) {
            const afterDomain = url.substring(url.indexOf(domainInput) + domainInput.length);
            urlPart = afterDomain.startsWith('/') ? afterDomain : ('/' + afterDomain);
        } else {
            urlPart = 'unknown_url_path';
        }
        if (!urlPart || urlPart === '/') urlPart = 'root';
    }
    const urlIdentifier = getUrlIdentifier(urlPart);
    const urlPath = path.join(domainPath, urlIdentifier);
    _ensureDirExists(urlPath);
    return urlPath;
}
  
function _getPdfPath(pdfName: string): string { // This function seems to return the base path for a PDF, not a page.
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
    console.warn(`[LoggerSavers] DEPRECATION WARNING: saveUrlEmbedding for URL ${url} (embeddingId: ${embeddingId}) is deprecated.`);
    console.warn(`[LoggerSavers] The embedding should be included directly in the documentData object passed to saveUrlDocument.`);
    console.warn(`[LoggerSavers] No separate embedding_{id}.json file will be created by this function anymore.`);
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
    // pdfName here is the base filename e.g. "mydoc.pdf"
    const pagePath = _getPdfPagePath(pdfName.replace(/\.pdf$/i, ''), pageNumber); // Use the new helper
    const cleanedTextPath = _getArtifactPath(pagePath, DIR_CLEANED_TEXT); // Use DIR_CLEANED_TEXT
    const filePath = path.join(cleanedTextPath, FILE_CLEANED_TEXT); // Use FILE_CLEANED_TEXT
    try {
        fs.writeFileSync(filePath, textContent);
    } catch (error) {
        console.error(`Failed to save page ${pageNumber} text for PDF ${pdfName}: ${error}`);
    }
}
  
export function savePdfPageChunk(pdfName: string, pageNumber: number, chunkIndex: number, chunkContent: string): void {
    const pagePath = _getPdfPagePath(pdfName.replace(/\.pdf$/i, ''), pageNumber);
    // Example: DIR_CHUNKS for consistency with website structure, or a new constant if preferred
    const chunksPath = _getArtifactPath(pagePath, DIR_CHUNKS); 
    try {
        fs.writeFileSync(path.join(chunksPath, `chunk_${chunkIndex}.txt`), chunkContent);
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
    console.warn(`[LoggerSavers] DEPRECATION WARNING: savePdfEmbedding for PDF ${pdfName} (embeddingId: ${embeddingId}) is deprecated.`);
    console.warn(`[LoggerSavers] The embedding should be included directly in the documentData object passed to savePdfDocument.`);
    console.warn(`[LoggerSavers] No separate embedding_{id}.json file will be created by this function anymore.`);
}

export function savePdfManifest(pdfName: string, manifestData: any): void {
    const pdfPath = _getPdfPath(pdfName);
    try {
        fs.writeFileSync(path.join(pdfPath, FILE_MANIFEST), JSON.stringify(manifestData, null, 2));
    } catch (error) {
        console.error(`Failed to save PDF manifest for ${pdfName}: ${error}`);
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
        // Build a clean, readable artifact
        const artifact = {
            websiteUrl: url,
            businessId: promptDetails.businessId,
            contentHash: promptDetails.contentHash || promptDetails.targetContentHash,
            llmPrompt: promptDetails.llmPrompt || promptDetails.fullPrompt,
            contentText: promptDetails.contentText || (promptDetails.fullPrompt ? extractContentTextFromPrompt(promptDetails.fullPrompt) : undefined)
        };
        await fs.promises.writeFile(filePath, JSON.stringify(artifact, null, 2));
    } catch (error) {
        console.error(`Failed to save page main prompt for ${url} to ${filePath}: ${error}`);
    }
}

// Helper to extract the content text from the prompt if needed (fallback)
function extractContentTextFromPrompt(prompt: string): string | undefined {
    const marker = 'Here is the content to analyze:';
    const idx = prompt.indexOf(marker);
    if (idx !== -1) {
        // Extract everything after the marker, up to the next example or end
        const after = prompt.substring(idx + marker.length).trim();
        const exampleIdx = after.indexOf('Example response format:');
        return exampleIdx !== -1 ? after.substring(0, exampleIdx).trim() : after;
    }
    return undefined;
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

export function saveUrlPageEmbeddingsArtifact(sourceUrl: string, pageEmbeddingsData: any): void {
    if (!logsRootPathInternal) {
        console.warn('[LoggerSavers] Logs root path not initialized. Skipping saveUrlPageEmbeddingsArtifact.');
        return;
    }
    const domain = _getDomainFromUrl(sourceUrl);
    const urlPath = _getUrlPath(domain, sourceUrl);
    const docsEmbedsPath = _getArtifactPath(urlPath, DIR_DOCUMENTS_EMBEDDINGS);
    const summaryFileName = '_page_embeddings_summary.json'; 
    const filePath = path.join(docsEmbedsPath, summaryFileName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(pageEmbeddingsData, null, 2));
        console.log(`[LoggerSavers] Successfully saved consolidated page embeddings for ${sourceUrl} to ${filePath}`);
    } catch (error) {
        console.error(`[LoggerSavers] Failed to save consolidated page embeddings for ${sourceUrl} to ${filePath}:`, error);
    }
} 