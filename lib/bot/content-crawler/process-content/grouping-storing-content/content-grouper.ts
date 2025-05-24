import { CategorizedSection, GroupedContent } from '../../config';
import { normalizeText } from '../../utils';

function hashParagraph(text: string): string {
  let hash = 0, i, chr;
  if (text.length === 0) return hash.toString();
  for (i = 0; i < text.length; i++) {
    chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString();
}

export function groupContentByCategory(categorizedSections: CategorizedSection[]): GroupedContent {
  const categorizedContent: Record<string, string[]> = {};
  const paragraphHashes: Record<string, Set<string>> = {};

  for (const section of categorizedSections) {
    const category = normalizeText(section.category);
    if (!categorizedContent[category]) {
      categorizedContent[category] = [];
      paragraphHashes[category] = new Set();
    }
    const paragraphs = section.content.split(/\n{2,}/);
    for (let para of paragraphs) {
      const norm = normalizeText(para);
      if (norm.length < 40) continue; // Skip very short paragraphs
      const hash = hashParagraph(norm);
      if (!paragraphHashes[category].has(hash)) {
        paragraphHashes[category].add(hash);
        categorizedContent[category].push(para.trim());
      }
    }
  }

  return { categorizedContent, paragraphHashes };
} 