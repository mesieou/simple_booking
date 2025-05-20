import { createClient } from '@/lib/supabase/server';
import { DocumentCategory, VALID_CATEGORIES, CategorizedSection } from '../../config';
import { v4 as uuidv4 } from 'uuid';

export async function updateCrawlSession(
  businessId: string,
  totalPages: number,
  processedUrls: string[],
  categorizedSections: CategorizedSection[]
): Promise<void> {
  const supabase = createClient();
  const presentCategories = new Set(categorizedSections.map(section => section.category));
  const missingCategories = VALID_CATEGORIES.filter(
    (category: DocumentCategory) => !presentCategories.has(category)
  );

  const crawlSessionPayload = {
    id: uuidv4(),
    businessId,
    startTime: Date.now(),
    endTime: Date.now(),
    totalPages,
    successfulPages: processedUrls.length,
    failedPages: totalPages - processedUrls.length,
    categories: Object.fromEntries(Array.from(presentCategories).map(cat => [cat, 1])),
    errors: [],
    missingCategories
  };

  const { error: crawlSessionError } = await supabase.from('crawlSessions').insert([crawlSessionPayload]);
  if (crawlSessionError) {
    console.error('Supabase crawlSessions insert error:', {
      message: crawlSessionError.message,
      details: crawlSessionError.details,
      code: crawlSessionError.code,
      hint: crawlSessionError.hint,
      payload: crawlSessionPayload
    });
  }
} 