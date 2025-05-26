export function updateCrawlResults(
  crawlResults: any[], 
  documentUrl: string, 
  cleanedText: string | null, 
  pageLang: string, 
  reason: string,
  fullUrl?: string
) {
  const value = cleanedText ? cleanedText.length : 0;
  const embedded = !!cleanedText && cleanedText.length > 40;
  crawlResults.push({ 
    url: documentUrl,
    fullUrl: fullUrl || documentUrl,
    status: embedded ? 'crawled' : 'skipped', 
    reason, 
    detectedLanguage: pageLang, 
    embedded, 
    value 
  });
} 