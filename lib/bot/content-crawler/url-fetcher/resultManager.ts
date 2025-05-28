import { URL_FETCHER_CONFIG, CrawlResult, CrawlResultStatus, ExtractedPatterns } from '@/lib/config/config';
import crypto from 'crypto';

export function updateCrawlResults(
  crawlResults: CrawlResult[], 
  documentUrl: string, 
  cleanedText: string | null,
  pageLang: string, 
  reason: string,
  fullUrl?: string,
  extractedPatterns?: ExtractedPatterns | null,
  pageTitle?: string | null
) {
  const value = cleanedText ? cleanedText.length : 0;
  const embedded = !!cleanedText && value > URL_FETCHER_CONFIG.MIN_CONTENT_LENGTH;
  
  // For content signature, use the cleanedText string directly.
  const contentSignature = cleanedText ? crypto.createHash('sha256').update(cleanedText).digest('hex') : null;
  // Note: If using generateContentHash from utils.ts, it normalizes text first.
  // For consistency, might want to use that or ensure this direct hash is what's needed for de-duplication.
  // For now, direct hash of cleanedText.

  let status: CrawlResultStatus;

  // Determine status based on reason
  if (reason === 'ok') {
    status = 'processed';
  } else if (reason === 'skipped - duplicate content') {
    status = 'skipped_duplicate';
  } else if (reason === 'skipped - robots.txt' || reason === 'disallowed by robots.txt') {
    status = 'skipped_robots';
  } else if (reason === 'fetch raw HTML failed') {
    status = 'skipped_fetch_error';
  } else if (reason === 'cleaning failed or content empty after clean') {
    status = 'skipped_cleaning_error';
  } else {
    // Default to skipped_other for any other reasons
    // This also covers cases previously 'crawled' which might have been intermediate.
    // Now, only 'processed' means it's fully ready for the next stage.
    status = 'skipped_other'; 
  }

  crawlResults.push({ 
    url: documentUrl, // This is often the base domain
    fullUrl: fullUrl || documentUrl, // This is the specific page URL
    status: status, 
    reason, 
    detectedLanguage: pageLang, 
    cleanedText: cleanedText,
    pageTitle: pageTitle || undefined,
    contentSignature: contentSignature,
    ...(extractedPatterns && { extractedPatterns: extractedPatterns }),
    embedded, 
    value 
  });
} 