import { CrawlSession } from '@/lib/database/models/crawl-session';

// HTTP Request Configuration
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

// Embedding Configuration
export const EMBEDDING_CONFIG = {
  BATCH_SIZE: 16,
  MAX_RETRIES: 10,
  INITIAL_RETRY_DELAY: 2000,
  SUPABASE_BATCH_SIZE: 50,
  SUPABASE_DELAY: 100,
  FETCH_TIMEOUT: 30000,
  // Circuit breaker configuration for embedding processing
  MAX_ATTEMPTS: 1000, // Maximum embedding attempts per session
  MAX_FAILURE_RATE: 0.5, // Maximum failure rate (50%)
  MIN_ATTEMPTS_FOR_FAILURE_CHECK: 10, // Minimum attempts before checking failure rate
};

export enum Category {
  SERVICES_OFFERED = 0,
  PRICING_QUOTES = 1,
  CONTACT = 2,
  BOOKING_SCHEDULING = 3,
  ABOUT_TRUST_BUILDING = 4,
  FAQ = 5,
  TERMS_CONDITIONS = 6,
  GENERAL_INFORMATION = 7,
  UNCATEGORIZED = 8
}

// Map enum to display strings
export const CATEGORY_DISPLAY_NAMES: Record<Category, string> = {
  [Category.SERVICES_OFFERED]: 'services offered',
  [Category.PRICING_QUOTES]: 'pricing or quotes',
  [Category.CONTACT]: 'contact',
  [Category.BOOKING_SCHEDULING]: 'booking or scheduling',
  [Category.ABOUT_TRUST_BUILDING]: 'about / trust-building',
  [Category.FAQ]: 'faq',
  [Category.TERMS_CONDITIONS]: 'terms & conditions / legal policies',
  [Category.GENERAL_INFORMATION]: 'General Information / Articles: For informative content like blog posts, articles, guides, industry insights, or company news that doesn\'t fall into other specific business function categories.',
  [Category.UNCATEGORIZED]: 'Uncategorized'
};

// List of valid categories for runtime validation (keeping for backward compatibility)
export const VALID_CATEGORIES: string[] = Object.values(CATEGORY_DISPLAY_NAMES);

export const VALID_INTENTS = ['idle', 'booking', 'faq', 'account', 'escalation'] as const;
export type ValidIntent = typeof VALID_INTENTS[number];

export type DocumentCategory = Category;

// Confidence Score Configuration
export const CONFIDENCE_CONFIG = {
  MIN_SCORE: 0.5,
  MAX_SCORE: 1.0,
  DEFAULT_SCORE: 0.8,
  MIN_THRESHOLD: 0.6,
  WARNING_THRESHOLD: 0.7
} as const;

// URL Validation Configuration
export const URL_VALIDATION_CONFIG = {
  SOCIAL_DOMAINS: [
    'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'whatsapp.com',
  ],
  SKIPPED_EXTENSIONS: [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.css', '.js', '.json', '.xml', '.txt'
  ],
  SKIPPED_PATTERNS: [
    /\/wp-admin\//i,
    /\/wp-includes\//i,
    /\/wp-content\//i,
    /\/cart\//i,
    /\/checkout\//i,
    /\/admin\//i,
    /\/user\//i,
    /\/profile\//i,
    /\/login\//i,
    /\/signup\//i,
    /\/register\//i,
    /\/password\//i,
    /\/reset\//i,
    /\/logout\//i,
    // Spanish login/signup equivalents
    /\/iniciar-sesion\//i,
    /\/acceso\//i,
    /\/registrarse\//i,
    /\/registro\//i,
    // Adding patterns for terms, privacy, legal, disclaimer, cookies
    /\/terms([\w-]*conditions)?\//i,
    /\/privacy([\w-]*policy)?\//i,
    /\/legal\//i,
    /\/disclaimer\//i,
    /\/cookie([\w-]*policy)?\//i,
    // Spanish equivalents
    /\/condiciones\//i,
    /\/privacidad\//i,
    /\/aviso-legal\//i,
    /\/politica-de-cookies\//i
  ],
  // Added sitemap-specific URL normalization options
  SITEMAP_NORMALIZATION_OPTIONS: {
    stripHash: true,
    stripWWW: false,
    removeTrailingSlash: true,
    removeQueryParameters: [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^msclkid$/i],
    sortQueryParameters: false,
  },
  CORE_CONTENT_PAGE_KEYWORDS: [
    'about', 'contact', 'services', 'pricing', 'faq', 'book', 'appointment',
  ]
} as const;

