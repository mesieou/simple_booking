import { Mutex } from 'async-mutex';

export interface ProcessingStats {
  totalUrls: number;
  processedUrls: string[];
  filteredUrls: { url: string; reason: string }[];
  skippedUrls: { url: string; reason: string }[];
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  skippedChunks: number;
  totalCategories: number;
  processedCategories: number;
  failedCategories: number;
  skippedCategories: number;
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  totalEmbeddings: number;
  processedEmbeddings: number;
  failedEmbeddings: number;
  startTime: number;
  baseOutputPath?: string; // Retained from original logger
}

export class LoggerStatsManager {
  public stats: ProcessingStats;
  private readonly statsMutex: Mutex;

  constructor(baseOutputPath?: string) {
    this.statsMutex = new Mutex();
    this.stats = {
      totalUrls: 0,
      processedUrls: [],
      filteredUrls: [],
      skippedUrls: [],
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      skippedChunks: 0,
      totalCategories: 0,
      processedCategories: 0,
      failedCategories: 0,
      skippedCategories: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      totalEmbeddings: 0,
      processedEmbeddings: 0,
      failedEmbeddings: 0,
      startTime: Date.now(),
      baseOutputPath: baseOutputPath,
    };
  }

  public async getStatsSnapshot(): Promise<ProcessingStats> {
    return this.statsMutex.runExclusive(() => JSON.parse(JSON.stringify(this.stats))); // Deep copy
  }

  public async setTotalUrls(count: number): Promise<void> { 
    await this.statsMutex.runExclusive(() => { this.stats.totalUrls = count; });
  }
  public async addProcessedUrl(url: string, chunkCount: number): Promise<void> {
    await this.statsMutex.runExclusive(() => {
        this.stats.processedUrls.push(url);
        if (chunkCount > 0) this.stats.totalChunks += chunkCount;
    });
  }
  public async addFilteredUrl(url: string, reason: string): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.filteredUrls.push({url, reason}); });
  }
  public async addSkippedUrl(url: string, reason: string): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.skippedUrls.push({url, reason}); });
  }

  public async setTotalChunks(count: number): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.totalChunks = count; });
  }
  public async incrementProcessedChunks(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.processedChunks++; });
  }
  public async incrementFailedChunks(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.failedChunks++; });
  }
  public async incrementSkippedChunks(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.skippedChunks++; });
  }

  public async incrementTotalCategories(): Promise<void> { 
    await this.statsMutex.runExclusive(() => { this.stats.totalCategories++; }); 
  }
  public async incrementProcessedCategories(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.processedCategories++; });
  }
  public async incrementFailedCategories(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.failedCategories++; });
  }
  public async incrementSkippedCategories(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.skippedCategories++; });
  }

  public async incrementTotalDocuments(): Promise<void> { 
    await this.statsMutex.runExclusive(() => { this.stats.totalDocuments++; }); 
  }
  public async incrementProcessedDocuments(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.processedDocuments++; });
  }
  public async incrementFailedDocuments(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.failedDocuments++; });
  }

  public async incrementTotalEmbeddings(): Promise<void> { 
    await this.statsMutex.runExclusive(() => { this.stats.totalEmbeddings++; }); 
  }
  public async incrementProcessedEmbeddings(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.processedEmbeddings++; });
  }
  public async incrementFailedEmbeddings(): Promise<void> {
    await this.statsMutex.runExclusive(() => { this.stats.failedEmbeddings++; });
  }
} 