import { NextRequest, NextResponse } from "next/server";
import { crawlAndProcessPdfs } from "@/lib/backend-actions/content-crawler/pdf-crawler";
import { createPdfConfig } from "@/lib/general-config/general-config";

// Hardcoded business ID for testing
const TEST_BUSINESS_ID = "6c77fa8b-952e-480d-819d-3e9499e272e6";

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  
  // Use hardcoded business ID for testing
  const businessId = TEST_BUSINESS_ID;
  
  // Get the original filename from the uploaded file
  const pdfName = file.name;
  
  // Create config using the helper function
  const config = createPdfConfig(businessId, [pdfName]);

  // Process the PDF using the crawler
  const result = await crawlAndProcessPdfs(config, [buffer]);

  return NextResponse.json({ 
    message: 'PDF processed successfully',
    result,
    pdfName
  });
}; 