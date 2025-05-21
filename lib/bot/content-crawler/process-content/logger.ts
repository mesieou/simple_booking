import { CategorizedContent } from '../config';

interface ProcessingStats {
  // Crawling stats
  totalUrls: number;
  processedUrls: string[];
  filteredUrls: { url: string; reason: string }[];
  skippedUrls: { url: string; reason: string }[];

  // Chunking stats
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;

  // Categorizing stats
  totalCategories: number;
  processedCategories: number;
  failedCategories: number;

  // Document and embedding stats
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  totalEmbeddings: number;
  processedEmbeddings: number;
  failedEmbeddings: number;

  startTime: number;
}

interface UrlLog {
  url: string;
  status: 'processed' | 'filtered' | 'skipped';
  reason?: string;
}
interface ChunkLog {
  chunkId: number;
  url: string;
  status: 'processed' | 'failed';
  reason?: string;
}
interface CategoryLog {
  category: string;
  status: 'processed' | 'failed';
  reason?: string;
}
interface DocumentLog {
  docId: string;
  title: string;
  status: 'processed' | 'failed';
  reason?: string;
}
interface EmbeddingLog {
  embeddingId: string;
  docId: string;
  status: 'processed' | 'failed';
  reason?: string;
}

class ContentProcessorLogger {
  public stats: ProcessingStats;
  private lastProgressUpdate: number = 0;
  private readonly PROGRESS_UPDATE_INTERVAL = 1000; // Update progress every second
  private urlLogs: UrlLog[] = [];
  private chunkLogs: ChunkLog[] = [];
  private categoryLogs: CategoryLog[] = [];
  private documentLogs: DocumentLog[] = [];
  private embeddingLogs: EmbeddingLog[] = [];
  private allFoundUrls: string[] = [];

  constructor() {
    this.stats = {
      totalUrls: 0,
      processedUrls: [],
      filteredUrls: [],
      skippedUrls: [],
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      totalCategories: 0,
      processedCategories: 0,
      failedCategories: 0,
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      totalEmbeddings: 0,
      processedEmbeddings: 0,
      failedEmbeddings: 0,
      startTime: Date.now()
    };
  }

  public initialize(totalUrls: number): void {
    this.stats.totalUrls = totalUrls;
    console.log('\n=== Content Processing Started ===');
  }

  private shouldUpdateProgress(): boolean {
    const now = Date.now();
    if (now - this.lastProgressUpdate >= this.PROGRESS_UPDATE_INTERVAL) {
      this.lastProgressUpdate = now;
      return true;
    }
    return false;
  }

  private logProgress(stage: string, current: number, total: number): void {
    if (this.shouldUpdateProgress()) {
      const progress = Math.round((current / total) * 100);
      process.stdout.write(`\r[${stage}] ${progress}% (${current}/${total})`);
    }
  }

  public logUrlFiltered(url: string, reason: string): void {
    this.stats.filteredUrls.push({ url, reason });
    const total = this.stats.totalUrls;
    const current = this.stats.processedUrls.length + this.stats.filteredUrls.length;
    this.logProgress('Crawling', current, total);
  }

  public logUrlSkipped(url: string, reason: string): void {
    this.stats.skippedUrls.push({ url, reason });
    const total = this.stats.totalUrls;
    const current = this.stats.processedUrls.length + this.stats.filteredUrls.length + this.stats.skippedUrls.length;
    this.logProgress('Crawling', current, total);
  }

  public logUrlProcessed(url: string, chunks: number): void {
    this.stats.processedUrls.push(url);
    this.stats.totalChunks += chunks;
    const total = this.stats.totalUrls;
    const current = this.stats.processedUrls.length + this.stats.filteredUrls.length + this.stats.skippedUrls.length;
    this.logProgress('Crawling', current, total);
  }

  public logChunkProcessed(): void {
    this.stats.processedChunks++;
    this.logProgress('Chunking', this.stats.processedChunks, this.stats.totalChunks);
  }

  public logChunkFailed(): void {
    this.stats.failedChunks++;
  }

  public logCategoryProcessed(category: string): void {
    this.stats.processedCategories++;
    this.logProgress('Categorizing', this.stats.processedCategories, this.stats.totalCategories);
  }

  public logDocumentProcessed(): void {
    this.stats.processedDocuments++;
    this.logProgress('Documents', this.stats.processedDocuments, this.stats.totalDocuments);
  }

  public logEmbeddingProcessed(): void {
    this.stats.processedEmbeddings++;
    this.logProgress('Embeddings', this.stats.processedEmbeddings, this.stats.totalEmbeddings);
  }

