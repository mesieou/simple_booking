import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/bot/content-crawler/pdf/extractor";
import { createEmbeddingsFromCategorizedSections } from "@/lib/bot/content-crawler/embeddings";
import { textSplitterAndCategoriser } from "@/lib/bot/content-crawler/text-splitter-categoriser";

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);

  const businessId = formData.get("businessId") as string;
  const url = formData.get("url") as string;
  // Use the modularized categorization function
  const categorized = await textSplitterAndCategoriser([text], businessId, [url], 2000, 100, 5);
  await createEmbeddingsFromCategorizedSections(
    businessId,
    url,
    categorized,
    1000, // chunk size
    3,    // concurrency
    1,    // totalPages
    [url]
  );

  return NextResponse.json({ text, categorized });
}; 