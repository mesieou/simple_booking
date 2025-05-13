import { createClient } from '@/lib/supabase/server';
import { Document } from '@/lib/models/documents';
import { Embedding } from '@/lib/models/embeddings';
import axios from 'axios';
import * as cheerio from 'cheerio';
type CheerioAPI = ReturnType<typeof cheerio.load>;
import { URL } from 'url';

export interface WebsiteCrawlConfig {
  websiteUrl: string;
  botType: 'customer-service' | 'mobile-quote-booking';
  businessId: string;
  maxDepth?: number;
  maxPages?: number;
}

export interface PageContent {
  url: string;
  title: string;
  content: string;
}

export class WebsiteCrawler {
  private visitedUrls = new Set<string>();
  private config: WebsiteCrawlConfig;
  private baseUrl: URL;

  constructor(config: WebsiteCrawlConfig) {
    this.config = {
      maxDepth: 3,
      maxPages: 10,
      ...config
    };
    this.baseUrl = new URL(config.websiteUrl);
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === this.baseUrl.hostname &&
        parsedUrl.protocol === this.baseUrl.protocol &&
        !this.visitedUrls.has(url) &&
        this.visitedUrls.size < this.config.maxPages!
      );
    } catch {
      return false;
    }
  }

  private async fetchPageContent(url: string): Promise<PageContent | null> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Remove unnecessary elements
      $('header, nav, footer, script, style, .navbar, .cookie-banner').remove();

      const title = $('title').text() || $('h1').first().text() || 'Untitled Page';
      const content = $('body').text().replace(/\s+/g, ' ').trim();

      return { url, title, content };
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      return null;
    }
  }

  private extractInternalLinks($: CheerioAPI, baseUrl: URL): string[] {
    const links: string[] = [];
    $('a[href]').each((_index: number, element: any) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.toString()).toString();
          if (this.isValidUrl(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch {}
      }
    });
    return links;
  }

  private async crawlPage(url: string, depth: number = 0): Promise<PageContent[]> {
    if (depth >= this.config.maxDepth! || this.visitedUrls.has(url)) {
      return [];
    }

    this.visitedUrls.add(url);
    const pageContent = await this.fetchPageContent(url);
    
    if (!pageContent) return [];

    const $ = cheerio.load(pageContent.content);
    const links = this.extractInternalLinks($, this.baseUrl);

    const subPageContents = await Promise.all(
      links.map(link => this.crawlPage(link, depth + 1))
    );

    return [pageContent, ...subPageContents.flat()];
  }

  private async createEmbeddings(documents: PageContent[]): Promise<void> {
    const supabase = createClient();

    for (const doc of documents) {
      const documentRecord = await Document.add({
        businessId: this.config.businessId,
        content: doc.content,
        title: doc.title,
        source: doc.url,
        type: 'website_page'
      });

      // Create text chunks for embeddings
      const chunks = this.splitTextIntoChunks(doc.content);
      
      for (const chunk of chunks) {
        await Embedding.add({
          documentId: documentRecord.id!,
          content: chunk,
          embedding: await this.generateEmbedding(chunk)
        });
      }
    }
  }

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

  private async generateEmbedding(text: string): Promise<number[]> {
    // TODO: Implement actual embedding generation
    // This is a placeholder - replace with actual embedding API call
    return new Array(384).fill(0).map(() => Math.random());
  }

  async crawl(): Promise<void> {
    const documents = await this.crawlPage(this.config.websiteUrl);
    await this.createEmbeddings(documents);
  }
}

export async function setupBusinessAiBot(config: WebsiteCrawlConfig) {
  const crawler = new WebsiteCrawler(config);
  await crawler.crawl();
}
