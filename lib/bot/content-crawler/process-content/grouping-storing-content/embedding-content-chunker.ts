import { CategorizedSection, ContentChunk, CONFIDENCE_CONFIG } from '../../config';
import { normalizeText, splitIntoSentences, validateConfidence, meetsConfidenceThreshold, logConfidence } from '../../utils';

interface Sentence {
  text: string;
  confidence: number;
}

export function createChunksForEmbeddings(
  categorizedSections: CategorizedSection[],
  category: string,
  chunkSize: number
): ContentChunk[] {
  const sentences = extractSentences(categorizedSections, category);
  const chunks = createChunksFromSentences(sentences, chunkSize);
  
  // Log confidence scores for chunks
  chunks.forEach((chunk, index) => {
    logConfidence(category, chunk.confidence, `chunk-${index}`);
  });
  
  return chunks;
}

function extractSentences(categorizedSections: CategorizedSection[], category: string): Sentence[] {
  const sentences: Sentence[] = [];
  const originalSections = categorizedSections.filter(s => normalizeText(s.category) === category);
  
  for (const section of originalSections) {
    // Remove confidence from text content
    const sectionSentences = splitIntoSentences(section.content).map(s => ({ 
      text: s, 
      confidence: validateConfidence(section.confidence)
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
        const avgConfidence = validateConfidence(currentConfidence / chunkCount);
        if (meetsConfidenceThreshold(avgConfidence)) {
          chunks.push({
            content: currentChunk,
            confidence: avgConfidence
          });
        }
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

  // Add the last chunk if it exists and meets threshold
  if (currentChunk) {
    const avgConfidence = validateConfidence(currentConfidence / chunkCount);
    if (meetsConfidenceThreshold(avgConfidence)) {
      chunks.push({
        content: currentChunk,
        confidence: avgConfidence
      });
    }
  }

  return chunks;
} 