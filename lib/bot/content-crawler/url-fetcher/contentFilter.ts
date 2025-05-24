import fs from 'fs';
import { isLowValueContent } from '../utils';

/**
 * Filters and optionally saves content
 */
export function filterAndSaveContent(content: string, url: string, index: number, saveToFile: boolean = false): { cleanedText: string } | null {
  // Check if content is valuable
  const lowValueReason = isLowValueContent(content);
  if (lowValueReason) {
    console.log(`[Content Filter] Skipping low-value content from ${url}: ${lowValueReason}`);
    return null;
  }

  // Save to file if requested
  if (saveToFile) {
    try {
      fs.mkdirSync('crawl-output', { recursive: true });
      fs.writeFileSync(`crawl-output/page-${index+1}-cleaned.txt`, content, 'utf8');
    } catch (error) {
      console.error(`[Content Filter] Failed to save content from ${url}:`, error);
    }
  }

  return { cleanedText: content };
} 