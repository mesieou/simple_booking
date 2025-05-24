// Mock getLinks to avoid ESM import issues with got
jest.mock('@/lib/bot/website-crawler/url-fetcher', () => ({
  getLinks: jest.fn().mockResolvedValue([]),
}));

import { processHtmlContent } from '@/lib/bot/website-crawler/content-processor';
import { categorizeContentSectionsBatch } from '@/lib/helpers/openai/openai-helpers';
import { CategorizedContent, VALID_CATEGORIES, WebPageCategory } from '@/lib/bot/website-crawler/types';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Import the functions we want to test
const {
  splitHtmlIntoSections,
  splitByHeadings,
  categorizePageContent,
  cleanContent,
  extractMainContent
} = require('@/lib/bot/website-crawler/content-processor');

export { splitByHeadings, splitHtmlIntoSections, categorizePageContent };

interface Section {
  title: string;
  text: string;
}

// Mock the OpenAI helper with more realistic responses
jest.mock('@/lib/helpers/openai', () => ({
  categorizeContentSectionsBatch: jest.fn().mockImplementation(async (sections: Section[]) => {
    // Return mock categories based on the content
    return sections.map(section => {
      // Determine category based on content keywords
      let category: WebPageCategory = 'services offered';
      const text = section.text.toLowerCase();
      
      if (text.includes('about') || text.includes('who we are') || text.includes('trust')) {
        category = 'about / trust-building';
      } else if (text.includes('contact') || text.includes('get in touch') || text.includes('email')) {
        category = 'contact';
      } else if (text.includes('service') || text.includes('what we do') || text.includes('offer')) {
        category = 'services offered';
      } else if (text.includes('pricing') || text.includes('cost') || text.includes('fee') || text.includes('quote')) {
        category = 'pricing or quotes';
      } else if (text.includes('book') || text.includes('schedule') || text.includes('appointment')) {
        category = 'booking or scheduling';
      } else if (text.includes('faq') || text.includes('question') || text.includes('answer')) {
        category = 'faq';
      } else if (text.includes('terms') || text.includes('legal') || text.includes('policy') || text.includes('privacy')) {
        category = 'terms & conditions / legal policies';
      }

      return {
        category,
        confidence: 0.9,
        text: section.text
      };
    });
  })
}));