// URL Fetcher Configuration
export const URL_FETCHER_CONFIG = {
  MIN_CONTENT_LENGTH: 40,
  CRAWL_OUTPUT_DIR: process.env.NODE_ENV === 'production' || process.env.VERCEL ? '/tmp/crawl-output' : 'crawl-output',
  CONTENT_TYPES: {
    HTML: 'text/html'
  },
  REDIRECT: {
    MANUAL: 'manual'
  },
  RESPONSE_STATUS: {
    REDIRECT_START: 300,
    REDIRECT_END: 400
  }
} as const;

// HTML Cleaner Configuration
export const HTML_CLEANER_CONFIG = {
  CONTENT_BLOCKS: ['main', 'article', 'section'], 
  CONTENT_DIV_CLASS: 'content', // Generic class name, can be expanded
  // Elements whose content should be extracted, but the wrapper itself is often navigational/boilerplate
  // Text within these will be processed for semantic hints (headings, lists)
  STRUCTURE_TAGS_TO_PROCESS: ['nav', 'footer', 'header', 'aside', 'figure', 'figcaption', 'details', 'summary', 'dialog'],
  // Elements to remove entirely (including their content) as they are typically non-informative for RAG
  ELEMENTS_TO_REMOVE_ENTIRELY: ['button', 'input', 'textarea', 'select', 'option'],
  POSITIVE_SELECTOR_PATTERNS: [
    '[class*="article-body"]', 
    '[class*="post-content"]', 
    '[class*="main-content"]', 
    '[id*="content"]', 
    '[id*="main"]'], // Added
  NEGATIVE_SELECTOR_PATTERNS: [
    '[class*="comment"]', 
    '[class*="sidebar"]', 
    '[class*="ad"]', 
    '[class*="advertisement"]',
    '[class*="popup"]', 
    '[class*="social"]', 
    '[class*="share"]', 
    '[class*="related-posts"]', 
    '[id*="comments"]', 
    '[id*="sidebar"]', 
    // Removing broad [id*="footer"] and [id*="header"] as they are too aggressive.
    // Rely on STRUCTURE_TAGS_TO_PROCESS for <header> and <footer> elements.

    // Form feedback messages and common alert patterns - keeping these more specific ones
    '[class*="form-status"]', // Often specific to form state updates
    '[class*="form-feedback"]', // More specific than just "message"
    '[id*="form-feedback"]',
    '[class*="wpcf7-response-output"]', // WordPress Contact Form 7 - very specific
    '[class*="alert-success"]', // More specific success alert
    '[class*="alert-danger"]', // More specific error alert
    '[class*="alert-warning"]', // More specific warning alert
    '[class*="alert-info"]', // More specific info alert
    // Keeping role-based ones as they are semantic for feedback
    '[role="alert"]', 
    '[role="status"]', 
     // Removing overly generic ones like [class*="message"], [class*="error"], [class*="success"]
     // unless they can be made more specific later if needed.
    '[class*="submission-success"]', // Specific to submission lifecycle
    '[class*="submission-error"]' 
  ],
  MIN_TEXT_LENGTH_FOR_VALUABLE_STRUCTURAL: 50, // Chars of non-link text to be valuable
} as const;

// Process Content Configuration
export const PROCESS_CONTENT_CONFIG = {
  LOGGER: {
    PROGRESS_UPDATE_INTERVAL: 1000, // Update progress every second
    MIN_CHUNK_WORDS: 10, // Minimum words required in a chunk
    MAX_RETRIES: 3 // Maximum number of retries for processing chunks
  },
  TEXT_SPLITTER: {
    MIN_CHUNK_LENGTH: 50, // Minimum characters in a chunk to be considered valid
    MAX_CHARS_PER_LLM_INPUT_CHUNK: 6000 // Lowered from 32000 for better LLM segmentation
  },
  TEXT_CATEGORIZER: {
    MIN_CHUNK_LENGTH: 50, // Minimum characters in a chunk to be processed
    ERROR_MESSAGES: {
      CHUNK_TOO_SHORT: 'Chunk too short to process',
      NO_CATEGORIES: 'No categories returned from categorization',
      NO_VALID_CATEGORIES: 'No valid categories after categorization',
      CHUNK_TOO_SHORT_WORDS: (wordCount: number) => `Chunk too short (${wordCount} words)`
    }
  }
} as const;

// Base configuration for all crawls
export interface CrawlConfig {
  websiteUrl?: string;
  businessId: string;
  maxPages?: number;
  requestDelay?: number;
  maxRetries?: number;
  concurrency?: number;
  maxDepth?: number;
  skipProductPages?: boolean;
  skipBlogPages?: boolean;
  botType?: 'customer-service' | 'mobile-quote-booking';
  useSitemap?: boolean;
  logInterval?: {
    urls?: number;
    seconds?: number;
  };
  type?: 'website_page' | 'pdf'; // Added for dynamic document type
  pdfNames?: string[]; // Array of PDF filenames for PDF processing
  importantUrlsForDetection?: string[]; // Added for language detection hints
  urlLanguageHintsForDetection?: Record<string, string>; // Added for language detection hints
}

