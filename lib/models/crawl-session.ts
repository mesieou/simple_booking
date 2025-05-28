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
    documentsData: Omit<DocumentData, 'id' | 'sessionId'>[],
    embeddingsData: (Omit<EmbeddingData, 'id' | 'documentId'> & { metadata?: { documentContentHash?: string, [key: string]: any }, content: string})[]
  ): Promise<{
    session: CrawlSession;
    savedDocuments: DocumentData[];
    savedEmbeddings: EmbeddingData[];
  }> {
    const supabase = await createClient();

    // 1. Create session
    const session = await CrawlSession.add(sessionData);
    if (!session || !session.id) {
      handleModelError('Failed to create session or session ID missing', new Error('Session creation failed'));
      throw new Error('Session creation failed');
    }
    const sessionId = session.id;

    // 2. Batch insert documents
    let savedDocuments: DocumentData[] = [];
    if (documentsData.length > 0) {
      const documentsToInsert = documentsData.map(doc => ({
        ...doc,
        businessId: session.businessId,
        sessionId: sessionId
      }));

      const { data: insertedDocs, error: docError } = await supabase
        .from('documents')
        .insert(documentsToInsert)
        .select();

      if (docError) {
        console.error('Supabase error inserting documents:', docError);
        handleModelError('Failed to insert documents', docError);
        throw docError;
      }
      savedDocuments = insertedDocs || [];
    }

    // 3. Batch insert embeddings
    let savedEmbeddings: EmbeddingData[] = [];
    if (embeddingsData.length > 0 && savedDocuments.length > 0) {
      const docHashMap = new Map(savedDocuments.map(doc => [doc.contentHash, doc.id]));
      
      const embeddingsToInsert = embeddingsData.map(embed => {
        const documentId = docHashMap.get(embed.metadata?.documentContentHash);
        if (!documentId) {
          console.warn(`Could not find document for embedding with contentHash: ${embed.metadata?.documentContentHash}. Skipping this embedding.`);
          return null;
        }

        let categoryNameToStore = 'Unknown';
        if (embed.category !== undefined) {
            // Attempt to convert to number if it's a string representation of a number, then cast to AppCategory for lookup
            const categoryKey = (typeof embed.category === 'string' ? parseInt(embed.category, 10) : embed.category) as AppCategory;
            if (CATEGORY_DISPLAY_NAMES[categoryKey]) {
                categoryNameToStore = CATEGORY_DISPLAY_NAMES[categoryKey];
            }
        }

        return {
          documentId: documentId,
          content: embed.content,         
          embedding: embed.embedding,     
          category: categoryNameToStore, // Use the resolved string name
          chunkIndex: embed.chunkIndex,   
          metadata: embed.metadata || {}, 
        };
      }).filter(e => e !== null) as Omit<EmbeddingData, 'id' | 'createdAt'>[];

      if (embeddingsToInsert.length > 0) {
        const { data: insertedEmbeddings, error: embedError } = await supabase
          .from('embeddings')
          .insert(embeddingsToInsert)
          .select();

        if (embedError) {
          console.error('Supabase error inserting embeddings:', embedError);
          handleModelError('Failed to insert some embeddings', embedError);
        }
        savedEmbeddings = insertedEmbeddings || [];
      }
    }
    
    return { session, savedDocuments, savedEmbeddings };
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