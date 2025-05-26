import { TextChunk } from '../../config';
import { logger } from '../logger';

/**
 * Splits text into chunks with overlap for better context preservation
 * @param text The text to split
 * @param maxWords Maximum words per chunk
 * @param overlapWords Number of words to overlap between chunks
 * @returns Array of text chunks
 */
export function splitTextIntoChunks(text: string, maxWords: number, overlapWords: number): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const words = text.split(/\s+/);
  // If text is short enough, return it as a single chunk
  if (words.length <= maxWords) {
    console.log(`Text is short enough (${words.length} words), returning as single chunk`);
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < words.length) {
    const end = Math.min(words.length, start + maxWords);
    const chunk = words.slice(start, end).join(' ');
    
    // Only add non-empty chunks
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
      console.log(`Created chunk ${chunks.length}: ${chunk.length} chars, ${chunk.split(/\s+/).length} words`);
    }
    
    if (end === words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }
  
  console.log(`Split text into ${chunks.length} chunks with ${overlapWords} word overlap`);
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
    if (!text || text.trim().length === 0) {
      const url = Array.isArray(urls) ? urls[i] : urls[0];
      logger.logUrlSkipped(url || 'unknown', 'empty text');
      return;
    }

    const url = Array.isArray(urls) ? urls[i] : urls[0];
    if (!url) {
      logger.logUrlSkipped('unknown', 'missing URL');
      return;
    }

    console.log(`Processing text from URL: ${url}`);
    const chunks = splitTextIntoChunks(text, chunkSize, chunkOverlap);
    
    if (chunks.length === 0) {
      logger.logUrlSkipped(url, 'no valid chunks generated');
      return;
    }

    chunks.forEach((chunk, chunkIndex) => {
      const chunkData = {
        text: chunk,
        url,
        textIndex: i,
        metadata: {
          chunkIndex,
          totalChunks: chunks.length,
          wordCount: chunk.split(/\s+/).length,
          charCount: chunk.length
        }
      };
      allChunks.push(chunkData);
      console.log(`Created chunk ${chunkIndex + 1}/${chunks.length} for ${url}:`, {
        wordCount: chunkData.metadata.wordCount,
        charCount: chunkData.metadata.charCount,
        preview: chunk.substring(0, 100) + '...'
      });
    });
  });

  console.log(`Total chunks collected: ${allChunks.length}`);
  return allChunks;
} 