import { createClient } from '@/lib/supabase/server';
import { handleModelError } from '@/lib/helpers/error';
import { v4 as uuidv4 } from 'uuid';

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
} 