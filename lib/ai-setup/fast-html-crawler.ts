import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import got from 'got';
import * as cheerio from 'cheerio';
import { generateEmbedding, detectPageCategory } from '@/lib/services/openai';
import { URL } from 'url';
import parseRobots from 'robots-parser';
import crypto from 'crypto';
import pLimit from 'p-limit';
import normalizeUrl from 'normalize-url';
import { CrawlSession as CrawlSessionModel } from '@/lib/models/crawl-session';

export interface FastHtmlCrawlConfig {
  websiteUrl: string;
  botType: 'customer-service' | 'mobile-quote-booking';
  businessId: string;
  maxPages?: number;
  requestDelay?: number;
  maxRetries?: number;
  concurrency?: number;
  timeout?: number;
}

export interface PageMetadata {
  title: string;
  headings: string[];
  description?: string;
  keywords?: string[];
  lastModified?: string;
  language?: string;
}

export interface PageContent {
  url: string;
  title: string;
  content: string;
  category?: string;
  contentHash: string;
  links: string[];
  businessId: string;
  metadata: PageMetadata & {
    crawlTimestamp: number;
    depth: number;
    status: 'success' | 'error';
    error?: string;
  };
}

export interface CrawlProgress {
  processedPages: number;
  totalPages: number;
  percentage: number;
  currentUrl: string;
  activePages: number;
}

export interface CrawlSessionData {
  id?: string;
  businessId: string;
  startTime: number;
  endTime?: number;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  categories: Record<string, number>;
  errors: Array<{ url: string; error: string }>;
}

class FastHtmlCrawler {
  private visitedUrls = new Set<string>();
  private contentHashes = new Set<string>();
  private config: FastHtmlCrawlConfig;
  private baseUrl: URL;
  private robotsRules: any;
  private lastRequestTime: number = 0;
  private progressCallback?: (progress: CrawlProgress) => void;
  private crawlSession: CrawlSessionData;
  private activePages = 0;
  private supabase = createClient();
  private httpClient: ReturnType<typeof got.extend>;

