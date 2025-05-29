import { createClient } from '@/lib/supabase/server';
import { handleModelError } from '@/lib/helpers/error';
import { v4 as uuidv4 } from 'uuid';
import { Document, DocumentData } from './documents';
import { Embedding, EmbeddingData } from './embeddings';
import { CATEGORY_DISPLAY_NAMES, Category as AppCategory } from '@/lib/config/config';

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

  static async add(data: CrawlSessionData): Promise<CrawlSession> {
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
      id: data.id || uuidv4()
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
    sessionData: CrawlSessionData,
    documentsData: Omit<DocumentData, 'id' | 'sessionId'>[]
  ): Promise<{
    session: CrawlSession;
    savedDocuments: DocumentData[];
  }> {
    const supabase = await createClient();

    // 1. Insert session data directly
    const sessionToInsert = { ...sessionData, id: sessionData.id || uuidv4() };
    
    const { data: insertedSessionResult, error: sessionInsertError } = await supabase
      .from('crawlSessions')
      .insert(sessionToInsert)
      .select()
      .single();

    if (sessionInsertError) {
      console.error('Supabase error inserting session in addSessionWithDocumentsAndEmbeddings:', {
        message: sessionInsertError.message,
        details: sessionInsertError.details,
        code: sessionInsertError.code,
        hint: sessionInsertError.hint
      });
      handleModelError('Failed to insert session data in addSessionWithDocumentsAndEmbeddings', sessionInsertError);
      throw new Error('Session data insertion failed in addSessionWithDocumentsAndEmbeddings');
    }
    if (!insertedSessionResult) {
      handleModelError('No data returned after session insert in addSessionWithDocumentsAndEmbeddings', new Error('No data returned for session'));
      throw new Error('No data returned for session in addSessionWithDocumentsAndEmbeddings');
    }
    
    const session = new CrawlSession(insertedSessionResult);
    const sessionId = session.id; 

    if (!sessionId) { 
        handleModelError('Session ID missing after insert in addSessionWithDocumentsAndEmbeddings', new Error('Session ID is null/undefined post-insert'));
        throw new Error('Session ID missing after insert in addSessionWithDocumentsAndEmbeddings');
    }

    // 2. Batch insert documents
    let savedDocuments: DocumentData[] = [];
    if (documentsData.length > 0) {
      const documentsToInsert = documentsData.map(doc => ({
        ...doc,
        businessId: session.businessId, // Use businessId from the created session
        sessionId: sessionId
      }));

      const { data: insertedDocs, error: docError } = await supabase
        .from('documents')
        .insert(documentsToInsert)
        .select();

      if (docError) {
        console.error('Supabase error inserting documents:', docError);
        handleModelError('Failed to insert documents', docError);
        throw docError; // Re-throw to allow caller to handle
      }
      savedDocuments = insertedDocs || [];
    }

    return { session, savedDocuments };
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