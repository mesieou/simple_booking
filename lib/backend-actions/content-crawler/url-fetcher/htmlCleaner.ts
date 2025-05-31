import * as cheerio from 'cheerio';
import { HTML_CLEANER_CONFIG } from '@/lib/general-config/general-config'; // We need this for tableToMarkdown and other parts, but will disable main removal loops

// Define ExtractedPatterns first
interface ExtractedPatterns {
  emails: string[];
  phones: string[];
  copyrights: string[];
}

// UPDATED export interface for the new return type
export interface SimplifiedCleanedContentResult {
  allExtractedText: string;
  extractedPatterns: ExtractedPatterns;
}

// Define helper extractCommonPatterns before it is used
function extractCommonPatterns(text: string): ExtractedPatterns {
  const patterns: ExtractedPatterns = {
    emails: [],
    phones: [],
    copyrights: [],
  };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = text.match(emailRegex);
  if (foundEmails) {
    patterns.emails = Array.from(new Set(foundEmails));
  }

  const phoneRegex = /(\(\d{3}\)|\d{3})[- .]?\d{3}[- .]?\d{4}/g;
  const foundPhones = text.match(phoneRegex);
  if (foundPhones) {
    patterns.phones = Array.from(new Set(foundPhones));
  }

  const copyrightRegex = /(©|\(c\)|copyright)\s*\d{4}/gi;
  const foundCopyrights = text.match(copyrightRegex);
  if (foundCopyrights) {
    patterns.copyrights = Array.from(new Set(foundCopyrights.map(c => c.trim())));
  }
  return patterns;
}

/**
 * Converts an HTML table to Markdown format
 */
function tableToMarkdown($table: cheerio.Cheerio): string {
    const htmlContent = $table.html();
    if (!htmlContent) return ''; 

    const $ = cheerio.load(htmlContent); 
    const rows: string[][] = [];

    $('tr').each((_i: number, rowEl: cheerio.Element) => {
        const rowData: string[] = [];
        $(rowEl).find('th,td').each((_j: number, cellEl: cheerio.Element) => {
            rowData.push($(cellEl).text().trim().replace(/\|/g, '\\\|'));
        });
        rows.push(rowData);
    });
  
    if (rows.length === 0) return '';
  
    const header = rows[0];
    if (!header || header.length === 0) return ''; 

    const body = rows.slice(1);
    const mdTable = [
        '| ' + header.join(' | ') + ' |',
        '| ' + header.map(() => '---').join(' | ') + ' |',
        ...body.map(r => '| ' + r.join(' | ') + ' |' )
    ];
  
    return mdTable.join('\n');
}