describe('Content Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('splitByHeadings', () => {
    it('should split content by h1 and h2 headings', () => {
      const html = `
        <div>
          <h1>Main Title</h1>
          <p>Main content here</p>
          
          <h2>First Section</h2>
          <p>First section content</p>
          
          <h2>Second Section</h2>
          <p>Second section content</p>
        </div>
      `;
      
      const $ = cheerio.load(html);
      const sections = splitByHeadings($, $('div')[0]);
      
      expect(sections).toHaveLength(3);
      expect(sections[0].title).toBe('Main Title');
      expect(sections[0].text).toContain('Main content here');
      expect(sections[1].title).toBe('First Section');
      expect(sections[1].text).toContain('First section content');
      expect(sections[2].title).toBe('Second Section');
      expect(sections[2].text).toContain('Second section content');
    });

    it('should handle content without headings', () => {
      const html = `
        <div>
          <p>Just some content</p>
          <p>Without any headings</p>
        </div>
      `;
      
      const $ = cheerio.load(html);
      const sections = splitByHeadings($, $('div')[0]);
      
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Untitled Section');
      expect(sections[0].text).toContain('Just some content');
    });
  });

  describe('splitHtmlIntoSections', () => {
    it('should find and process main content container', () => {
      const html = `
        <html>
          <body>
            <header>Navigation</header>
            <main>
              <h1>Main Title</h1>
              <p>Main content</p>
              <h2>Section</h2>
              <p>Section content</p>
            </main>
            <footer>Footer content</footer>
          </body>
        </html>
      `;
      
      const sections = splitHtmlIntoSections(html);
      
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Main Title');
      expect(sections[0].text).toContain('Main content');
      expect(sections[1].title).toBe('Section');
      expect(sections[1].text).toContain('Section content');
    });

    it('should remove unwanted elements', () => {
      const html = `
        <html>
          <body>
            <script>var x = 1;</script>
            <style>.hidden { display: none; }</style>
            <nav>Navigation</nav>
            <main>
              <h1>Title</h1>
              <p>Content</p>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `;
      
      const sections = splitHtmlIntoSections(html);
      
      expect(sections).toHaveLength(1);
      expect(sections[0].text).not.toContain('var x = 1');
      expect(sections[0].text).not.toContain('.hidden');
      expect(sections[0].text).not.toContain('Navigation');
      expect(sections[0].text).not.toContain('Footer');
    });
  });

  describe('categorizePageContent', () => {
    it('should categorize sections and remove duplicates', async () => {
      const html = `
        <html>
          <body>
            <h1>About Us</h1>
            <p>We are a company</p>
            <h2>Our Services</h2>
            <p>We offer services</p>
            <h2>Contact Us</h2>
            <p>Get in touch</p>
          </body>
        </html>
      `;
      
      const url = 'https://example.com';
      const title = 'Test Page';
      
      const categorizedContent = await categorizePageContent(url, html, title);
      
      expect(categorizedContent.length).toBeGreaterThan(0);
      categorizedContent.forEach((content: CategorizedContent) => {
        expect(VALID_CATEGORIES).toContain(content.category);
      });
    });

    it('should filter out short sections', async () => {
      const html = `
        <html>
          <body>
            <h1>Short Section</h1>
            <p>Too short</p>
            <h2>Long Section</h2>
            <p>This is a much longer section that should be included in the categorization process because it has enough content to be meaningful and useful for understanding the page's purpose and content.</p>
          </body>
        </html>
      `;
      
      const url = 'https://example.com';
      const title = 'Test Page';
      
      const categorizedContent = await categorizePageContent(url, html, title);
      
      expect(categorizedContent.length).toBe(1);
      expect(categorizedContent[0].text).toContain('This is a much longer section');
    });
  });

  describe('cleanContent', () => {
    it('should clean HTML and normalize whitespace', () => {
      const content = `
        <div>
          <p>  Multiple   spaces  </p>
          <p>Multiple\n\nnewlines</p>
          <p>  Leading and trailing spaces  </p>
        </div>
      `;
      
      const cleaned = cleanContent(content);
      
      expect(cleaned).not.toContain('<div>');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('  Multiple   spaces  ');
      expect(cleaned).toContain('Multiple spaces');
      expect(cleaned).not.toContain('\n\n');
      expect(cleaned).not.toContain('  Leading and trailing spaces  ');
    });
  });

  describe('extractMainContent', () => {
    it('should extract content from main container', () => {
      const html = `
        <html>
          <body>
            <header>Header</header>
            <main>
              <h1>Title</h1>
              <p>Main content</p>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `;
      
      const $ = cheerio.load(html);
      const content = extractMainContent($);
      
      expect(content).toContain('Title');
      expect(content).toContain('Main content');
      expect(content).not.toContain('Header');
      expect(content).not.toContain('Footer');
    });

    it('should fall back to body if no main container found', () => {
      const html = `
        <html>
          <body>
            <h1>Title</h1>
            <p>Content</p>
          </body>
        </html>
      `;
      
      const $ = cheerio.load(html);
      const content = extractMainContent($);
      
      expect(content).toContain('Title');
      expect(content).toContain('Content');
    });
  });

  it('should process taxbne website content', async () => {
    // Fetch real HTML content from the website
    const url = 'https://www.taxbne.com.au/';
    const response = await axios.get(url);
    const html = response.data;
    const businessId = 'test-business-id';

    const result = await processHtmlContent(url, html, businessId);

    // Log the result to see the categorized content
    console.log('Processed Content:', JSON.stringify(result, null, 2));

    // Basic assertions
    expect(result).not.toBeNull();
    expect(result?.url).toBe(url);
    expect(result?.title).toBeTruthy();
    expect(result?.content).toBeTruthy();
    expect(result?.categorizedContent.length).toBeGreaterThan(0);

    // Verify OpenAI was called once with all sections
    expect(categorizeContentSectionsBatch).toHaveBeenCalledTimes(1);
    const sections = (categorizeContentSectionsBatch as jest.Mock).mock.calls[0][0];
    expect(sections.length).toBeGreaterThan(0);

    // Log the sections that were processed
    console.log('Processed Sections:', sections.map((s: Section) => ({
      title: s.title,
      textLength: s.text.length,
      preview: s.text.substring(0, 100) + '...'
    })));

    // Verify content structure
    expect(result?.content).toContain('tax'); // Should contain tax-related content
    
    // Verify that all categories in the result are valid
    result?.categorizedContent.forEach((c: CategorizedContent) => {
      expect(VALID_CATEGORIES).toContain(c.category);
    });
    
    // Verify metadata
    expect(result?.metadata).toEqual({
      crawlTimestamp: expect.any(Number),
      depth: 0,
      status: 'success',
      language: 'en',
      originalUrl: url,
      fileType: 'html'
    });
  });
})