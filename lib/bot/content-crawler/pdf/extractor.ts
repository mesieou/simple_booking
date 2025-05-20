import PDFParser from "pdf2json";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      // pdfData.formImage.Pages is the structure returned by pdf2json
      const text = (pdfData.formImage.Pages as any[])
        .map((page: any) =>
          (page.Texts as any[]).map((t: any) =>
            decodeURIComponent((t.R as any[]).map((r: any) => r.T).join(""))
          ).join(" ")
        ).join("\n");
      resolve(text);
    });
    pdfParser.parseBuffer(buffer);
  });
} 