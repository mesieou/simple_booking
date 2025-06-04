import * as fs from 'fs';
import * as path from 'path';
import { URL_FETCHER_CONFIG } from '@/lib/general-config/general-config';
import { logger as globalLoggerInstance } from './process-content/logger';

/**
 * Initializes the crawler environment by:
 * 1. Deleting the existing output directory if it exists.
 * 2. Initializing the global logger.
 * 
 * This function ensures that if the logger is already initialized, it doesn't re-initialize
 * or delete the directory again, making it safe to call multiple times if needed,
 * though typically it's called once at the beginning of a crawl operation.
 */
export async function initializeCrawlerEnvironment(): Promise<void> {
  if (globalLoggerInstance.isInitialized) {
    const currentStats = await globalLoggerInstance.getCurrentStats();
    console.log(
      `[Crawl Setup] Logger already initialized. Using existing output path: ${currentStats.processingStats.baseOutputPath}`
    );
    return;
  }

  const outputDir = path.resolve(URL_FETCHER_CONFIG.CRAWL_OUTPUT_DIR);

  if (fs.existsSync(outputDir)) {
    console.log(`[Crawl Setup] Deleting existing output directory: ${outputDir}`);
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
      console.log(`[Crawl Setup] Successfully deleted ${outputDir}`);
    } catch (error) {
      console.error(`[Crawl Setup] Failed to delete ${outputDir}:`, error);
      // Decide if we should throw or attempt to continue. For now, logging error.
    }
  }

  try {
    await globalLoggerInstance.initialize(outputDir);
    console.log(`[Crawl Setup] Logger initialized. Output path: ${outputDir}`);
  } catch (error) {
    console.error(`[Crawl Setup] Failed to initialize logger at ${outputDir}:`, error);
    // This is more critical, consider throwing to halt execution.
    throw new Error(`Logger initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 