import { setupBusinessAiBot, FastCrawlConfig } from '@/lib/bot/website-crawler';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockResolvedValue({ data: [], error: null })
    }))
  }))
}));

describe('Website Crawler', () => {
  const mockConfig: FastCrawlConfig = {
    websiteUrl: 'https://example.com',
    botType: 'customer-service',
    businessId: 'test-business-id',
    maxPages: 5,
    requestDelay: 1000,
    logInterval: {
      urls: 1,
      seconds: 1
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should crawl a website and process pages', async () => {
    const progressCallback = jest.fn();
    
    const result = await setupBusinessAiBot(mockConfig, progressCallback);
    
    // Verify progress was tracked
    expect(progressCallback).toHaveBeenCalled();
    
    // Verify Supabase interactions
    const supabase = createClient();
    expect(supabase.from).toHaveBeenCalled();
    
    // Verify result structure
    expect(result).toBeDefined();
    expect(result.successfulPages).toBeLessThanOrEqual(mockConfig.maxPages);
  });

  it('should handle errors gracefully', async () => {
    const invalidConfig = {
      ...mockConfig,
      websiteUrl: 'invalid-url'
    };

    await expect(setupBusinessAiBot(invalidConfig, jest.fn()))
      .rejects
      .toThrow();
  });
}); 