  private createTable(headers: string[], rows: string[][]): string {
    const columnWidths = headers.map((_, i) => 
      Math.max(...rows.map(row => row[i]?.length || 0), headers[i].length)
    );

    const headerRow = headers.map((h, i) => h.padEnd(columnWidths[i])).join(' | ');
    const separator = headers.map((_, i) => '-'.repeat(columnWidths[i])).join('-+-');
    const dataRows = rows.map(row => 
      row.map((cell, i) => (cell || '').padEnd(columnWidths[i])).join(' | ')
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }

  public logSummary(): void {
    const duration = (Date.now() - this.stats.startTime) / 1000;
    console.log('\n\n=== Processing Summary ===');
    
    // Crawling summary
    console.log('\n[Crawling Results]');
    const crawlingRows = [
      ['Total URLs', this.stats.totalUrls.toString()],
      ['Processed', this.stats.processedUrls.length.toString()],
      ['Filtered', this.stats.filteredUrls.length.toString()],
      ['Skipped', this.stats.skippedUrls.length.toString()]
    ];
    console.log(this.createTable(['Metric', 'Count'], crawlingRows));

    if (this.stats.filteredUrls.length > 0) {
      console.log('\nFiltered URLs:');
      const filteredRows = this.stats.filteredUrls.map(({ url, reason }) => [url, reason]);
      console.log(this.createTable(['URL', 'Reason'], filteredRows));
    }

    // Chunking summary
    console.log('\n[Chunking Results]');
    const chunkingRows = [
      ['Total Chunks', this.stats.totalChunks.toString()],
      ['Processed', this.stats.processedChunks.toString()],
      ['Failed', this.stats.failedChunks.toString()]
    ];
    console.log(this.createTable(['Metric', 'Count'], chunkingRows));

    // Categorizing summary
    console.log('\n[Categorizing Results]');
    const categorizingRows = [
      ['Total Categories', this.stats.totalCategories.toString()],
      ['Processed', this.stats.processedCategories.toString()],
      ['Failed', this.stats.failedCategories.toString()]
    ];
    console.log(this.createTable(['Metric', 'Count'], categorizingRows));

    // Document and embedding summary
    console.log('\n[Document & Embedding Results]');
    const docEmbedRows = [
      ['Total Documents', this.stats.totalDocuments.toString()],
      ['Processed Documents', this.stats.processedDocuments.toString()],
      ['Failed Documents', this.stats.failedDocuments.toString()],
      ['Total Embeddings', this.stats.totalEmbeddings.toString()],
      ['Processed Embeddings', this.stats.processedEmbeddings.toString()],
      ['Failed Embeddings', this.stats.failedEmbeddings.toString()]
    ];
    console.log(this.createTable(['Metric', 'Count'], docEmbedRows));

    console.log(`\nTotal processing time: ${duration.toFixed(2)}s`);
  }

  public setMissingCategories(categories: string[]): void {
    if (categories.length > 0) {
      console.log('\n=== Missing Categories ===');
      categories.forEach(category => {
        console.log(`- ${category}`);
      });
    }
  }

  public setAllFoundUrls(urls: string[]): void {
    this.allFoundUrls = urls;
  }

  public logUrl(url: string, status: 'processed' | 'filtered' | 'skipped', reason?: string) {
    this.urlLogs.push({ url, status, reason });
  }

  public logChunk(chunkId: number, url: string, status: 'processed' | 'failed', reason?: string) {
    this.chunkLogs.push({ chunkId, url, status, reason });
  }

  public logCategory(category: string, status: 'processed' | 'failed', reason?: string) {
    this.categoryLogs.push({ category, status, reason });
  }

  public logDocument(docId: string, title: string, status: 'processed' | 'failed', reason?: string) {
    this.documentLogs.push({ docId, title, status, reason });
  }

  public logEmbedding(embeddingId: string, docId: string, status: 'processed' | 'failed', reason?: string) {
    this.embeddingLogs.push({ embeddingId, docId, status, reason });
  }

  public printDetailedTables() {
    // Crawling
    console.log('\n[Crawling Results]');
    if (this.allFoundUrls.length > 0) {
      // Create a map of all URLs and their statuses
      const urlStatusMap = new Map<string, { status: string; reason: string }>();
      
      // First, add all found URLs with 'found' status
      this.allFoundUrls.forEach(url => {
        urlStatusMap.set(url, { status: 'found', reason: '' });
      });
      
      // Then update with actual processing statuses
      this.urlLogs.forEach(log => {
        urlStatusMap.set(log.url, { 
          status: log.status, 
          reason: log.reason || '' 
        });
      });
      
      // Convert to array and sort by URL
      const urlTable = Array.from(urlStatusMap.entries())
        .map(([url, { status, reason }]) => ({
          url,
          status,
          reason
        }))
        .sort((a, b) => a.url.localeCompare(b.url));
      
      console.table(urlTable);
    }
    
    // Chunking
    console.log('\n[Chunking Results]');
    if (this.chunkLogs.length > 0) {
      console.table(this.chunkLogs);
    }
    // Categorizing
    console.log('\n[Categorizing Results]');
    if (this.categoryLogs.length > 0) {
      console.table(this.categoryLogs);
    }
    // Documents
    console.log('\n[Document Results]');
    if (this.documentLogs.length > 0) {
      console.table(this.documentLogs);
    }
    // Embeddings
    console.log('\n[Embedding Results]');
    if (this.embeddingLogs.length > 0) {
      console.table(this.embeddingLogs);
    }
  }
}

export const logger = new ContentProcessorLogger(); 