import { CategorizedSection, ContentChunk } from '../../config';
import { normalizeText, splitIntoSentences } from '../../utils';

interface Sentence {
  text: string;
  confidence: number;
}

export function createChunksForEmbeddings(
  categorizedSections: CategorizedSection[],
  category: string,
  chunkSize: number
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let currentConfidence = 0;
  let chunkCount = 0;

  const sentences = extractSentences(categorizedSections, category);
  return createChunksFromSentences(sentences, chunkSize);
}

function extractSentences(categorizedSections: CategorizedSection[], category: string): Sentence[] {
  const sentences: Sentence[] = [];
  const originalSections = categorizedSections.filter(s => normalizeText(s.category) === category);
  
  for (const section of originalSections) {
    const sectionText = `[Confidence: ${section.confidence.toFixed(2)}] ${section.content}`;
    const sectionSentences = splitIntoSentences(sectionText).map(s => ({ 
      text: s, 
      confidence: section.confidence 
    }));
    sentences.push(...sectionSentences);
  }

  return sentences;
}

function createChunksFromSentences(sentences: Sentence[], chunkSize: number): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let currentConfidence = 0;
  let chunkCount = 0;

  for (const sentence of sentences) {
    if ((currentChunk + (currentChunk ? ' ' : '') + sentence.text).length > chunkSize) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          confidence: currentConfidence / chunkCount
        });
      }
      currentChunk = sentence.text;
      currentConfidence = sentence.confidence;
      chunkCount = 1;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${sentence.text}` : sentence.text;
      currentConfidence += sentence.confidence;
      chunkCount++;
    }
  }

  // Add the last chunk if it exists
  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      confidence: currentConfidence / chunkCount
    });
  }

  return chunks;
} 