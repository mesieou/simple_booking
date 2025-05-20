import { pushToQueue } from '@/lib/helpers/openai/rate-limiter';
import { categorizeWebsiteContent } from '@/lib/helpers/openai/openai-helpers';
import { CategorizedContent } from './types';

// Helper to split text into chunks with overlap
function splitTextIntoChunks(text: string, maxWords: number, overlapWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + maxWords);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }
  return chunks;
}

export async function textSplitterAndCategoriser(
  texts: string[],
  businessId: string,
  urls: string[], // one per text, or a single url for all
  chunkSize = 2000,
  chunkOverlap = 100,
  gptConcurrency = 5
): Promise<CategorizedContent[]> {
  function categorizeInQueue(text: string, businessId: string, url: string) {
    return new Promise<CategorizedContent[]>((resolve, reject) => {
      pushToQueue(async () => {
        try {
          const result = await categorizeWebsiteContent(text, businessId, url);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  let idx = 0;
  const categorizedSections: CategorizedContent[] = [];
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= texts.length) break;
      const text = texts[i];
      const url = Array.isArray(urls) ? urls[i] : urls;
      if (!text) continue;
      const wordCount = text.split(/\s+/).length;
      let chunks: string[];
      if (wordCount > chunkSize) {
        chunks = splitTextIntoChunks(text, chunkSize - chunkOverlap, chunkOverlap);
      } else {
        chunks = [text];
      }
      const chunkPromises = chunks.map(chunkText =>
        categorizeInQueue(chunkText, businessId, url)
      );
      try {
        const allChunkResults = await Promise.all(chunkPromises);
        for (const categorized of allChunkResults) {
          categorizedSections.push(...categorized);
        }
      } catch (e) {
        // Log or handle error
      }
    }
  }
  await Promise.all(Array.from({ length: gptConcurrency }, () => worker()));
  return categorizedSections;
} 