// lib/bot/content-crawler/process-content/logger.ts
import * as fs from 'fs';
import * as path from 'path';
import { initializeArtifactSavers } from './logger-artifact-savers';

// --- Interfaces for Stats (mirroring summary.json) ---
interface SkippedUrlInfo {
  url: string;
  reason: string;
}

interface UrlLogInfo {
  url: string;
  status: 'processed' | 'skipped' | 'failed';
  reason?: string;
}

interface ProcessingStats {
  totalUrls: number;
  processedUrls: string[];
  filteredUrls: string[];
  skippedUrls: SkippedUrlInfo[];
  failedUrls: SkippedUrlInfo[];

  totalChunks: number;         // Sum of all sub-chunks generated
  processedChunks: number;     // Sub-chunks successfully processed (e.g. categorized)
  failedChunks: number;        // Sub-chunks that failed during their processing
  skippedChunks: number;       // Sub-chunks skipped (e.g. too short, before main processing)

  totalCategories: number;     // Number of chunks that yielded at least one category
  processedCategories: number; // Sum of all individual categories identified across all chunks
  failedCategorizations: number; // Number of chunks where categorization attempt failed
  // skippedCategorizations is not explicitly in summary.json, can be tracked if needed

  totalDocuments: number;      // Typically, number of chunks that became documents
  processedDocuments: number;  // Documents successfully created/stored
  failedDocuments: number;     // Documents that failed creation/storage

  totalEmbeddings: number;     // Embeddings attempted
  processedEmbeddings: number; // Embeddings successfully generated
  failedEmbeddings: number;    // Embeddings generation failed

  startTime: number;
  endTime?: number;
  baseOutputPath: string;
}

interface SummaryData {
  processingStats: ProcessingStats;
  durationSeconds?: number;
  allFoundUrls: Set<string>; // Use Set for uniqueness, convert to array for JSON
  urlLogs: UrlLogInfo[];
}

class CrawlLogger {
  private stats: SummaryData;
  private outputDir: string = '';
  private initialized: boolean = false;

  constructor() {
    this.stats = this.getInitialStats();
  }

  public get isInitialized(): boolean {
    return this.initialized;
  }

  private getInitialStats(): SummaryData {
    return {
      processingStats: {
        totalUrls: 0,
        processedUrls: [],
        filteredUrls: [],
        skippedUrls: [],
        failedUrls: [],
        totalChunks: 0,
        processedChunks: 0,
        failedChunks: 0,
        skippedChunks: 0,
        totalCategories: 0,
        processedCategories: 0,
        failedCategorizations: 0,
        totalDocuments: 0,
        processedDocuments: 0,
        failedDocuments: 0,
        totalEmbeddings: 0,
        processedEmbeddings: 0,
        failedEmbeddings: 0,
        startTime: 0,
        baseOutputPath: '',
      },
      allFoundUrls: new Set<string>(),
      urlLogs: [],
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      console.warn("[LOGGER] Logger used before initialization. Call logger.initialize() first. Defaulting baseOutputPath to './crawl-output'.");
      await this.initialize('./crawl-output'); // Default initialization
    }
  }

  public async initialize(baseOutputPath: string): Promise<void> {
    this.outputDir = baseOutputPath;
    this.stats = this.getInitialStats();
    this.stats.processingStats.startTime = Date.now();
    this.stats.processingStats.baseOutputPath = this.outputDir;

    const logsDirPath = path.join(this.outputDir, 'logs');
    if (!fs.existsSync(logsDirPath)) {
      try {
        fs.mkdirSync(logsDirPath, { recursive: true });
      } catch (error) {
        console.error(`[LOGGER] Failed to create logs directory at ${logsDirPath}:`, error);
      }
    }
    
    initializeArtifactSavers(this.outputDir);
    this.initialized = true;
    console.log(`[LOGGER] Initialized. Output path: ${this.outputDir}`);
  }

  // --- URL Tracking ---
  public async recordFoundUrl(url: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.allFoundUrls.add(url);
    this.stats.processingStats.totalUrls = this.stats.allFoundUrls.size;
  }

  public async recordDiscoveredUrls(urls: string[]): Promise<void> {
    await this.ensureInitialized();
    urls.forEach(url => this.stats.allFoundUrls.add(url));
    this.stats.processingStats.totalUrls = this.stats.allFoundUrls.size;
  }

