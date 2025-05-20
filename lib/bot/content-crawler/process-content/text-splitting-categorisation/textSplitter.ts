import { TextChunk } from '../../config';

/**
 * Splits text into chunks with overlap for better context preservation
 * @param text The text to split
 * @param maxWords Maximum words per chunk
 * @param overlapWords Number of words to overlap between chunks
 * @returns Array of text chunks
 */
export function splitTextIntoChunks(text: string, maxWords: number, overlapWords: number): string[] {
  const words = text.split(/\s+/);
  // If text is short enough, return it as a single chunk
  if (words.length <= maxWords) {
    return [text];
  }
  
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

/**
 * Splits multiple texts into chunks and collects them with their metadata
 * @param texts Array of texts to split
 * @param urls Array of URLs (one per text, or single URL for all)
 * @param chunkSize Maximum words per chunk
 * @param chunkOverlap Number of words to overlap between chunks
 * @returns Array of chunks with their metadata
 */
export function collectTextChunks(
  texts: string[],
  urls: string[],
  chunkSize: number,
  chunkOverlap: number
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  
  texts.forEach((text, i) => {
    if (!text) {
      console.warn(`[Text Splitter] Empty text at index ${i}, skipping.`);
      return;
    }
    const url = Array.isArray(urls) ? urls[i] : urls;
    const chunks = splitTextIntoChunks(text, chunkSize, chunkOverlap);
    chunks.forEach(chunk => {
      allChunks.push({ text: chunk, url, textIndex: i });
    });
  });

  return allChunks;
} 