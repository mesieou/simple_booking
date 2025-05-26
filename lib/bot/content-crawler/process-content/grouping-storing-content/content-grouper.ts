import { CategorizedSection, GroupedContent, Category, CATEGORY_DISPLAY_NAMES } from '../../config';
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
    const categoryName = CATEGORY_DISPLAY_NAMES[section.category];
    if (!categorizedContent[categoryName]) {
      categorizedContent[categoryName] = [];
      paragraphHashes[categoryName] = new Set();
    }
    const paragraphs = section.content.split(/\n{2,}/);
    for (let para of paragraphs) {
      const norm = normalizeText(para);
      if (norm.length < 40) continue; // Skip very short paragraphs
      const hash = hashParagraph(norm);
      if (!paragraphHashes[categoryName].has(hash)) {
        paragraphHashes[categoryName].add(hash);
        categorizedContent[categoryName].push(para.trim());
      }
    }
  }

  return { categorizedContent, paragraphHashes };
} 