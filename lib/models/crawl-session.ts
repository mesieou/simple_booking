import { createClient } from '@/lib/supabase/server';
import { handleModelError } from '@/lib/helpers/error';

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
  private data: CrawlSessionData;

  constructor(data: CrawlSessionData) {
    if (!data.businessId) handleModelError('businessId is required', new Error('Missing businessId'));
    if (typeof data.startTime !== 'number') handleModelError('startTime is required', new Error('Missing startTime'));
    this.data = data;
  }

  static async add(data: Omit<CrawlSessionData, 'id'>): Promise<CrawlSession> {
    const supabase = createClient();
    const insertData = { ...data };
    console.log('Attempting to insert crawl session:', insertData);
    const { data: result, error } = await supabase
      .from('crawl_sessions')
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from('crawl_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) handleModelError('Failed to fetch crawl session', error);
    if (!data) handleModelError('Crawl session not found', new Error('Crawl session not found'));
    return new CrawlSession(data);
  }

  static async getAll(businessId?: string): Promise<CrawlSession[]> {
    const supabase = createClient();
    let query = supabase.from('crawl_sessions').select('*');
    if (businessId) query = query.eq('businessId', businessId);
    const { data, error } = await query;
    if (error) handleModelError('Failed to fetch crawl sessions', error);
    return (data || []).map((row: CrawlSessionData) => new CrawlSession(row));
  }

  static async deleteById(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('crawl_sessions').delete().eq('id', id);
    if (error) handleModelError('Failed to delete crawl session', error);
  }

  // Getters
  get id(): string | undefined { return this.data.id; }
  get businessId(): string { return this.data.businessId; }
  get startTime(): number { return this.data.startTime; }
  get endTime(): number | undefined { return this.data.endTime; }
  get totalPages(): number { return this.data.totalPages; }
  get successfulPages(): number { return this.data.successfulPages; }
  get failedPages(): number { return this.data.failedPages; }
  get categories(): Record<string, number> { return this.data.categories; }
  get errors(): Array<{ url: string; error: string }> { return this.data.errors; }
} 