import { CrawlConfig, ExtractedPatterns as CrawlExtractedPatterns, PdfExtractionResult } from '@/lib/general-config/general-config';
import { logger as globalLoggerInstance } from '@/lib/backend-actions/content-crawler/process-content/logger';
import { savePdfRawText, savePdfPageText } from '@/lib/backend-actions/content-crawler/process-content/logger-artifact-savers';
import { extractTextFromPdf } from './extractor';
import { isLowValueContent } from '../html-utils';
import { detectLanguage } from '../content-crawler-utils';

interface ProcessedPdfPage {
  pageNum: number;
  text: string;
  language: string;
  status: 'processed' | 'low_value' | 'empty';
  // extractedPatterns?: CrawlExtractedPatterns; // If we ever extract patterns from PDFs
}

export interface ProcessedPdfResult {
  basePdfSourceUrl: string; // e.g., pdf:document-1.pdf
  pdfName: string;
  status: 'success' | 'extraction_failed' | 'all_pages_empty_or_low_value';
  totalPagesFromExtraction: number;
  processedPages: ProcessedPdfPage[];
  errorMessage?: string;
}

export const processSinglePdfAndSaveArtifacts = async (
  buffer: Buffer,
  pdfName: string, // Original name for identification and artifact saving
  config: CrawlConfig
): Promise<ProcessedPdfResult> => {
  const basePdfSourceUrl = `pdf:${pdfName}`;

  let extractionResult: PdfExtractionResult;
  try {
    extractionResult = await extractTextFromPdf(buffer);
  } catch (error: any) {
    await globalLoggerInstance.logUrlSkipped(basePdfSourceUrl, `Extraction failed: ${error.message}`);
    return {
      basePdfSourceUrl,
      pdfName,
      status: 'extraction_failed',
      totalPagesFromExtraction: 0,
      processedPages: [],
      errorMessage: `Extraction failed: ${error.message}`,
    };
  }

  if (!extractionResult.text || extractionResult.text.trim() === '') {
    await globalLoggerInstance.logUrlSkipped(basePdfSourceUrl, 'Extraction resulted in no text content');
    return {
      basePdfSourceUrl,
      pdfName,
      status: 'extraction_failed', // Or a more specific "no_text_content"
      totalPagesFromExtraction: extractionResult.metadata?.pageCount || 0,
      processedPages: [],
      errorMessage: 'Extraction resulted in no text content',
    };
  }

  // Save the full raw text (logger-artifact-savers handles pathing)
  savePdfRawText(pdfName, extractionResult.text); // This is synchronous in current savers

  const pagesText = extractionResult.text.split(/\f/);
  const processedPagesResult: ProcessedPdfPage[] = [];
  let valuablePagesFound = 0;

  for (let i = 0; i < pagesText.length; i++) {
    const pageNum = i + 1;
    const rawPageText = pagesText[i];
    const trimmedPageText = rawPageText.trim();
    const pageSpecificUrlForLogging = `${basePdfSourceUrl}#page=${pageNum}`;

    if (!trimmedPageText) {
      processedPagesResult.push({ pageNum, text: '', language: 'unknown', status: 'empty' });
      continue;
    }

    savePdfPageText(pdfName, pageNum, trimmedPageText); // Synchronous in current savers

    const lowValueReason = isLowValueContent(trimmedPageText);
    if (lowValueReason) {
      processedPagesResult.push({ pageNum, text: trimmedPageText, language: 'unknown', status: 'low_value' });
      continue;
    }
    
    const langDetectionOptions = {
      importantUrls: config.importantUrlsForDetection, // Use general config fields if applicable
      urlLanguageHints: config.urlLanguageHintsForDetection,
      defaultLanguage: 'en' 
    };
    const language = detectLanguage(pageSpecificUrlForLogging, trimmedPageText, langDetectionOptions);

    processedPagesResult.push({
      pageNum,
      text: trimmedPageText,
      language,
      status: 'processed',
    });
    valuablePagesFound++;
  }

  if (valuablePagesFound === 0) {
    await globalLoggerInstance.logUrlSkipped(basePdfSourceUrl, 'All pages were empty or of low value after extraction.');
    return {
      basePdfSourceUrl,
      pdfName,
      status: 'all_pages_empty_or_low_value',
      totalPagesFromExtraction: pagesText.length,
      processedPages: processedPagesResult,
      errorMessage: 'All pages were empty or of low value.',
    };
  }
  
  await globalLoggerInstance.logUrlProcessed(basePdfSourceUrl);

  return {
    basePdfSourceUrl,
    pdfName,
    status: 'success',
    totalPagesFromExtraction: pagesText.length,
    processedPages: processedPagesResult,
  };
}; 