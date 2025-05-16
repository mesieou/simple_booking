import { setupBusinessAiBot, FastCrawlConfig } from '../lib/bot/website-crawler';

async function main() {
  try {
    console.log('Starting crawler test...');
    
    const config: FastCrawlConfig = {
      websiteUrl: 'https://example.com', // Replace with your test website
      botType: 'customer-service' as const,
      businessId: 'test-business-id', // Replace with a valid business ID
      maxPages: 5, // Small number for testing
      requestDelay: 1000, // 1 second delay between requests
      logInterval: {
        urls: 1,    // Log every URL
        seconds: 1  // Log every second
      }
    };

    const progressCallback = (progress: any) => {
      console.log('Progress:', {
        processed: progress.processedPages,
        total: progress.totalPages,
        percentage: progress.percentage.toFixed(1) + '%',
        currentUrl: progress.currentUrl,
        activePages: progress.activePages
      });
    };

    const result = await setupBusinessAiBot(config, progressCallback);
    console.log('Crawl completed:', result);
  } catch (error) {
    console.error('Error testing crawler:', error);
    process.exit(1);
  }
}

main(); 