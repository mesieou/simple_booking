export function updateCrawlResults(crawlResults: any[], url: string, cleanedText: string | null, pageLang: string, reason: string) {
  const value = cleanedText ? cleanedText.length : 0;
  const embedded = !!cleanedText && cleanedText.length > 40;
  crawlResults.push({ url, status: embedded ? 'crawled' : 'skipped', reason, detectedLanguage: pageLang, embedded, value });
} 