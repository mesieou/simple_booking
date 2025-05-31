export const MARKDOWN_HEADING_REGEX = /^(# |## |### |#### |##### |###### )/;
export const MARKDOWN_LIST_ITEM_REGEX = /^(\* |- |\d+\. )/;
export const MARKDOWN_CODE_BLOCK_START_REGEX = /^```/;
export const MARKDOWN_CODE_BLOCK_END_REGEX = /^```/;
export const PARAGRAPH_BREAK_REGEX = /^\s*$/; // empty or whitespace-only lines

interface PreSplitterConfig {
  maxCharsPerChunk: number;
  // Potentially add minCharsPerChunk if we want to avoid tiny chunks from aggressive splitting
}

/**
 * Splits a large text into smaller pre-chunks based on markdown structure and a max character limit.
 * The goal is to send manageable, coherent pieces to a downstream LLM for finer semantic chunking.
 *
 * This version ensures that a heading and its immediate content are never split into separate chunks.
 * When splitting, if a split point is a heading, the heading and the lines following it up to the next heading are always kept together in the same chunk.
 *
 * @param cleanedText The full text content (e.g., from htmlCleaner).
 * @param config Configuration object with maxCharsPerChunk.
 * @returns An array of text strings, where each string is a pre-chunk.
 */
export function preSplitByMarkdownAndSize(
  cleanedText: string,
  config: PreSplitterConfig
): string[] {
  if (!cleanedText || cleanedText.trim() === '') {
    return [];
  }

  const { maxCharsPerChunk } = config;
  const chunksToSendToGpt: string[] = [];
  const textToProcessQueue: string[] = [cleanedText];

  while (textToProcessQueue.length > 0) {
    const currentText = textToProcessQueue.shift();
    if (!currentText) continue;

    if (currentText.length <= maxCharsPerChunk) {
      if (currentText.trim() !== '') {
        chunksToSendToGpt.push(currentText);
      }
      continue;
    }

    // Text is too large, needs splitting
    const lines = currentText.split('\n');
    let potentialSplitLineIndices: number[] = [];
    let isInCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track code block status
      if (MARKDOWN_CODE_BLOCK_START_REGEX.test(line)) {
        // If it's a line that's ONLY a code block start, or code block start with lang
        if (line.trim() === '```' || /^```\w*$/.test(line.trim())) {
          isInCodeBlock = !isInCodeBlock; // Toggle state
          if (!isInCodeBlock && i + 1 < lines.length) { // Just exited a code block
            potentialSplitLineIndices.push(i + 1); // Next line is a potential split point
          }
          continue; // Don't split on the ``` line itself unless it's an exit
        }
      }
      if (isInCodeBlock) {
        if (MARKDOWN_CODE_BLOCK_END_REGEX.test(line.trim())) {
            isInCodeBlock = false;
            if (i + 1 < lines.length) { // Just exited a code block
              potentialSplitLineIndices.push(i + 1); // Next line is a potential split point
            }
        }
        continue; // Don't split inside a code block content line
      }

      // Identify markdown elements as preferred split points (split *before* these)
      if (i > 0) { // Can't split before the very first line
        if (
          MARKDOWN_HEADING_REGEX.test(line) ||
          MARKDOWN_LIST_ITEM_REGEX.test(line) ||
          PARAGRAPH_BREAK_REGEX.test(line) // Split before a new paragraph (empty line)
        ) {
          // Only add as a split point if the previous line is NOT a heading (to keep heading+content together)
          if (!MARKDOWN_HEADING_REGEX.test(lines[i - 1])) {
            potentialSplitLineIndices.push(i);
          }
        }
      }
    }
    
    // Remove duplicates and sort, ensuring splits are well-defined
    potentialSplitLineIndices = Array.from(new Set(potentialSplitLineIndices)).sort((a, b) => a - b);

    let part1: string;
    let part2: string;

    if (potentialSplitLineIndices.length === 0) {
      // No markdown split points found in this oversized chunk (e.g., giant paragraph/text block)
      // Perform a forced split. Try to find a sentence end near the middle.
      let splitCharIndex = -1;
      const targetSplitIndex = Math.floor(currentText.length / 2);
      const searchRadius = Math.min(targetSplitIndex, 500); // Search for sentence end in a radius

      for (let offset = 0; offset <= searchRadius; offset++) {
        // Search backward from middle
        const backIndex = targetSplitIndex - offset;
        if (backIndex > 0 && ['.', '!', '?'].includes(currentText[backIndex -1]) && currentText[backIndex] === ' ') {
            splitCharIndex = backIndex;
            break;
        }
        // Search forward from middle
        const forwardIndex = targetSplitIndex + offset;
        if (forwardIndex < currentText.length -1 && ['.', '!', '?'].includes(currentText[forwardIndex -1]) && currentText[forwardIndex] === ' ') {
            splitCharIndex = forwardIndex;
            break;
        }
      }

      if (splitCharIndex !== -1) {
        part1 = currentText.substring(0, splitCharIndex);
        part2 = currentText.substring(splitCharIndex);
      } else {
        // Absolute fallback: hard split by character count (approximating with lines)
        const middleLine = Math.floor(lines.length / 2);
        part1 = lines.slice(0, middleLine).join('\n');
        part2 = lines.slice(middleLine).join('\n');
      }
    } else {
      // Markdown split points exist. Find the one closest to the middle of the *lines*.
      // This is a heuristic to balance chunk sizes.
      const middleLineIndex = Math.floor(lines.length / 2);
      let bestSplitLine = potentialSplitLineIndices[0];
      let smallestDiff = Math.abs(middleLineIndex - bestSplitLine);

      for (let j = 1; j < potentialSplitLineIndices.length; j++) {
        const currentDiff = Math.abs(middleLineIndex - potentialSplitLineIndices[j]);
        if (currentDiff < smallestDiff) {
          smallestDiff = currentDiff;
          bestSplitLine = potentialSplitLineIndices[j];
        }
      }
      // Ensure we do not split between a heading and its content
      // If the split line is a heading, move the split up to include the heading with its content
      if (MARKDOWN_HEADING_REGEX.test(lines[bestSplitLine])) {
        // Move split up to previous non-heading line
        let newSplit = bestSplitLine;
        while (newSplit > 0 && MARKDOWN_HEADING_REGEX.test(lines[newSplit])) {
          newSplit--;
        }
        bestSplitLine = newSplit;
      }
      part1 = lines.slice(0, bestSplitLine).join('\n');
      part2 = lines.slice(bestSplitLine).join('\n');
    }

    // Add parts to the front of the queue to re-process (they might still be too big or empty)
    if (part2 && part2.trim() !== '') textToProcessQueue.unshift(part2);
    if (part1 && part1.trim() !== '') textToProcessQueue.unshift(part1);
  }

  return chunksToSendToGpt.filter(chunk => chunk.trim() !== '');
} 