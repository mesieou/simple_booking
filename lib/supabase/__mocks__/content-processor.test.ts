import axios from 'axios';
import * as cheerio from 'cheerio';
import { Category, CrawlConfig, CrawlOutput } from "@/lib/config/config";
import { processHtmlContent } from '@/lib/bot/content-crawler/html-crawler';
import { categorizeWebsiteContent, analyzeCategoryQualityWithGPT } from '@/lib/helpers/openai/functions/content-analysis';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock cheerio
jest.mock('cheerio', () => ({
  load: jest.fn(),
}));

describe('Content Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process HTML content correctly', async () => {
    // Mock HTML content
    const mockHtml = `
      <html>
        <head>
          <title>Test Business</title>
        </head>
        <body>
          <h1>About Us</h1>
          <p>We are a test business.</p>
          <h2>Our Services</h2>
          <p>We offer various services.</p>
          <h2>Contact Us</h2>
          <p>Email: test@example.com</p>
        </body>
      </html>
    `;

    // Mock cheerio load
    const mockCheerio = {
      text: jest.fn().mockReturnValue('Test Business We are a test business. We offer various services. Email: test@example.com'),
      find: jest.fn().mockReturnThis(),
      each: jest.fn().mockImplementation((callback) => {
        callback(0, { text: () => 'About Us' });
        callback(1, { text: () => 'Our Services' });
        callback(2, { text: () => 'Contact Us' });
      }),
    };
    (cheerio.load as jest.Mock).mockReturnValue(mockCheerio);

    // Mock axios response
    mockedAxios.get.mockResolvedValueOnce({
      data: mockHtml,
      headers: { 'content-type': 'text/html' },
    });

    // Mock OpenAI response
    const mockCategorizedContent = [
      {
        category: Category.ABOUT_TRUST_BUILDING,
        content: 'We are a test business.',
        confidence: 0.9,
        reason: 'Content describes company information'
      },
      {
        category: Category.SERVICES_OFFERED,
        content: 'We offer various services.',
        confidence: 0.95,
        reason: 'Content describes services'
      },
      {
        category: Category.CONTACT,
        content: 'Email: test@example.com',
        confidence: 0.98,
        reason: 'Content provides contact information'
      }
    ];

    // Mock the categorizeWebsiteContent function
    (categorizeWebsiteContent as jest.Mock).mockResolvedValueOnce(mockCategorizedContent);

    // Create test config
    const config: CrawlConfig = {
      websiteUrl: 'https://test.com',
      businessId: 'test-business',
      chunkSize: 2000,
      chunkOverlap: 100,
      concurrency: 5,
      requestDelay: 1000
    };

    // Create test crawl output
    const crawlOutput: CrawlOutput = {
      texts: [mockHtml],
      urls: ['https://test.com'],
      results: [],
      mainLanguage: 'en'
    };

    // Call the function
    const result = await processHtmlContent(config, crawlOutput);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.businessId).toBe('test-business');
    expect(result.source).toBe('https://test.com');
    expect(result.pageCount).toBe(1);
    expect(result.uniqueParagraphs).toBe(1);
  });

  it('should handle errors gracefully', async () => {
    // Mock axios error
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    // Create test config
    const config: CrawlConfig = {
      websiteUrl: 'https://test.com',
      businessId: 'test-business',
      chunkSize: 2000,
      chunkOverlap: 100,
      concurrency: 5,
      requestDelay: 1000
    };

    // Create test crawl output
    const crawlOutput: CrawlOutput = {
      texts: [],
      urls: [],
      results: [],
      mainLanguage: 'en'
    };

    // Call the function
    const result = await processHtmlContent(config, crawlOutput);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.businessId).toBe('test-business');
    expect(result.source).toBe('https://test.com');
    expect(result.pageCount).toBe(0);
    expect(result.uniqueParagraphs).toBe(0);
  });

  it('should analyze category quality correctly', async () => {
    const mockAnalysis = {
      issues: ['Missing pricing details'],
      recommendations: ['Add pricing information'],
      score: 75
    };

    // Mock the analyzeCategoryQualityWithGPT function
    (analyzeCategoryQualityWithGPT as jest.Mock).mockResolvedValueOnce(mockAnalysis);

    // Call the function
    const result = await analyzeCategoryQualityWithGPT(
      Category.SERVICES_OFFERED,
      'We offer various services.',
      'https://test.com'
    );

    // Verify the result
    expect(result).toEqual(mockAnalysis);
  });
});