import * as cheerio from 'cheerio';
import { PDFDocument } from 'pdf-lib';
import { detectLanguage, generateContentHash } from './utils';
import { PageContent } from './types';
import { detectPageCategory } from '@/lib/helpers/openai';
import { getLinks } from './url-fetcher';

export function cleanContent(content: string): string {
  return content
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .trim();
}

export function extractMainContent($: cheerio.CheerioAPI): string {
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

export async function processPdfContent(url: string, arrayBuffer: ArrayBuffer, businessId: string): Promise<PageContent | null> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Extract text from all pages
  let content = '';
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    content += `Page ${i + 1}: ${width}x${height}\n`;
  }
  
  // Get PDF metadata
  const title = pdfDoc.getTitle() || 
               decodeURIComponent(new URL(url).pathname.replace(/\//g, ' ').trim()) || 
               'Untitled PDF';
  
  // Clean and trim content
  const cleanedContent = cleanContent(content);

  if (!cleanedContent) {
    console.warn(`No content found in PDF at ${url}`);
    return null;
  }

  // Skip non-English content
  const language = detectLanguage(url, cleanedContent);
  if (language !== 'en') {
    console.warn(`Skipping non-English PDF at ${url} (detected language: ${language})`);
    return null;
  }

  const contentHash = generateContentHash(cleanedContent, language);
  const category = await detectPageCategory(url, title, cleanedContent, 'general');

  return {
    url,
    title,
    content: cleanedContent,
    category,
    contentHash,
    links: [], // PDFs don't have links
    businessId,
    metadata: {
      crawlTimestamp: Date.now(),
      depth: 0,
      status: 'success',
      language: 'en',
      originalUrl: url,
      fileType: 'pdf'
    }
  };
}

export async function processHtmlContent(url: string, html: string, businessId: string): Promise<PageContent | null> {
  const $ = cheerio.load(html) as cheerio.CheerioAPI;
  
  // Check HTML lang attribute
  const htmlLang = $('html').attr('lang')?.toLowerCase();
  if (htmlLang && !htmlLang.startsWith('en')) {
    console.warn(`Skipping non-English page at ${url} (HTML lang: ${htmlLang})`);
    return null;
  }

  // Get valid links first
  const links = await getLinks(url);
  
  const title = $('title').text().trim() || 
               $('h1').first().text().trim() || 
               decodeURIComponent(new URL(url).pathname.replace(/\//g, ' ').trim()) || 
               'Untitled Page';
  
  // Clean and trim content
  const content = cleanContent(extractMainContent($));

  if (!content) {
    console.warn(`No content found at ${url}`);
    return null;
  }

  // Skip non-English content
  const language = detectLanguage(url, content);
  if (language !== 'en') {
    console.warn(`Skipping non-English page at ${url} (detected language: ${language})`);
    return null;
  }

  const contentHash = generateContentHash(content, language);
  const category = await detectPageCategory(url, title, content, 'general');

  return {
    url,
    title,
    content,
    category,
    contentHash,
    links,
    businessId,
    metadata: {
      crawlTimestamp: Date.now(),
      depth: 0,
      status: 'success',
      language: 'en',
      originalUrl: url,
      fileType: 'html'
    }
  };
} 