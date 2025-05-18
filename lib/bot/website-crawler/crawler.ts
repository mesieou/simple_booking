import { SimpleCrawlConfig, SimpleCrawlResult } from './types';
import { extractAndCleanContent, deduplicateParagraphs, sendMergedTextToGpt4Turbo } from './content-processor';
import { getAllDomainLinksRecursive } from './url-fetcher';
import { createEmbeddingsFromCategorizedSections } from './embeddings';
import { VALID_CATEGORIES } from './types';
import fs from 'fs';

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export interface ExtendedCrawlConfig extends SimpleCrawlConfig {
  categorizedSections?: any[];
  chunkSize?: number;
  concurrencyLimit?: number;
}

// Utility: Split text into chunks by word count with overlap
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

export async function crawlAndMergeText(config: SimpleCrawlConfig): Promise<SimpleCrawlResult & { embeddingsStatus?: string }> {
  // Ensure output directory exists before any file writes
  if (!fs.existsSync('crawl-output')) fs.mkdirSync('crawl-output');
  const urls = await getAllDomainLinksRecursive(
    config.websiteUrl,
    config.maxPages || 100,
    1 // Sequential for easier logging
  );
  const allTexts: string[] = [];
  const concurrency = 1;
  let idx = 0;

  // Concurrency-limited worker pool for fetching and extracting text
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;
      const url = urls[i];
      const html = await fetchHtml(url);
      if (!html) continue;
      const text = extractAndCleanContent(html);
      console.log(`\n--- Cleaned content for: ${url} ---\n${text}\n--- END ---\n`);
      fs.writeFileSync(`crawl-output/page-${i+1}-cleaned.txt`, text, 'utf8');
      if (text && text.length > 40) {
        allTexts.push(text);
      }
      if (config.requestDelay) {
        await new Promise(res => setTimeout(res, config.requestDelay));
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  // Print word and token count for input
  const inputWords = allTexts.reduce((acc, t) => acc + t.split(/\s+/).length, 0);
  const inputTokens = Math.round(inputWords * 1.33); // rough estimate
  console.log(`[Crawl] Total input to GPT-4-turbo: ${inputWords} words, ~${inputTokens} tokens (across ${allTexts.length} pages)`);

  // Strict prompt: process each page individually, collect all categorized outputs
  const gptConcurrency = 1;
  let gptIdx = 0;
  const categorizedSections: any[] = [];
  async function gptWorker() {
    while (true) {
      const i = gptIdx++;
      if (i >= allTexts.length) break;
      const pageText = allTexts[i];
      if (!pageText) continue;
      // Chunking logic: if pageText is very long, split and process each chunk
      const wordCount = pageText.split(/\s+/).length;
      let chunks: string[];
      if (wordCount > 2000) {
        chunks = splitTextIntoChunks(pageText, 1500, 100);
        console.log(`[Crawl] Page ${i+1} is large (${wordCount} words), splitting into ${chunks.length} chunks.`);
      } else {
        chunks = [pageText];
      }
      let allChunkResults: any[] = [];
      for (let c = 0; c < chunks.length; c++) {
        const chunkText = chunks[c];
        const fullPrompt = `The following is visible content extracted from a business website. Your job is to analyze the full text and divide it into logical sections. For each section, return:\n\n- "category": one of the following, written EXACTLY as shown (case, spaces, and punctuation must match):\n${VALID_CATEGORIES.map(cat => `  - "${cat}"`).join('\\n')}\n\nDo NOT invent new categories. If content does not fit any, use the closest match from the list above.\n- "content": the full, detailed text of the section (do NOT omit or summarize any details)\n- "confidence": a score from 0.5 to 1.0 based on how well the content fits the chosen category\n\nIMPORTANT:\n- You MUST categorize ALL content. Do NOT skip, omit, or summarize any information, even if it seems repetitive or unimportant.\n- Do NOT repeat or duplicate the same information in multiple sections. Each piece of information should appear only once, in the most appropriate category.\n- If content fits multiple categories, include it in the most relevant one, but do NOT copy it to others.\n- The output will be used for a customer assistant. Missing details will degrade its performance.\n- Be as granular as needed to ensure every piece of information is included in some section.\n- If a section touches multiple themes, choose the dominant one but do NOT drop any details.\n- Do not skip generic layout/footer/header content unless it is truly boilerplate (e.g. copyright, navigation links).\n- Do NOT summarize or compress content. Include all original details.\n- Do Not add any information that is not in the text.\n\nReturn a valid JSON array like this:\n\n[\n  {\n    "category": "faq",\n    "content": "How long does it take... You need to keep receipts for 5 years...",\n    "confidence": 0.95\n  }\n]\n\nHere is all the cleaned text content from the site (ID: ${config.businessId}, URL: ${config.websiteUrl}):\n\n${chunkText}`;
        console.log(`\n--- RAW PROMPT TO GPT FOR PAGE ${i+1} CHUNK ${c+1}/${chunks.length} ---\n${fullPrompt}\n--- END PROMPT ---\n`);
        fs.writeFileSync(`crawl-output/page-${i+1}-chunk-${c+1}-prompt.txt`, fullPrompt, 'utf8');
        try {
          const gptCategorized = await sendMergedTextToGpt4Turbo(chunkText, config.businessId, config.websiteUrl);
          console.log(`\n--- RAW REPLY FROM GPT FOR PAGE ${i+1} CHUNK ${c+1}/${chunks.length} ---\n${gptCategorized}\n--- END REPLY ---\n`);
          fs.writeFileSync(`crawl-output/page-${i+1}-chunk-${c+1}-reply.txt`, gptCategorized, 'utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(gptCategorized);
          } catch (e) {
            // Try to extract JSON array from output using regex
            console.error(`[Crawl] JSON parse error (page ${i+1} chunk ${c+1}), attempting to extract JSON array...`);
            const match = gptCategorized.match(/\[[\s\S]*\]/);
            if (match) {
              try {
                parsed = JSON.parse(match[0]);
                console.log(`[Crawl] Successfully extracted JSON array from output (page ${i+1} chunk ${c+1}).`);
              } catch (e2) {
                console.error(`[Crawl] Failed to parse extracted JSON array (page ${i+1} chunk ${c+1}):`, match[0]);
              }
            } else {
              console.error(`[Crawl] No JSON array found in output (page ${i+1} chunk ${c+1}).`);
            }
          }
          if (parsed) {
            allChunkResults.push(...parsed);
            const categories = parsed.map((s: any) => s.category);
            console.log(`[Crawl] Parsed categories (page ${i+1} chunk ${c+1}):`, categories);
          } else {
            console.error(`[Crawl] Skipping page ${i+1} chunk ${c+1} due to invalid JSON output.`);
          }
        } catch (e) {
          console.error(`[Crawl] Error processing page ${i+1} chunk ${c+1}:`, e);
        }
      }
      // Merge all chunk results for this page
      categorizedSections.push(...allChunkResults);
    }
  }
  await Promise.all(Array.from({ length: gptConcurrency }, () => gptWorker()));

  let embeddingsStatus;
  try {
    await createEmbeddingsFromCategorizedSections(
      config.businessId,
      config.websiteUrl,
      categorizedSections // use defaults for chunkSize and concurrencyLimit
    );
    embeddingsStatus = 'success';
  } catch (e) {
    embeddingsStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    mergedText: allTexts.join('\n\n'),
    pageCount: urls.length,
    uniqueParagraphs: allTexts.length,
    businessId: config.businessId,
    websiteUrl: config.websiteUrl,
    ...(embeddingsStatus ? { embeddingsStatus } : {})
  };
} 