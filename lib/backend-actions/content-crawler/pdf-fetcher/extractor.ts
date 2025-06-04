import PDFParser from "pdf2json";
import { PdfExtractionResult } from '@/lib/general-config/general-config';

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        // Check if pdfData is valid
        if (!pdfData || typeof pdfData !== 'object') {
          throw new Error('Invalid PDF data structure');
        }

        // The Pages array is directly in the root of pdfData
        const pages = pdfData.Pages;
        if (!Array.isArray(pages)) {
          throw new Error('No pages found in PDF');
        }

        const text = pages
          .map((page: any) => {
            if (!page.Texts || !Array.isArray(page.Texts)) {
              return '';
            }
            return page.Texts
              .map((t: any) => {
                if (!t.R || !Array.isArray(t.R)) {
                  return '';
                }
                return t.R
                  .map((r: any) => (r.T ? decodeURIComponent(r.T) : ''))
                  .join('');
              })
              .join(' ');
          })
          .join('\f');

        if (!text.trim()) {
          throw new Error('No text content found in PDF');
        }

        resolve({
          text,
          metadata: {
            pageCount: pages.length,
            language: 'en', // Default to English, could be enhanced with language detection
            fileType: 'pdf'
          }
        });
      } catch (error) {
        reject(new Error(`Error processing PDF data: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    try {
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      reject(new Error(`Failed to parse PDF buffer: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
} 