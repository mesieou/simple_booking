import { TextChunk, PROCESS_CONTENT_CONFIG, ExtractedPatterns } from '@/lib/config/config';
import { saveUrlChunk, savePdfPageChunk } from '../logger-artifact-savers';
import { splitIntoSentences } from '../../utils';

// Define and export the input structure for collectTextChunks
export interface TextChunkInput {
  text: string;
  pageUrl: string;
  pageLang?: string;
  pageTitle?: string;
  pageExtractedPatterns?: ExtractedPatterns;
  blockIndexInPage: number;
  totalBlocksOnPage: number;
}

/**
 * Splits a single text block into smaller chunks, preferably by sentences.
 * @param textBlock The text block to split.
 * @param maxWords Maximum words per chunk (guideline).
 * @param overlapSentences Number of sentences to overlap (if sentence splitting is used).
 * @param overlapWords Number of words to overlap (if word splitting is used as fallback).
 * @returns Array of text chunks (strings).
 */
export function splitTextBlockIntoChunks(
  textBlock: string, 
  maxWords: number, 
  overlapSentences: number, 
  overlapWords: number
): string[] {
  if (!textBlock || textBlock.trim().length === 0) {
    return [];
  }
  const minChunkWords = PROCESS_CONTENT_CONFIG.LOGGER.MIN_CHUNK_WORDS; // Use existing config

  const sentences = splitIntoSentences(textBlock);
  const chunks: string[] = [];

  // Try sentence-based chunking first
  if (sentences.length > 0) {
    let currentChunkSentences: string[] = [];
    let currentWordCount = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceWordCount = sentence.split(/\s+/).length;

      if (currentWordCount + sentenceWordCount > maxWords && currentChunkSentences.length > 0) {
        chunks.push(currentChunkSentences.join(' '));
        // Determine overlap: take last `overlapSentences` from previous chunk
        const startIndexForOverlap = Math.max(0, currentChunkSentences.length - overlapSentences);
        currentChunkSentences = currentChunkSentences.slice(startIndexForOverlap);
        currentWordCount = currentChunkSentences.join(' ').split(/\s+/).length;
      }
      currentChunkSentences.push(sentence);
      currentWordCount += sentenceWordCount;
    }
    // Add the last chunk
    if (currentChunkSentences.length > 0) {
      chunks.push(currentChunkSentences.join(' '));
    }
    
    if (chunks.length > 0) {
        return chunks.filter(c => 
            c.trim().length > PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MIN_CHUNK_LENGTH && 
            c.split(/\s+/).length >= minChunkWords // Use configured min words
        );
    }
  }

  // Fallback to word-based chunking if sentence chunking failed or produced no chunks
  const words = textBlock.split(/\s+/);
  if (words.length <= maxWords && words.length >= minChunkWords) { // Use configured min words
    return [textBlock.trim()];
  }
  if (words.length < minChunkWords) return []; // Use configured min words
  
  const wordChunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(words.length, start + maxWords);
    const chunk = words.slice(start, end).join(' ');
    if (chunk.trim().length > PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MIN_CHUNK_LENGTH) {
      wordChunks.push(chunk);
    }
    if (end === words.length) break;
    start = Math.max(0, end - overlapWords);
    if (start >= end) start = end; // Prevent infinite loop if overlapWords >= maxWords
  }
  return wordChunks.filter(c => 
      c.trim().length > PROCESS_CONTENT_CONFIG.TEXT_SPLITTER.MIN_CHUNK_LENGTH && // Keep char length too
      c.split(/\s+/).length >= minChunkWords // Use configured min words
  );
}

/**
 * Takes multiple text blocks (TextChunkInput items), splits them, and collects TextChunk objects.
 */
export async function collectTextChunks(
  items: TextChunkInput[],
  chunkSizeInWords: number, // Max words for a sub-chunk from a block
  chunkOverlapSentences: number, // For sentence-based overlap
  chunkOverlapWords: number // For word-based overlap (fallback)
): Promise<TextChunk[]> {
  const allTextChunks: TextChunk[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.text || item.text.trim().length === 0) {
      // await logger.logUrlSkipped(item.pageUrl || 'unknown_page_url', `empty text block (index ${item.blockIndexInPage})`);
      continue;
    }
    if (!item.pageUrl || typeof item.pageUrl !== 'string' || item.pageUrl.trim() === '') {
      // await logger.logUrlSkipped(item.pageUrl || 'unknown_page_url_invalid', `missing or invalid URL for text block (index ${item.blockIndexInPage})`);
      continue;
    }

    // console.log(`Processing block ${item.blockIndexInPage + 1}/${item.totalBlocksOnPage} from URL: ${item.pageUrl}`);
    const subChunks = splitTextBlockIntoChunks(item.text, chunkSizeInWords, chunkOverlapSentences, chunkOverlapWords);
    
    if (subChunks.length === 0) {
      // await logger.logUrlSkipped(item.pageUrl, `no valid sub-chunks generated for block ${item.blockIndexInPage}`);
      continue;
    }

    subChunks.forEach((chunkText, chunkInBlockIdx) => {
      const chunkData: TextChunk = {
        text: chunkText,
        sourcePageUrl: item.pageUrl,
        sourceBlockIndex: item.blockIndexInPage,
        sourcePageTitle: item.pageTitle,
        chunkInBlockIndex: chunkInBlockIdx,
        totalChunksInBlock: subChunks.length,
        pageLang: item.pageLang,
        pageExtractedPatterns: item.pageExtractedPatterns,
        metadata: {
          wordCount: chunkText.split(/\s+/).length,
          charCount: chunkText.length
        }
      };
      allTextChunks.push(chunkData);

      if (item.pageUrl.startsWith('pdf:')) {
        const pdfMarker = '#page=';
        const pageMarkerIndex = item.pageUrl.indexOf(pdfMarker);
        if (pageMarkerIndex !== -1) {
          const pdfNamePart = item.pageUrl.substring(4, pageMarkerIndex);
          const pageNumberPart = item.pageUrl.substring(pageMarkerIndex + pdfMarker.length);
          const pageNumber = parseInt(pageNumberPart, 10);
          if (!isNaN(pageNumber)) {
            // Use chunkInBlockIdx for the numerical index part
            savePdfPageChunk(pdfNamePart, pageNumber, chunkInBlockIdx, chunkText);
          } else {
            // Fallback if page number parsing fails, use chunkInBlockIdx
            saveUrlChunk(item.pageUrl, chunkInBlockIdx, chunkText); 
          }
        } else {
          // Fallback if PDF URL format is unexpected, use chunkInBlockIdx
          saveUrlChunk(item.pageUrl, chunkInBlockIdx, chunkText);
        }
      } else {
        // For regular URLs, use chunkInBlockIdx as the numerical index
        saveUrlChunk(item.pageUrl, chunkInBlockIdx, chunkText); 
      }
      // console.log(`Created sub-chunk ${chunkInBlockIdx + 1}/${subChunks.length} for block ${item.blockIndexInPage} from ${item.pageUrl}`);
    });
  }

  // console.log(`Total sub-chunks collected: ${allTextChunks.length}`);
  return allTextChunks;
} 