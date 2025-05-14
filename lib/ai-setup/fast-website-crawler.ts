import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import * as cheerio from 'cheerio';
import { generateEmbedding, detectPageCategory } from '@/lib/services/openai';
import { URL } from 'url';
import parseRobots from 'robots-parser';
import crypto from 'crypto';
import pLimit from 'p-limit';
import normalizeUrl from 'normalize-url';
import { CrawlSession as CrawlSessionModel } from '@/lib/models/crawl-session';
import { parseSitemap, SitemapItem } from 'sitemap';
import { Readable } from 'stream';
import { retry } from 'ts-retry-promise';

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

class FastWebsiteCrawler {
  private visitedUrls = new Set<string>();
  private contentHashes = new Set<string>();
  private config: FastCrawlConfig;
  private baseUrl: URL;
  private robotsRules: any;
  private lastRequestTime: number = 0;
  private progressCallback?: (progress: CrawlProgress) => void;
  private crawlSession: CrawlSessionData;
  private activePages = 0;
  private supabase = createClient();
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  private readonly DEFAULT_HEADERS = {
    'User-Agent': this.USER_AGENT,
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
  private lastLogTime: number = 0;
  private lastLogUrlCount: number = 0;

  constructor(
    config: FastCrawlConfig,
    progressCallback?: (progress: CrawlProgress) => void
  ) {
    this.config = {
      maxPages: 100,
      requestDelay: 100,
      maxRetries: 3,
      concurrency: 20,
      useSitemap: true,
      logInterval: {
        urls: 10,  // Log every 10 URLs by default
        seconds: 5  // Log every 5 seconds by default
      },
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
    this.lastLogTime = Date.now();
    this.lastLogUrlCount = 0;
  }

  private async validateAndCheckRobots(): Promise<boolean> {
    try {
      const robotsUrl = `${this.baseUrl.origin}/robots.txt`;
      const response = await fetch(robotsUrl, { 
        headers: this.DEFAULT_HEADERS,
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch robots.txt: ${response.status}`);
      }
      
      const text = await response.text();
      this.robotsRules = parseRobots(robotsUrl, text);
      return this.robotsRules.isAllowed(this.config.websiteUrl, this.USER_AGENT);
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
        (!this.robotsRules || this.robotsRules.isAllowed(url, this.USER_AGENT))
      );
    } catch {
      return false;
    }
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('sha1').update(content).digest('hex');
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

  private async fetchSitemapUrls(): Promise<string[]> {
    try {
      const sitemapUrl = `${this.baseUrl.origin}/sitemap.xml`;
      const response = await fetch(sitemapUrl, {
        headers: this.DEFAULT_HEADERS,
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status}`);
      }
      
      const text = await response.text();
      const sitemap = await parseSitemap(Readable.from(text));
      return sitemap
        .map((url: SitemapItem) => url.url)
        .filter((url: string) => this.isValidUrl(url));
    } catch (error) {
      console.warn('Could not fetch sitemap, falling back to link extraction:', error);
      return [];
    }
  }

  private async fetchPageContent(url: string): Promise<PageContent | null> {
    await this.delay();

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        const response = await fetch(url, {
          headers: this.DEFAULT_HEADERS,
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          const status = response.status;
          if ([401, 403, 404].includes(status)) {
            console.warn(`Page returned ${status} for ${url}, skipping...`);
            return null;
          }
          if (status === 429) {
            console.warn(`Rate limited for ${url}, waiting longer before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
            continue;
          }
          if (status === 503) {
            console.warn(`Service unavailable for ${url}, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
          throw new Error(`HTTP error! status: ${status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html) as cheerio.CheerioAPI;
        
        const title = $('title').text().trim() || 
                     $('h1').first().text().trim() || 
                     decodeURIComponent(new URL(url).pathname.replace(/\//g, ' ').trim()) || 
                     'Untitled Page';
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
        const category = await detectPageCategory(url, title, content);

        return {
          url,
          title,
          content,
          category,
          contentHash,
          links,
          businessId: this.config.businessId,
          metadata: {
            crawlTimestamp: Date.now(),
            depth: 0,
            status: 'success',
            language: detectLanguage(url, content),
            originalUrl: url
          }
        };
      } catch (error) {
        if (attempt === this.config.maxRetries! - 1) {
          this.crawlSession.failedPages++;
          this.crawlSession.errors.push({ 
            url, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    return null;
  }

  private logProgress(currentUrl: string): void {
    const now = Date.now();
    const urlCount = this.visitedUrls.size;
    const shouldLog = 
      (this.config.logInterval?.urls && (urlCount - this.lastLogUrlCount) >= this.config.logInterval.urls) ||
      (this.config.logInterval?.seconds && (now - this.lastLogTime) >= (this.config.logInterval.seconds * 1000));

    if (shouldLog) {
      const elapsedSeconds = Math.floor((now - this.crawlSession.startTime) / 1000);
      const urlsPerSecond = (urlCount / elapsedSeconds).toFixed(2);
      const progress = (urlCount / this.config.maxPages! * 100).toFixed(1);
      
      console.log(`[${new Date().toISOString()}] Progress: ${progress}% (${urlCount}/${this.config.maxPages})`);
      console.log(`  Current URL: ${currentUrl}`);
      console.log(`  Speed: ${urlsPerSecond} URLs/sec`);
      console.log(`  Success: ${this.crawlSession.successfulPages}, Failed: ${this.crawlSession.failedPages}`);
      console.log(`  Active pages: ${this.activePages}`);
      console.log(`  Categories: ${Object.entries(this.crawlSession.categories)
        .map(([cat, count]) => `${cat}: ${count}`)
        .join(', ')}`);
      
      this.lastLogTime = now;
      this.lastLogUrlCount = urlCount;
    }

    // Always call the progress callback if provided
    if (this.progressCallback) {
      this.progressCallback({
        processedPages: urlCount,
        totalPages: this.config.maxPages!,
        percentage: (urlCount / this.config.maxPages!) * 100,
        currentUrl,
        activePages: this.activePages
      });
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

          // Log progress
          this.logProgress(canonicalUrl);

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
    const MAX_RETRIES = 5;
    const INITIAL_RETRY_DELAY = 1000;
    const SUPABASE_BATCH_SIZE = 50;
    const supabaseDelay = 100;
    const FETCH_TIMEOUT = 10000; // 10 seconds timeout for fetch operations

    for (const doc of documents) {
      try {
        // Detect language
        const lang = detectLanguage(doc.url, doc.content);
        
        // Generate content hash including language
        const contentHash = generateContentHash(doc.content, lang);

        // Check if content already exists
        const { data } = await this.supabase
          .from('documents')
          .select('id')
          .eq('contentHash', contentHash)
          .eq('businessId', doc.businessId)
          .single();

        if (data) {
          console.log(`Skipping duplicate content for ${doc.url} (${lang})`);
          continue;
        }

        const documentRecord = await retry(
          () => Document.add({
            businessId: doc.businessId,
            content: doc.content,
            title: doc.title,
            source: doc.url,
            type: 'website_page',
            category: doc.category,
            contentHash: contentHash
          }),
          {
            retries: MAX_RETRIES,
            delay: INITIAL_RETRY_DELAY,
            backoff: 'EXPONENTIAL',
            timeout: FETCH_TIMEOUT
          }
        );

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

        // Process chunks in batches with rate limiting
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

              // Process Supabase writes in smaller batches with delays
              for (let j = 0; j < batch.length; j += SUPABASE_BATCH_SIZE) {
                const supabaseBatch = batch.slice(j, j + SUPABASE_BATCH_SIZE);
                const embeddingBatch = embeddings.slice(j, j + SUPABASE_BATCH_SIZE);
                
                await Promise.all(supabaseBatch.map((chunk, k) =>
                  retry(
                    () => Embedding.add({
                      documentId: documentRecord.id!,
                      content: chunk,
                      embedding: embeddingBatch[k],
                      metadata: {
                        pageTitle: doc.title,
                        sourceUrl: doc.url,
                        chunkIndex: i + j + k,
                        category: doc.category,
                        contentHash: contentHash,
                        crawlTimestamp: doc.metadata.crawlTimestamp,
                        language: lang
                      }
                    }),
                    {
                      retries: MAX_RETRIES,
                      delay: INITIAL_RETRY_DELAY,
                      backoff: 'EXPONENTIAL',
                      timeout: FETCH_TIMEOUT
                    }
                  )
                ));

                // Add delay between Supabase batches
                if (j + SUPABASE_BATCH_SIZE < batch.length) {
                  await new Promise(resolve => setTimeout(resolve, supabaseDelay));
                }
              }
              break; // Success, exit retry loop
            } catch (error) {
              if (attempt === MAX_RETRIES - 1) {
                console.error(`Failed to process batch after ${MAX_RETRIES} attempts:`, error);
                throw error; // Re-throw on final attempt
              }
              const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
              console.warn(`Rate limit hit, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process document ${doc.url}:`, error);
        // Continue with next document instead of failing completely
        continue;
      }
    }
  }

  public async start(): Promise<CrawlSessionData> {
    try {
      const isAllowed = await this.validateAndCheckRobots();
      if (!isAllowed) {
        throw new Error(`Crawling disallowed by robots.txt for ${this.config.websiteUrl}`);
      }

      let urlsToProcess: string[] = [];
      
      // Try to get URLs from sitemap first
      if (this.config.useSitemap) {
        urlsToProcess = await this.fetchSitemapUrls();
      }

      // If no sitemap or sitemap is empty, start with the homepage
      if (urlsToProcess.length === 0) {
        const homepageContent = await this.fetchPageContent(this.config.websiteUrl);
        if (homepageContent) {
          urlsToProcess = homepageContent.links;
          // Add homepage to results
          await this.createEmbeddings([homepageContent]);
        }
      }

      // Process URLs in batches
      const results: PageContent[] = [];
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

      // Create embeddings synchronously before returning
      await this.createEmbeddings(results);

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

export async function setupBusinessAiBot(config: FastCrawlConfig, progressCallback?: (progress: CrawlProgress) => void) {
  const crawler = new FastWebsiteCrawler(config, progressCallback);
  return await crawler.start();
}

// Helper function to detect language from URL or content
function detectLanguage(url: string, content: string): string {
  // Check URL patterns first
  const urlLang = url.match(/-([a-z]{2})(?:$|[/?])/i)?.[1]?.toLowerCase();
  if (urlLang) return urlLang;

  // Check content language hints
  const langMatch = content.match(/lang=["']([a-z]{2})["']/i);
  if (langMatch) return langMatch[1].toLowerCase();

  // Default to English if no language detected
  return 'en';
}

// Helper function to normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Helper function to generate content hash including language
function generateContentHash(content: string, lang: string): string {
  const normalizedContent = normalizeText(content);
  return crypto.createHash('sha256').update(normalizedContent + lang).digest('hex');
} 