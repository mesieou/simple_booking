import { CrawlSession } from '@/lib/models/crawl-session';

export type WebPageCategory =
  | 'services offered'
  | 'pricing or quotes'
  | 'contact'
  | 'booking or scheduling'
  | 'about / trust-building'
  | 'faq'
  | 'terms & conditions / legal policies';

// List of valid categories for runtime validation
export const VALID_CATEGORIES: WebPageCategory[] = [
  'services offered',
  'pricing or quotes',
  'contact',
  'booking or scheduling',
  'about / trust-building',
  'faq',
  'terms & conditions / legal policies'
];

export interface FastCrawlConfig {
  websiteUrl: string;
  botType: 'customer-service' | 'mobile-quote-booking';
  businessId: string;
  maxPages?: number;
  requestDelay?: number;
  maxRetries?: number;
  concurrency?: number;
  useSitemap?: boolean;
  logInterval?: {
    urls?: number;  // Log every N URLs
    seconds?: number;  // Log every N seconds
  };
}

export interface CategorizedContent {
  category: WebPageCategory;
  content: string;
  confidence: number;
}

export interface PageContent {
  url: string;
  title: string;
  content: string;
  category: WebPageCategory;
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
  config: FastCrawlConfig;
  baseUrl: URL;
  robotsRules: any;
  lastRequestTime: number;
  crawlSession: CrawlSession;
  activePages: number;
  lastLogTime: number;
  lastLogUrlCount: number;
}

export interface SimpleCrawlConfig {
  websiteUrl: string;
  businessId: string;
  maxPages?: number;
  requestDelay?: number;
  maxRetries?: number;
  concurrency?: number;
}

export interface SimpleCrawlState {
  visitedUrls: Set<string>;
  config: SimpleCrawlConfig;
  baseUrl: URL;
  lastRequestTime: number;
  activePages: number;
  allTexts: string[];
}

export interface SimpleCrawlResult {
  mergedText: string;
  pageCount: number;
  uniqueParagraphs: number;
  businessId: string;
  websiteUrl: string;
} 