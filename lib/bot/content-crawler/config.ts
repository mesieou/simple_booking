import { CrawlSession } from '@/lib/models/crawl-session';

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
  MAX_RETRIES: 5,
  INITIAL_RETRY_DELAY: 1000,
  SUPABASE_BATCH_SIZE: 50,
  SUPABASE_DELAY: 100,
  FETCH_TIMEOUT: 10000 // 10 seconds timeout for fetch operations
};

export type DocumentCategory =
  | 'services offered'
  | 'pricing or quotes'
  | 'contact'
  | 'booking or scheduling'
  | 'about / trust-building'
  | 'faq'
  | 'terms & conditions / legal policies';

// List of valid categories for runtime validation
export const VALID_CATEGORIES: DocumentCategory[] = [
  'services offered',
  'pricing or quotes',
  'contact',
  'booking or scheduling',
  'about / trust-building',
  'faq',
  'terms & conditions / legal policies'
];

// Base configuration for all crawls
export interface CrawlConfig {
  websiteUrl: string;
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
}

export const defaultConfig: Partial<CrawlConfig> = {
  maxPages: 100,
  concurrency: 5,
  maxDepth: 2,
  skipProductPages: true,
  skipBlogPages: true,
  requestDelay: 0,
};

// Extended configuration for processing
export interface ExtendedCrawlConfig extends Omit<CrawlConfig, 'businessId'> {
  categorizedSections?: CategorizedContent[];
  chunkSize?: number;
  concurrencyLimit?: number;
}

export interface CategorizedContent {
  category: DocumentCategory;
  content: string;
  confidence: number;
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

export interface CrawlResult {
  url: string;
  status: 'crawled' | 'skipped';
  reason: string;
  detectedLanguage: string;
  embedded: boolean;
  value: number;
}

export interface CrawlOutput {
  texts: string[];
  results: CrawlResult[];
  urls: string[];
  mainLanguage: string;
}

export interface CrawlProcessingResult {
  mergedText: string;
  pageCount: number;
  uniqueParagraphs: number;
  businessId: string;
  websiteUrl: string;
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
  url: string;
  textIndex: number;
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