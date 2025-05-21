import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/bot/content-crawler/pdf-fetcher/extractor";
import { processContent } from "@/lib/bot/content-crawler/process-content/grouping-storing-content";
import { textSplitterAndCategoriser } from "@/lib/bot/content-crawler/process-content/text-splitting-categorisation";

// Hardcoded business ID for testing
const TEST_BUSINESS_ID = "0919f2b7-9af2-4094-b8b7-f7a70a59599a";

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);

  // Use hardcoded business ID for testing
  const businessId = TEST_BUSINESS_ID;
  const url = formData.get("url") as string || "uploaded-pdf";
  
  // Use the modularized categorization function
  const categorized = await textSplitterAndCategoriser([text.text], businessId, [url], 2000, 100);
  await processContent(
    { businessId, websiteUrl: url },
    categorized,
    [url],
    [url]
  );

  return NextResponse.json({ text: text.text, categorized });
}; 