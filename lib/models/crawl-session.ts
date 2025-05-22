import { createClient } from '@/lib/supabase/server';
import { handleModelError } from '@/lib/helpers/error';
import { v4 as uuidv4 } from 'uuid';
import { Document, DocumentData } from './documents';
import { Embedding, EmbeddingData } from './embeddings';

export interface CrawlSessionData {
  id?: string;
  businessId: string;
  startTime: number;
  endTime?: number;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  categories: Record<string, number>;
  errors: Array<{ url: string; error: string }>;
  missingInformation?: string;
}

export class CrawlSession {
  private sessionData: CrawlSessionData;

  constructor(data: CrawlSessionData) {
    if (!data.businessId) handleModelError('businessId is required', new Error('Missing businessId'));
    if (typeof data.startTime !== 'number') handleModelError('startTime is required', new Error('Missing startTime'));
    this.sessionData = data;
  }

  static async add(data: Omit<CrawlSessionData, 'id'>): Promise<CrawlSession> {
    const supabase = await createClient();
    const insertData = {
      businessId: data.businessId,
      startTime: data.startTime,
      endTime: data.endTime,
      totalPages: data.totalPages,
      successfulPages: data.successfulPages,
      failedPages: data.failedPages,
      categories: data.categories,
      errors: data.errors,
      missingInformation: data.missingInformation,
      id: uuidv4()
    };
    console.log('Attempting to insert crawl session:', insertData);
    const { data: result, error } = await supabase
      .from('crawlSessions')
      .insert(insertData)
      .select()
      .single();
    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint
      });
      handleModelError('Failed to insert crawl session', error);
    }
    if (!result) handleModelError('No data returned after insert', new Error('No data returned'));
    return new CrawlSession(result);
  }

  static async getById(id: string): Promise<CrawlSession> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crawlSessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) handleModelError('Failed to fetch crawl session', error);
    if (!data) handleModelError('Crawl session not found', new Error('Crawl session not found'));
    return new CrawlSession(data);
  }

  static async getAll(businessId?: string): Promise<CrawlSession[]> {
    const supabase = await createClient();
    let query = supabase.from('crawlSessions').select('*');
    if (businessId) query = query.eq('businessId', businessId);
    const { data, error } = await query;
    if (error) handleModelError('Failed to fetch crawl sessions', error);
    return (data || []).map((row: CrawlSessionData) => new CrawlSession(row));
  }

  static async deleteById(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('crawlSessions').delete().eq('id', id);
    if (error) handleModelError('Failed to delete crawl session', error);
  }

  /**
   * Orchestrates creation of a session, its documents, and their embeddings.
   */
  static async addSessionWithDocumentsAndEmbeddings(
    sessionData: Omit<CrawlSessionData, 'id'>,
    documents: Omit<DocumentData, 'id'>[],
    embeddings: (Omit<EmbeddingData, 'id' | 'documentId'> & { metadata: { contentHash: string } })[]
  ): Promise<{
    session: CrawlSession;
    documents: DocumentData[];
    embeddings: EmbeddingData[];
  }> {
    // 1. Create session
    const session = await CrawlSession.add(sessionData);
    // 2. Create documents with sessionId
    const docsWithSession = await Promise.all(
      documents.map(doc => Document.add({ ...doc, sessionId: session.id! }))
    );
    // 3. Create embeddings with documentId
    const embeddingsWithDocId = await Promise.all(
      embeddings.map(embed => {
        // Find the document for this embedding by contentHash or other unique field
        const doc = docsWithSession.find(d => d.contentHash === embed.metadata?.contentHash);
        if (!doc) throw new Error('No matching document for embedding');
        return Embedding.add({ ...embed, documentId: doc.id! });
      })
    );
    return { session, documents: docsWithSession, embeddings: embeddingsWithDocId };
  }

  /**
   * Fetches a session, its documents, and their embeddings.
   */
  static async getSessionWithDocumentsAndEmbeddings(sessionId: string) {
    const session = await CrawlSession.getById(sessionId);
    const documents = await Document.getBySessionId(sessionId);
    const docIds = documents.map(d => d.id!).filter(Boolean);
    const embeddings = await Embedding.getByDocumentIds(docIds);
    return { session, documents, embeddings };
  }

  /**
   * Deletes a session and all its documents and embeddings (cascade).
   */
  static async deleteSessionCascade(sessionId: string): Promise<void> {
    const documents = await Document.getBySessionId(sessionId);
    const docIds = documents.map(d => d.id!).filter(Boolean);
    await Promise.all(docIds.map(id => Embedding.deleteByDocumentId(id)));
    await Document.deleteBySessionId(sessionId);
    await CrawlSession.deleteById(sessionId);
  }

  // Getters
  get id(): string | undefined { return this.sessionData.id; }
  get businessId(): string { return this.sessionData.businessId; }
  get startTime(): number { return this.sessionData.startTime; }
  get endTime(): number | undefined { return this.sessionData.endTime; }
  get totalPages(): number { return this.sessionData.totalPages; }
  get successfulPages(): number { return this.sessionData.successfulPages; }
  get failedPages(): number { return this.sessionData.failedPages; }
  get categories(): Record<string, number> { return this.sessionData.categories; }
  get errors(): Array<{ url: string; error: string }> { return this.sessionData.errors; }
  get missingInformation(): string | undefined { return this.sessionData.missingInformation; }
} 