export function cleanAndExtractMainContent(html: string): SimplifiedCleanedContentResult {
    const $ = cheerio.load(html);
    const textSegments: string[] = [];
    let hasMarkedNav = false; // Flag to track if the first NAV has been marked

    const cleanerConfig = HTML_CLEANER_CONFIG; // Keep for table conversion, but disable main removal loops

    // 1. Initial aggressive pruning - ESSENTIAL
    $('script, style, noscript, iframe, link, meta, head, area, map').remove();
    $('svg').each((_i, el) => {
        const $el = $(el);
        if (!$el.find('title').text()?.trim() && !$el.attr('aria-label')?.trim()) {
            $el.remove();
        }
    });

    // 2. Remove configured elements to be entirely stripped - USER REQUEST: MINIMAL PRUNING, SO DISABLED
    // (cleanerConfig.ELEMENTS_TO_REMOVE_ENTIRELY || []).forEach((selector: string) => {
    //     $(selector).remove();
    // });

    // 3. Remove elements matching negative patterns - USER REQUEST: MINIMAL PRUNING, SO DISABLED
    // (cleanerConfig.NEGATIVE_SELECTOR_PATTERNS || []).forEach((selector: string) => {
    //     $(selector).remove();
    // });

    // 4. Process tables to Markdown and replace them - KEEPING THIS
    $('table').each((i, el) => {
        const $table = $(el);
        const markdownTable = tableToMarkdown($table);
        if (markdownTable.trim().length > 0) {
            const placeholderId = `__table_placeholder_${i}__`;
            $table.replaceWith(`<div id="${placeholderId}">${markdownTable}</div>`);
        }
    });

    function helperEnsureLeadingNewline(segments: string[]): void {
        if (segments.length > 0 && !segments[segments.length - 1].endsWith('\n')) {
            segments.push('\n');
        }
    }

    function processNode(node: cheerio.Element): void {
        if (node.type === 'text') {
            let text = $(node).text();
            text = text.replace(/\u00A0/g, ' ').trim(); // Handle non-breaking spaces and trim current text node
            if (text.length > 0) {
                if (textSegments.length > 0) {
                    const lastSegment = textSegments[textSegments.length - 1];
                    if (!lastSegment.endsWith(' ') && !lastSegment.endsWith('\n') && !text.startsWith(' ') && !text.startsWith('.') && !text.startsWith(',')) {
                         textSegments.push(' '); // Add space if needed
                    }
                }
                textSegments.push(text);
            }
            return; 
        }

        if (node.type !== 'tag') {
            return; 
        }

        const $el = $(node);
        const tagName = node.tagName.toLowerCase();

        if ($el.attr('data-text-extracted') === 'true') {
            return; 
        }

        // Elements fully processed by their handlers (Markdown, special prefixes)
        if (tagName === 'pre') {
            helperEnsureLeadingNewline(textSegments);
            textSegments.push('```\n' + $el.text() + '\n```');
            helperEnsureLeadingNewline(textSegments); // Ensure newline after block
            $el.find('*').addBack().attr('data-text-extracted', 'true');
            return;
        }
        if (tagName === 'br') {
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }
        if (tagName === 'hr') {
            helperEnsureLeadingNewline(textSegments);
            textSegments.push('---');
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }
        if (node.attribs && node.attribs['id']?.startsWith('__table_placeholder_')) {
            helperEnsureLeadingNewline(textSegments);
            textSegments.push($el.text().trim()); // Markdown table content
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            const level = parseInt(tagName.charAt(1));
            helperEnsureLeadingNewline(textSegments);
            textSegments.push(`${ '#'.repeat(level)} `);
            $el.contents().each((_, child) => processNode(child));
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }

        if (tagName === 'li') {
            helperEnsureLeadingNewline(textSegments);
            textSegments.push(`* `);
            $el.contents().each((_, child) => processNode(child));
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }
        
        if (tagName === 'nav') {
            helperEnsureLeadingNewline(textSegments);
            if (!hasMarkedNav) {
                console.log(`[HTMLCleaner] Processing first <nav> element (outer): ${$el.attr('class') || 'no class'}`);
                hasMarkedNav = true; // Set the flag IMMEDIATELY for the first nav encountered

                textSegments.push(`[NAV_START]`);
                helperEnsureLeadingNewline(textSegments);
                $el.contents().each((_, child) => processNode(child)); // Process content for this first nav
                helperEnsureLeadingNewline(textSegments);
                textSegments.push(`[NAV_END]`);
            } else {
            }
            helperEnsureLeadingNewline(textSegments); // Ensure newline after nav block handling (applies to both cases for structure)
            $el.attr('data-text-extracted', 'true'); // Mark this nav element (first or subsequent) as processed by this handler
            return;
        }
        
        const prefixElements: Record<string, string> = {
            'form': 'FORM', 'footer': 'FOOTER', 'aside': 'ASIDE'
        };

        if (prefixElements[tagName]) {
            const marker = prefixElements[tagName];
            helperEnsureLeadingNewline(textSegments);
            textSegments.push(`[${marker}_START]`);
            helperEnsureLeadingNewline(textSegments);
            $el.contents().each((_, child) => processNode(child));
            helperEnsureLeadingNewline(textSegments);
            textSegments.push(`[${marker}_END]`);
            helperEnsureLeadingNewline(textSegments);
            $el.attr('data-text-extracted', 'true');
            return;
        }


        // Generic block element handling for newlines (div, p, section etc.)
        const genericBlockTags = [
            'p', 'div', 'section', 'article', 'main', 'header', 
            'details', 'dialog', 'figure', 'figcaption', 
            'ul', 'ol', 'dl', 'dd', 'dt', 'blockquote', 'address',
            'tr', 'th', 'td' // Table elements if not handled by tableToMarkdown (fallback)
        ];

        const isGenericBlock = genericBlockTags.includes(tagName);

        if (isGenericBlock) {
            helperEnsureLeadingNewline(textSegments);
        }
        
        $el.contents().each((_, child) => processNode(child));

        if (isGenericBlock) {
            helperEnsureLeadingNewline(textSegments);
        }
    }

    if ($('body')[0]) {
         processNode($('body')[0]);
    }

    let combinedText = textSegments.join('');
    
    if (typeof combinedText !== 'string') {
        combinedText = String(combinedText);
    }

    combinedText = combinedText.replace(/[ \t]+/g, ' '); 
    
    const textForReplace = combinedText; 
    combinedText = combinedText.replace(/ (?=\n)/g, (match, _p1, offset, stringArgFromReplace) => {
        const currentFullString = (typeof stringArgFromReplace === 'string') ? stringArgFromReplace : textForReplace;
        if (typeof currentFullString !== 'string') {
            return match; 
        }
        try {
            const relevantSubstringBeforeMatch = currentFullString.substring(0, offset);
            const preBlockMatch = relevantSubstringBeforeMatch.lastIndexOf('```');
            if (preBlockMatch !== -1) {
                const subAfterPre = currentFullString.substring(preBlockMatch + 3);
                const nextPreBlockClose = subAfterPre.indexOf('```');
                if (nextPreBlockClose === -1) { 
                    return match; 
                }
            }
            return ''; 
        } catch (e: any) { 
            return match; 
        }
    });
    
    combinedText = combinedText.replace(/\n /g, '\n'); 
    combinedText = combinedText.replace(/(\n){3,}/g, '\n\n'); 
    combinedText = combinedText.trim();

    // Line deduplication remains disabled for now
    // if (combinedText.length > 0) {
    //     const lines = combinedText.split('\n');
    //     const uniqueLines = Array.from(new Set(lines));
    //     combinedText = uniqueLines.join('\n');
    // }

    const patterns = extractCommonPatterns(combinedText);

    return {
        allExtractedText: combinedText,
        extractedPatterns: patterns,
    };
} 