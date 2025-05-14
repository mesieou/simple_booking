import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { generateEmbedding, detectPageCategory, WebPageCategory } from '@/lib/services/openai';
import { URL } from 'url';
import parseRobots from 'robots-parser';
import crypto from 'crypto';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, HTTPResponse } from 'puppeteer';
import pLimit from 'p-limit';
import normalizeUrl from 'normalize-url';
import { CrawlSession as CrawlSessionModel } from '@/lib/models/crawl-session';
import OpenAI from 'openai';

// Add stealth plugin
puppeteer.use(StealthPlugin());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CheerioAPI = ReturnType<typeof cheerio.load>;

export interface WebsiteCrawlConfig {
  websiteUrl: string;
  botType: 'customer-service' | 'mobile-quote-booking';
  businessId: string;
  maxDepth?: number;
  maxPages?: number;
  requestDelay?: number;
  maxRetries?: number;
  concurrency?: number;
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
    debugFiles?: {
      screenshot: string;
      html: string;
    };
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

interface EmbeddingService {
  createEmbeddings(documents: PageContent[]): Promise<void>;
}

class DefaultEmbeddingService implements EmbeddingService {
  private supabase = createClient();
  private readonly BATCH_SIZE = 16; // OpenAI's recommended batch size
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000;

  private splitTextIntoChunks(text: string, maxChunkSize = 1000): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    for (const word of words) {
      if (currentChunk.join(' ').length + word.length + 1 > maxChunkSize) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [word];
      } else {
        currentChunk.push(word);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  private async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Process texts in parallel with rate limiting
        const embeddings = await Promise.all(
          texts.map(async (text, index) => {
            // Add small delay between requests to avoid rate limits
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            return generateEmbedding(text);
          })
        );
        return embeddings;
      } catch (error) {
        if (error instanceof Error && error.message.includes('rate limit')) {
          const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.warn(`Rate limit hit, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate embeddings after retries');
  }

  private async checkExistingContent(contentHash: string, businessId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('documents')
      .select('id')
      .eq('contentHash', contentHash)
      .eq('businessId', businessId)
      .single();
    return !!data;
  }

  async createEmbeddings(documents: PageContent[]): Promise<void> {
    for (const doc of documents) {
      // Check if content already exists
      const exists = await this.checkExistingContent(doc.contentHash, doc.businessId);
      if (exists) {
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
        contentHash: doc.contentHash // Add content hash to document
      });

      const chunks = this.splitTextIntoChunks(doc.content);
      
      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
        const batch = chunks.slice(i, i + this.BATCH_SIZE);
        const embeddings = await this.generateEmbeddingsBatch(batch);
        
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
      }
    }
  }
}

export class WebsiteCrawler {
  private visitedUrls = new Set<string>();
  private contentHashes = new Set<string>();
  private config: WebsiteCrawlConfig;
  private baseUrl: URL;
  private robotsRules: any;
  private lastRequestTime: number = 0;
  private progressCallback?: (progress: CrawlProgress) => void;
  private browser: Browser | null = null;
  private embeddingService: EmbeddingService;
  private crawlSession: CrawlSessionData;
  private activePages = 0;

  constructor(
    config: WebsiteCrawlConfig, 
    progressCallback?: (progress: CrawlProgress) => void,
    embeddingService?: EmbeddingService
  ) {
    this.config = {
      maxDepth: 3,
      maxPages: 10,
      requestDelay: 1000,
      maxRetries: 3,
      concurrency: 3,
      ...config
    };
    this.baseUrl = new URL(config.websiteUrl);
    this.progressCallback = progressCallback;
    this.embeddingService = embeddingService || new DefaultEmbeddingService();
    this.crawlSession = {
      businessId: config.businessId,
      startTime: Date.now(),
      totalPages: 0,
      successfulPages: 0,
      failedPages: 0,
      categories: {},
      errors: []
    };
  }

  private async initBrowser() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: false, // Use non-headless mode to avoid detection
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080'
          ],
          defaultViewport: {
            width: 1920,
            height: 1080
          }
        });
      } catch (error) {
        console.error('Failed to launch browser:', error);
        throw new Error('Failed to initialize browser');
      }
    }
  }

  private async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async validateAndCheckRobots(): Promise<boolean> {
    try {
      const robotsUrl = `${this.baseUrl.origin}/robots.txt`;
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      this.robotsRules = parseRobots(robotsUrl, response.data);
      
      // Use the same user agent as Puppeteer
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      return this.robotsRules.isAllowed(this.config.websiteUrl, userAgent);
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
        (!this.robotsRules || this.robotsRules.isAllowed(url, 'YourBot/1.0'))
      );
    } catch {
      return false;
    }
  }

  private generateContentHash(content: string): string {
    return crypto.createHash('sha1').update(content).digest('hex');
  }

  private detectCategory(url: string, title: string, content: string): string | undefined {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    // URL-based detection
    if (urlLower.includes('/services') || titleLower.includes('services')) return 'services';
    if (urlLower.includes('/about') || titleLower.includes('about')) return 'about';
    if (urlLower.includes('/contact') || titleLower.includes('contact')) return 'contact';
    if (urlLower.includes('/blog') || titleLower.includes('blog')) return 'blog';
    if (urlLower.includes('/products') || titleLower.includes('products')) return 'products';
    if (urlLower.includes('/pricing') || titleLower.includes('pricing')) return 'pricing';
    if (urlLower.includes('/faq') || titleLower.includes('faq') || contentLower.includes('frequently asked')) return 'faq';
    if (urlLower.includes('/testimonials') || titleLower.includes('testimonials')) return 'testimonials';
    if (urlLower.includes('/careers') || titleLower.includes('careers')) return 'careers';
    if (urlLower.includes('/booking') || titleLower.includes('booking')) return 'booking';
    if (urlLower.includes('/quote') || titleLower.includes('quote')) return 'quote';

    // Content-based detection
    if (contentLower.includes('book now') || contentLower.includes('schedule')) return 'booking';
    if (contentLower.includes('testimonial') || contentLower.includes('review')) return 'testimonials';
    if (contentLower.includes('job') || contentLower.includes('position')) return 'careers';
    if (contentLower.includes('question') || contentLower.includes('answer')) return 'faq';

    return undefined;
  }

  private extractMainContent($: CheerioAPI): string {
    // Try to find main content in semantic order
    const main = $('main').text().trim();
    if (main) return main;

    const article = $('article').text().trim();
    if (article) return article;

    const content = $('.content, #content, [role="main"]').text().trim();
    if (content) return content;

    // Fallback to body but remove common noise
    $('header, nav, footer, script, style, .navbar, .cookie-banner, .ads, .advertisement, .sidebar, .menu, .comments').remove();
    return $('body').text().trim();
  }

  private extractInternalLinks($: CheerioAPI, baseUrl: URL): string[] {
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

  private async detectAccessError(page: Page, response: HTTPResponse | null): Promise<{ isError: boolean; reason: string }> {
    if (!response) return { isError: false, reason: '' };

    const status = response.status();
    const headers = response.headers();
    const body = await page.content();

    // Check for WAF and bot protection headers
    const wafHeaders = [
      'cf-ray',
      'x-sucuri-block',
      'x-cf-ray',
      'x-cdn-pop',
      'x-cdn',
      'x-waf',
      'x-shield',
      'x-akamai-transformed',
      'x-akamai-gtm'
    ];

    const hasWafHeader = wafHeaders.some(header => headers[header.toLowerCase()]);
    if (hasWafHeader) {
      return { isError: true, reason: 'WAF protection detected' };
    }

    // Check for common bot detection strings in body
    const botDetectionStrings = [
      'access denied',
      'request blocked',
      'verify you\'re human',
      'please complete the security check',
      'security check',
      'captcha',
      'cloudflare',
      'akamai',
      'sucuri',
      'imperva',
      'distil',
      'shield',
      'protection'
    ];

    const lowerBody = body.toLowerCase();
    if (botDetectionStrings.some(str => lowerBody.includes(str))) {
      return { isError: true, reason: 'Bot detection triggered' };
    }

    // Check for suspicious meta tags
    const metaRobots = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="robots"]');
      return meta ? meta.getAttribute('content') : null;
    });

    if (metaRobots?.toLowerCase().includes('noindex')) {
      return { isError: true, reason: 'Page marked as noindex' };
    }

    // Check for fallback page indicators
    const fallbackIndicators = [
      'error page',
      'access denied',
      'not available',
      'temporarily unavailable',
      'maintenance',
      'under construction'
    ];

    if (fallbackIndicators.some(str => lowerBody.includes(str))) {
      return { isError: true, reason: 'Fallback page detected' };
    }

    // Check for suspiciously short content
    const contentLength = await page.evaluate(() => document.body.textContent?.length || 0);
    if (contentLength < 100) {
      return { isError: true, reason: 'Suspiciously short content' };
    }

    return { isError: false, reason: '' };
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      const viewport = await page.viewport();
      if (!viewport) return;

      for (let i = 0; i < 5; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        await page.mouse.move(x, y, { steps: 25 });
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      }

      // Random scrolling
      await page.evaluate(() => {
        window.scrollTo({
          top: Math.random() * document.body.scrollHeight,
          behavior: 'smooth'
        });
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate reading behavior
      await page.evaluate(() => {
        const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
        if (elements.length > 0) {
          const randomElement = elements[Math.floor(Math.random() * elements.length)];
          randomElement.scrollIntoView({ behavior: 'smooth' });
        }
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn('Error during human behavior simulation:', error);
    }
  }

  private async fetchPageContent(url: string): Promise<PageContent | null> {
    await this.delay();
    await this.initBrowser();

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      const page = await this.browser!.newPage();
      try {
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113 Safari/537.36');
        await page.setJavaScriptEnabled(true);

        // Set viewport to a common desktop size
        await page.setViewport({ width: 1920, height: 1080 });

        // Enable JavaScript and set additional headers
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        });

        // Set up response interception for error handling
        let mainResponse: HTTPResponse | null = null;
        page.on('response', (res: HTTPResponse) => {
          if (res.url() === url && !mainResponse) {
            mainResponse = res;
          }
        });

        // Navigate with retry logic and wait for network idle
        try {
          await page.goto(url, { 
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 60000 
          });

          // Simulate human behavior after page load
          await this.simulateHumanBehavior(page);
        } catch (error) {
          console.warn(`Navigation failed for ${url} on attempt ${attempt + 1}:`, error);
          await page.close();
          continue; // Retry
        }

        // Check for access errors and fallback pages
        const accessError = await this.detectAccessError(page, mainResponse);
        if (accessError.isError) {
          console.warn(`Access error on ${url}: ${accessError.reason}`);
          await page.close();
          this.crawlSession.failedPages++;
          this.crawlSession.errors.push({ url, error: accessError.reason });
          return null;
        }

        // Get the rendered HTML
        const html = await page.content();
        const $ = cheerio.load(html);
        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';
        const content = this.extractMainContent($).trim();

        if (!content) {
          console.warn(`No content found at ${url}`);
          await page.close();
          return null;
        }

        const contentHash = this.generateContentHash(content);
        if (this.contentHashes.has(contentHash)) {
          console.warn(`Duplicate content detected at ${url}`);
          await page.close();
          return null;
        }

        this.contentHashes.add(contentHash);

        // Extract links from the full HTML
        const links = this.extractInternalLinks($, this.baseUrl);

        // Detect category using OpenAI service
        const category = await detectPageCategory(url, title, content);

        // Save debug files
        const safeUrl = encodeURIComponent(url).replace(/%/g, '_');
        const debugPath = `/tmp/debug/${this.config.businessId}/${safeUrl}`;
        const screenshotPath = `${debugPath}.png`;
        const htmlPath = `${debugPath}.html`;

        try {
          await page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
          });
          
          await this.saveDebugFile(htmlPath, html);
        } catch (error) {
          console.warn(`Failed to save debug files for ${url}:`, error);
        }

        await page.close();

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
            status: 'success' as const,
            debugFiles: {
              screenshot: screenshotPath,
              html: htmlPath
            }
          }
        };
      } catch (error) {
        console.error(`Error scraping ${url} on attempt ${attempt + 1}:`, error);
        await page.close();
        
        // Handle specific HTTP errors and access issues
        if (error instanceof Error) {
          if (error.message.includes('Access error:')) {
            console.warn(`Access error for ${url}: ${error.message}`);
            return null;
          }
          if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
            console.warn(`Access forbidden for ${url}, skipping...`);
            return null;
          }
          if (error.message.includes('HTTP 404')) {
            console.warn(`Page not found for ${url}, skipping...`);
            return null;
          }
          if (error.message.includes('HTTP 429')) {
            console.warn(`Rate limited for ${url}, waiting longer before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
            continue;
          }
          if (error.message.includes('HTTP 503')) {
            console.warn(`Service unavailable for ${url}, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }

        if (attempt === this.config.maxRetries! - 1) {
          this.crawlSession.failedPages++;
          this.crawlSession.errors.push({ url, error: 'Failed after max retries' });
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    return null;
  }

  private async saveDebugFile(path: string, content: string): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const dir = path.dirname(path);
      await fs.promises.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.promises.writeFile(path, content, 'utf8');
    } catch (error) {
      console.error(`Failed to save debug file ${path}:`, error);
    }
  }

  private async crawlPage(url: string): Promise<PageContent[]> {
    const queue: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const results: PageContent[] = [];
    const processedUrls = new Set<string>();
    const limit = pLimit(this.config.concurrency!);

    while (queue.length > 0 && this.visitedUrls.size < this.config.maxPages!) {
      const batch = queue.splice(0, this.config.concurrency!);
      const batchResults = await Promise.allSettled(
        batch.map(({ url: currentUrl, depth }) => 
          limit(async () => {
            const canonicalUrl = this.canonicalizeUrl(currentUrl);
            if (depth >= this.config.maxDepth! || processedUrls.has(canonicalUrl)) {
              return null;
            }

            processedUrls.add(canonicalUrl);
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
                this.crawlSession.errors.push({
                  url: canonicalUrl,
                  error: 'Failed to fetch page content'
                });
                return null;
              }

              const category = await detectPageCategory(canonicalUrl, pageContent.title, pageContent.content);
              if (category) {
                this.crawlSession.categories[category] = (this.crawlSession.categories[category] || 0) + 1;
              }

              this.crawlSession.successfulPages++;
              const result = {
                ...pageContent,
                category,
                metadata: {
                  ...pageContent.metadata,
                  depth,
                  status: 'success' as const
                }
              };

              // Enqueue new links if we haven't reached max depth or pages
              if (depth + 1 < this.config.maxDepth! && this.visitedUrls.size < this.config.maxPages!) {
                for (const link of pageContent.links) {
                  const canonicalLink = this.canonicalizeUrl(link);
                  if (!processedUrls.has(canonicalLink) && !queue.some(item => item.url === canonicalLink)) {
                    queue.push({ url: link, depth: depth + 1 });
                  }
                }
              }

              return result;
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
    }

    this.crawlSession.totalPages = this.visitedUrls.size;
    return results;
  }

  public async start(): Promise<CrawlSessionData> {
    try {
      const isAllowed = await this.validateAndCheckRobots();
      if (!isAllowed) {
        throw new Error(`Crawling disallowed by robots.txt for ${this.config.websiteUrl}`);
      }

      const documents = await this.crawlPage(this.config.websiteUrl);
      this.crawlSession.endTime = Date.now();

      // Store crawl session metadata using the model
      const session = await CrawlSessionModel.add(this.crawlSession);

      await this.embeddingService.createEmbeddings(documents);
      return this.crawlSession;
    } catch (error) {
      this.crawlSession.endTime = Date.now();
      this.crawlSession.errors.push({
        url: this.config.websiteUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }
}

export async function setupBusinessAiBot(config: WebsiteCrawlConfig, progressCallback?: (progress: CrawlProgress) => void) {
  const crawler = new WebsiteCrawler(config, progressCallback);
  return await crawler.start();
}

