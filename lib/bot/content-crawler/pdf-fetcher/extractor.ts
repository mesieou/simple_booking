import PDFParser from "pdf2json";
import { PdfExtractionResult } from '../config';

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtractionResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        const pages = pdfData.formImage.Pages as any[];
        const text = pages
          .map((page: any) =>
            (page.Texts as any[]).map((t: any) =>
              decodeURIComponent((t.R as any[]).map((r: any) => r.T).join(""))
            ).join(" ")
          ).join("\n");

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

    pdfParser.parseBuffer(buffer);
  });
} 