export interface DefaultConfigValues {
  maxPages: number;
  concurrency: number;
  maxDepth: number;
  skipProductPages: boolean;
  skipBlogPages: boolean;
  requestDelay: number;
}

export const defaultConfig: DefaultConfigValues = {
  maxPages: 100, // Reverted to original value
  concurrency: 5,
  maxDepth: 4, // Reverted to original value
  skipProductPages: true, // Reverted to original value
  skipBlogPages: true, // Reverted to original value
  requestDelay: 0, // Reverted to original value
};

// Create PDF-specific config
export function createPdfConfig(businessId: string, pdfNames: string[]): CrawlConfig {
  return {
    businessId,
    type: 'pdf',
    pdfNames,
    maxPages: pdfNames.length, // Process all provided PDFs
    concurrency: defaultConfig.concurrency
  };
}

// Extended configuration for processing
export interface ExtendedCrawlConfig extends Omit<CrawlConfig, 'businessId'> {
  categorizedSections?: CategorizedContent[];
  concurrencyLimit?: number;
}

export interface CategorizedContent {
  category: Category;
  content: string;
  confidence: number;
  confidenceReason: string;
  url: string;
  pageTitle?: string;
}

export interface PageContent {
  url: string;
  title: string;
  content: string;
  category: DocumentCategory;
  contentHash: string;
  links: string[];
  businessId: string;
  categorizedContent: CategorizedContent[];
  metadata: {
    crawlTimestamp: number;
    depth: number;
    status: 'success' | 'error';
    error?: string;
    language: string;
    originalUrl: string;
    fileType: 'html' | 'pdf';
  };
}

export interface CrawlProgress {
  processedPages: number;
  totalPages: number;
  percentage: number;
  currentUrl: string;
  activePages: number;
}

export interface CrawlState {
  visitedUrls: Set<string>;
  contentHashes: Set<string>;
  config: CrawlConfig;
  baseUrl: URL;
  robotsRules: any;
  lastRequestTime: number;
  crawlSession: CrawlSession;
  activePages: number;
  lastLogTime: number;
  lastLogUrlCount: number;
  allTexts: string[];
}

export type CrawlResultStatus = 
  | 'processed'                 // Successfully fetched, cleaned, unique, and ready for further steps.
  | 'skipped_duplicate'         // Fetched, cleaned, but content was a duplicate.
  | 'skipped_robots'            // Skipped due to robots.txt.
  | 'skipped_fetch_error'       // Failed to fetch.
  | 'skipped_cleaning_error'    // Failed to clean or content empty.
  | 'skipped_other';            // For any other skip reasons.

// Definition for ExtractedPatterns, mirroring htmlCleaner.ts
export interface ExtractedPatterns {
  emails: string[];
  phones: string[];
  copyrights: string[];
  // addresses: string[]; // Future placeholder
}

export interface CrawlResult {
  url: string; 
  fullUrl: string; 
  status: CrawlResultStatus;
  reason: string; 
  detectedLanguage: string;
  cleanedText: string | null;
  pageTitle?: string;
  contentSignature: string | null;
  extractedPatterns?: ExtractedPatterns;
  embedded: boolean; 
  value: number;
}

export interface CrawlOutput {
  results: CrawlResult[];
  urls: string[]; // All unique URLs for which processing was ATTEMPTED
  mainLanguage: string;
}

export interface CrawlProcessingResult {
  mergedText: string;
  pageCount: number;
  uniqueParagraphs: number;
  businessId: string;
  source: string;
  crawledUrls?: string[];
  embeddingsStatus?: string;
  metadata?: {
    crawlTimestamp: number;
    status: 'success' | 'error';
    language: string;
    fileType: 'html' | 'pdf';
  };
}

export interface TextChunk {
  text: string;             
  sourcePageUrl: string;    
  sourceBlockIndex: number; 
  sourcePageTitle?: string;
  chunkInBlockIndex: number;
  totalChunksInBlock: number; 
  pageLang?: string;         
  pageExtractedPatterns?: ExtractedPatterns; 
  metadata: { 
    wordCount: number;
    charCount: number;
  };
}

export interface CategorizedSection {
  category: DocumentCategory;
  content: string;
  confidence: number;
}

export interface ContentChunk {
  content: string;
  confidence: number;
}

export interface GroupedContent {
  categorizedContent: Record<string, string[]>;
  paragraphHashes: Record<string, Set<string>>;
}

export interface PdfExtractionResult {
  text: string;
  error?: string;
  metadata: {
    pageCount: number;
    language: string;
    fileType: 'pdf';
  };
} 