  constructor(
    config: FastHtmlCrawlConfig,
    progressCallback?: (progress: CrawlProgress) => void
  ) {
    this.config = {
      maxPages: 100,
      requestDelay: 100,
      maxRetries: 3,
      concurrency: 20,
      timeout: 10000,
      ...config
    };
    this.baseUrl = new URL(config.websiteUrl);
    this.progressCallback = progressCallback;
    this.crawlSession = {
      businessId: config.businessId,
      startTime: Date.now(),
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      categories: {},
      errors: []
    };

    // Configure HTTP client with retries and timeouts
    this.httpClient = got.extend({
      retry: {
        retries: this.config.maxRetries,
        methods: ['GET'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'EPIPE']
      },
      timeout: {
        request: this.config.timeout
      },
      headers: {
        'User-Agent': 'FastHtmlCrawler/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      responseType: 'text'
    });
  }

  private async validateAndCheckRobots(): Promise<boolean> {
    try {
      const robotsUrl = `${this.baseUrl.origin}/robots.txt`;
      const response = await this.httpClient.get(robotsUrl).text();
      this.robotsRules = parseRobots(robotsUrl, response);
      return this.robotsRules.isAllowed(this.config.websiteUrl, 'FastHtmlCrawler/1.0');
    } catch (error) {
      console.warn('Could not fetch robots.txt, proceeding with crawl:', error);
      return true;
    }
  }

  private async delay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.requestDelay!) {
      await new Promise(resolve => setTimeout(resolve, this.config.requestDelay! - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  private canonicalizeUrl(url: string): string {
    try {
      return normalizeUrl(url, {
        stripHash: true,
        stripWWW: true,
        removeTrailingSlash: true,
        removeQueryParameters: [/^utm_/i, /^ref_/i],
        sortQueryParameters: true
      });
    } catch {
      return url;
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const canonicalUrl = this.canonicalizeUrl(url);
      return (
        parsedUrl.hostname === this.baseUrl.hostname &&
        parsedUrl.protocol === this.baseUrl.protocol &&
        !this.visitedUrls.has(canonicalUrl) &&
        this.visitedUrls.size < this.config.maxPages! &&
        (!this.robotsRules || this.robotsRules.isAllowed(url, 'FastHtmlCrawler/1.0'))
      );
    } catch {
      return false;
    }
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('sha1').update(content).digest('hex');
  }

  private extractMetadata($: cheerio.CheerioAPI): PageMetadata {
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';
    const headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get();
    const description = $('meta[name="description"]').attr('content')?.trim();
    const keywords = $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim());
    const lastModified = $('meta[http-equiv="last-modified"]').attr('content')?.trim();
    const language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content')?.trim();

    return {
      title,
      headings,
      description,
      keywords,
      lastModified,
      language
    };
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove unwanted elements
    $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar').remove();
    
    // Try to find main content in semantic order
    const main = $('main').text().trim();
    if (main) return main;

    const article = $('article').text().trim();
    if (article) return article;

    const content = $('.content, #content, [role="main"]').text().trim();
    if (content) return content;

    // Fallback to body
    return $('body').text().trim();
  }

  private extractInternalLinks($: cheerio.CheerioAPI, baseUrl: URL): string[] {
    const links: string[] = [];
    $('a[href]').each((_index: number, element: any) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.toString()).toString();
          const canonicalUrl = this.canonicalizeUrl(absoluteUrl);
          if (this.isValidUrl(canonicalUrl)) {
            links.push(canonicalUrl);
          }
        } catch {}
      }
    });
    return links;
  }

  private async fetchPageContent(url: string): Promise<PageContent | null> {
    await this.delay();

    try {
      const response = await this.httpClient.get(url).text();
      const $ = cheerio.load(response) as cheerio.CheerioAPI;
      
      const metadata = this.extractMetadata($);
      const content = this.extractMainContent($).trim();

      if (!content) {
        console.warn(`No content found at ${url}`);
        return null;
      }

      const contentHash = this.generateContentHash(content);
      if (this.contentHashes.has(contentHash)) {
        console.warn(`Duplicate content detected at ${url}`);
        return null;
      }

      this.contentHashes.add(contentHash);
      const links = this.extractInternalLinks($, this.baseUrl);
      const category = await detectPageCategory(url, metadata.title, content);

      return {
        url,
        title: metadata.title,
        content,
        category,
        contentHash,
        links,
        businessId: this.config.businessId,
        metadata: {
          ...metadata,
          crawlTimestamp: Date.now(),
          depth: 0,
          status: 'success'
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
          console.warn(`Access forbidden for ${url}, skipping...`);
          return null;
        }
        if (error.message.includes('HTTP 404')) {
          console.warn(`Page not found for ${url}, skipping...`);
          return null;
        }
      }
      this.crawlSession.failedPages++;
      this.crawlSession.errors.push({
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private async processBatch(urls: string[]): Promise<PageContent[]> {
    const limit = pLimit(this.config.concurrency!);
    const results: PageContent[] = [];

    const batchResults = await Promise.allSettled(
      urls.map(url =>
        limit(async () => {
          const canonicalUrl = this.canonicalizeUrl(url);
          if (this.visitedUrls.has(canonicalUrl)) {
            return null;
          }

          this.visitedUrls.add(canonicalUrl);
          this.activePages++;

          if (this.progressCallback) {
            this.progressCallback({
              processedPages: this.visitedUrls.size,
              totalPages: this.config.maxPages!,
              percentage: (this.visitedUrls.size / this.config.maxPages!) * 100,
              currentUrl: canonicalUrl,
              activePages: this.activePages
            });
          }

          try {
            const pageContent = await this.fetchPageContent(canonicalUrl);
            if (!pageContent) {
              this.crawlSession.failedPages++;
              return null;
            }

            if (pageContent.category) {
              this.crawlSession.categories[pageContent.category] = 
                (this.crawlSession.categories[pageContent.category] || 0) + 1;
            }

            this.crawlSession.successfulPages++;
            return pageContent;
          } catch (error) {
            this.crawlSession.failedPages++;
            this.crawlSession.errors.push({
              url: canonicalUrl,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
          } finally {
            this.activePages--;
          }
        })
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    return results;
  }

  private async createEmbeddings(documents: PageContent[]): Promise<void> {
    const BATCH_SIZE = 16;
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000;

    for (const doc of documents) {
      // Check if content already exists
      const { data } = await this.supabase
        .from('documents')
        .select('id')
        .eq('contentHash', doc.contentHash)
        .eq('businessId', doc.businessId)
        .single();

      if (data) {
        console.log(`Skipping duplicate content for ${doc.url}`);
        continue;
      }

      const documentRecord = await Document.add({
        businessId: doc.businessId,
        content: doc.content,
        title: doc.title,
        source: doc.url,
        type: 'website_page',
        category: doc.category,
        contentHash: doc.contentHash
      });

      // Split content into chunks
      const chunks = doc.content.split(/\s+/).reduce((acc: string[], word: string) => {
        const currentChunk = acc[acc.length - 1] || '';
        if (currentChunk.length + word.length + 1 > 1000) {
          acc.push(word);
        } else {
          acc[acc.length - 1] = currentChunk ? `${currentChunk} ${word}` : word;
        }
        return acc;
      }, []);

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            const embeddings = await Promise.all(
              batch.map(async (chunk, index) => {
                if (index > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                return generateEmbedding(chunk);
              })
            );

            await Promise.all(batch.map((chunk, j) =>
              Embedding.add({
                documentId: documentRecord.id!,
                content: chunk,
                embedding: embeddings[j],
                metadata: {
                  pageTitle: doc.title,
                  sourceUrl: doc.url,
                  chunkIndex: i + j,
                  category: doc.category,
                  contentHash: doc.contentHash,
                  crawlTimestamp: doc.metadata.crawlTimestamp
                }
              })
            ));
            break;
          } catch (error) {
            if (error instanceof Error && error.message.includes('rate limit')) {
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
              console.warn(`Rate limit hit, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      }
    }
  }

  public async start(): Promise<CrawlSessionData> {
    try {
      const isAllowed = await this.validateAndCheckRobots();
      if (!isAllowed) {
        throw new Error(`Crawling disallowed by robots.txt for ${this.config.websiteUrl}`);
      }

      // Start with the homepage
      const homepageContent = await this.fetchPageContent(this.config.websiteUrl);
      if (!homepageContent) {
        throw new Error('Failed to fetch homepage content');
      }

      let urlsToProcess = homepageContent.links;
      const results: PageContent[] = [homepageContent];

      // Process URLs in batches
      while (urlsToProcess.length > 0 && this.visitedUrls.size < this.config.maxPages!) {
        const batch = urlsToProcess.splice(0, this.config.concurrency!);
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);

        // Add new links to the queue
        for (const result of batchResults) {
          urlsToProcess.push(...result.links.filter(link => 
            !this.visitedUrls.has(this.canonicalizeUrl(link)) &&
            !urlsToProcess.includes(link)
          ));
        }
      }

      this.crawlSession.endTime = Date.now();
      this.crawlSession.totalPages = this.visitedUrls.size;

      // Store crawl session metadata
      const session = await CrawlSessionModel.add(this.crawlSession);

      // Create embeddings in the background
      this.createEmbeddings(results).catch(error => {
        console.error('Error creating embeddings:', error);
      });

      return this.crawlSession;
    } catch (error) {
      this.crawlSession.endTime = Date.now();
      this.crawlSession.errors.push({
        url: this.config.websiteUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export async function setupBusinessAiBot(config: FastHtmlCrawlConfig, progressCallback?: (progress: CrawlProgress) => void) {
  const crawler = new FastHtmlCrawler(config, progressCallback);
  return await crawler.start();
} 