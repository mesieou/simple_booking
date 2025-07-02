import { NextRequest, NextResponse } from "next/server";
import { crawlAndProcessPdfs } from "@/lib/backend-actions/content-crawler/pdf-crawler";
import { createPdfConfig } from "@/lib/general-config/general-config";

// Hardcoded business ID for testing
const TEST_BUSINESS_ID = "228c7e8e-ec15-4eeb-a766-d1ebee07104f";

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Use businessId from formData if provided, otherwise fallback to hardcoded one
  const businessId = (formData.get("businessId") as string) || TEST_BUSINESS_ID;
  
  // Check if this should target production database
  const targetProduction = formData.get("targetProduction") === "true";
  
  // Get the original filename from the uploaded file
  const pdfName = file.name;
  
  // Set environment flag for production targeting if requested
  if (targetProduction) {
    process.env.PDF_CRAWLER_TARGET_PRODUCTION = "true";
  }
  
  try {
    // Create config using the helper function
    const config = createPdfConfig(businessId, [pdfName]);

    // Process the PDF using the crawler
    const result = await crawlAndProcessPdfs(config, [buffer]);

    return NextResponse.json({ 
      message: 'PDF processed successfully',
      result,
      pdfName
    });
  } finally {
    // Clean up the environment flag
    if (targetProduction) {
      delete process.env.PDF_CRAWLER_TARGET_PRODUCTION;
    }
  }
}; 