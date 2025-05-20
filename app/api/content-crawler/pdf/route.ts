import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/bot/content-crawler/pdf-fetcher/extractor";
import { processContent } from "@/lib/bot/content-crawler/process-content/grouping-storing-content";
import { textSplitterAndCategoriser } from "@/lib/bot/content-crawler/process-content/text-splitting-categorisation";

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);

  const businessId = formData.get("businessId") as string;
  const url = formData.get("url") as string;
  // Use the modularized categorization function
  const categorized = await textSplitterAndCategoriser([text.text], businessId, [url], 2000, 100, 5);
  await processContent(
    { businessId, websiteUrl: url },
    categorized,
    [url],
    [url]
  );

  return NextResponse.json({ text: text.text, categorized });
}; 