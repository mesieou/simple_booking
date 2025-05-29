import { PROCESS_CONTENT_CONFIG } from '@/lib/config/config';

// Directory names for structured output
export const DIR_LOGS = 'logs';
export const DIR_DOMAINS = 'domains';
export const DIR_PDFS = 'pdfs';
export const DIR_RAW_CONTENT = '00_raw_content';
export const DIR_CLEANED_TEXT = '01_cleaned_text';
export const DIR_CHUNKS = '02_chunks';
export const DIR_PAGES = '01_pages'; // For PDFs
export const DIR_CHUNKS_BY_PAGE = '02_chunks_by_page'; // For PDFs
export const DIR_CATEGORIZATION = '03_categorization';
export const DIR_RECATEGORIZATION = '04_recategorization';
export const DIR_DOCUMENTS_EMBEDDINGS = '05_documents_embeddings';

// File names for artifacts
export const FILE_SOURCE_HTML = 'source.html';
export const FILE_CLEANED_TEXT = 'cleaned.txt';
export const FILE_FULL_TEXT_PDF = 'full_text.txt';
export const FILE_INITIAL_CATEGORIES = 'initial_categories.json';
export const FILE_RECATEGORIZATION_OUTPUT = 'recategorization_output.json';
export const FILE_MANIFEST = 'manifest.json';
export const FILE_SUMMARY_JSON = 'summary.json';
export const FILE_CONSOLE_FULL_LOG = 'console_full.log';

// Removed unused log item interfaces (UrlLog, ChunkLog, CategoryLog, DocumentLog, EmbeddingLog)
// Removed unused LOGGER_PROGRESS_UPDATE_INTERVAL constant 