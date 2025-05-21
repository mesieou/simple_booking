import { createClient } from '@/lib/supabase/server';
import { DocumentCategory, VALID_CATEGORIES, CategorizedSection } from '../../config';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

export async function updateCrawlSession(
  businessId: string,
  foundUrls: string[], // all initially found links
  processedUrls: string[], // only those we actually crawled
  categorizedSections: CategorizedSection[]
): Promise<void> {
  const supabase = createClient();
  const presentCategories = new Set(categorizedSections.map(section => section.category));
  const missingCategories = VALID_CATEGORIES.filter(
    (category: DocumentCategory) => !presentCategories.has(category)
  );

  logger.setMissingCategories(missingCategories);
  const totalPages = foundUrls.length;
  const successfulPages = processedUrls.length;
  const failedPages = totalPages - successfulPages;

  const crawlSessionPayload = {
    id: uuidv4(),
    businessId,
    startTime: Date.now(),
    endTime: Date.now(),
    totalPages,
    successfulPages,
    failedPages,
    categories: Object.fromEntries(Array.from(presentCategories).map(cat => [cat, 1])),
    errors: [],
    missingInformation: missingCategories.join(', ')
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