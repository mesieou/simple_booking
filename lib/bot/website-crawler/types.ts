import { CrawlSession } from '@/lib/models/crawl-session';

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

export interface PageContent {
  url: string;
  title: string;
  content: string;
  category?: string;
  contentHash: string;
  links: string[];
  businessId: string;
  metadata: {
    crawlTimestamp: number;
    depth: number;
    status: 'success' | 'error';
    error?: string;
    language: string;
    originalUrl: string;
    fileType?: string;
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