  public async logUrlProcessed(url: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.stats.processingStats.processedUrls.includes(url)) {
        this.stats.processingStats.processedUrls.push(url);
    }
    this.stats.urlLogs.push({ url, status: 'processed' });
    console.log(`[LOGGER] URL processed: ${url}`);
  }

  public async logUrlSkipped(url: string, reason: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.skippedUrls.push({ url, reason });
    this.stats.urlLogs.push({ url, status: 'skipped', reason });
    console.warn(`[LOGGER] URL skipped: ${url} - Reason: ${reason}`);
  }

  public async logUrlFiltered(url: string, reason: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.filteredUrls.push(url);
    console.log(`[LOGGER] URL filtered: ${url} - Reason: ${reason}`);
  }

  public async logUrlFailed(url: string, reason: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.failedUrls.push({ url, reason });
    this.stats.urlLogs.push({ url, status: 'failed', reason });
    console.error(`[LOGGER] URL failed: ${url} - Reason: ${reason}`);
  }

  // --- Chunk Tracking ---
  public async addTotalChunks(count: number): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.totalChunks += count;
  }

  public async logChunkProcessed(url: string, chunkIndex?: number): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.processedChunks++;
    // console.log(`[LOGGER] Chunk ${chunkIndex !== undefined ? chunkIndex : ''} processed for URL: ${url}`);
  }
  
  public async logChunkSkipped(url: string, chunkIndex: number, reason: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.skippedChunks++;
    console.warn(`[LOGGER] Chunk ${chunkIndex} skipped for URL ${url}: ${reason}`);
  }

  public async logChunkFailed(url: string, chunkIndex: number, errorMsg: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.failedChunks++;
    console.error(`[LOGGER] Chunk ${chunkIndex} failed for URL ${url}: ${errorMsg}`);
  }

  // Dispatcher for general chunk logging, maps to specific handlers
  public async logChunk(chunkIndex: number, url: string, status: 'processed' | 'failed' | 'skipped', details: string): Promise<void> {
    await this.ensureInitialized();
    if (status === 'processed') {
      await this.logChunkProcessed(url, chunkIndex);
    } else if (status === 'failed') {
      await this.logChunkFailed(url, chunkIndex, details);
    } else if (status === 'skipped') {
      await this.logChunkSkipped(url, chunkIndex, details);
    }
  }

  // --- Categorization Tracking ---
  public async logCategorizationAttempt(): Promise<void> {
    // this.stats.processingStats.totalCategorizationTasks++; // Not in summary.json
    // Ensure initialized might be needed if this method is un-commented and does real work
    await this.ensureInitialized(); 
  }

  public async logCategorizationSuccess(chunkYieldedCategories: boolean): Promise<void> {
    await this.ensureInitialized();
    if(chunkYieldedCategories) {
        this.stats.processingStats.totalCategories++;
    }
    // `processedCategories` is incremented by `logCategoryProcessed`
  }

  public async logCategoryProcessed(categoryName: string): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.processedCategories++;
    // console.log(`[LOGGER] Category processed: ${categoryName}`);
  }

  public async logCategorizationFailed(): Promise<void> {
    await this.ensureInitialized();
    this.stats.processingStats.failedCategorizations++;
  }

  // --- Document Creation ---
  public async logDocumentCreationAttempt(): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.totalDocuments++; // Assuming totalDocuments is count of attempts
  }
  public async logDocumentCreated(): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.processedDocuments++;
  }
  public async logDocumentFailed(): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.failedDocuments++;
  }

  // --- Embedding ---
  public async logEmbeddingAttempt(count: number = 1): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.totalEmbeddings += count;
  }
  public async logEmbeddingSuccess(count: number = 1): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.processedEmbeddings += count;
  }
  public async logEmbeddingFailure(count: number = 1): Promise<void> {
      await this.ensureInitialized();
      this.stats.processingStats.failedEmbeddings += count;
  }

  // --- Finalization ---
  public async finalizeStatsAndSave(): Promise<void> {
    await this.ensureInitialized(); // Ensure it was initialized, even if by default path
    this.stats.processingStats.endTime = Date.now();
    this.stats.durationSeconds = parseFloat(((this.stats.processingStats.endTime - this.stats.processingStats.startTime) / 1000).toFixed(3));

    const summaryToSave = {
      processingStats: this.stats.processingStats,
      durationSeconds: this.stats.durationSeconds,
      allFoundUrls: Array.from(this.stats.allFoundUrls).sort(),
      urlLogs: this.stats.urlLogs.sort((a,b) => a.url.localeCompare(b.url)),
    };

    const summaryFilePath = path.join(this.outputDir, 'summary.json');
    try {
      // Ensure outputDir exists one last time
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      await fs.promises.writeFile(summaryFilePath, JSON.stringify(summaryToSave, null, 2));
      console.log(`[LOGGER] Summary saved to ${summaryFilePath}`);
    } catch (error) {
      console.error(`[LOGGER] Error saving summary.json at ${summaryFilePath}:`, error);
    }
    this.initialized = false; // Reset for potential reuse in same process (though typically one crawl per run)
  }

  public async logSummary(): Promise<void> {
    await this.ensureInitialized(); // Ensure it was initialized, even if by default path
    this.stats.processingStats.endTime = Date.now();
    this.stats.durationSeconds = parseFloat(((this.stats.processingStats.endTime - this.stats.processingStats.startTime) / 1000).toFixed(3));

    const summaryToSave = {
      processingStats: this.stats.processingStats,
      durationSeconds: this.stats.durationSeconds,
      allFoundUrls: Array.from(this.stats.allFoundUrls).sort(),
      urlLogs: this.stats.urlLogs.sort((a,b) => a.url.localeCompare(b.url)),
    };

    const summaryFilePath = path.join(this.outputDir, 'summary.json');
    try {
      // Ensure outputDir exists one last time
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      await fs.promises.writeFile(summaryFilePath, JSON.stringify(summaryToSave, null, 2));
      console.log(`[LOGGER] Summary saved to ${summaryFilePath}`);
    } catch (error) {
      console.error(`[LOGGER] Error saving summary.json at ${summaryFilePath}:`, error);
    }
    this.initialized = false; // Reset for potential reuse in same process (though typically one crawl per run)
  }

  public async getCurrentStats(): Promise<Readonly<SummaryData>> {
    // No need to ensureInitialized here as it's a read-only operation on current state
    // and initialize() sets up the stats object.
    return this.stats;
  }
}

export const logger = new CrawlLogger();

// You may want to integrate with a more robust logging library or service. 