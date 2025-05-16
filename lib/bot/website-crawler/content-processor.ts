import * as cheerio from 'cheerio';
import { PDFDocument } from 'pdf-lib';
import { detectLanguage, generateContentHash } from './utils';
import { PageContent, CategorizedContent, VALID_CATEGORIES } from './types';
import { categorizeContentSections } from '@/lib/helpers/openai';
import { getLinks } from './url-fetcher';
import crypto from 'crypto';

interface Section {
  title: string;
  html: string;
  text: string;
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function splitHtmlIntoSections(html: string): Section[] {
  const $ = cheerio.load(html);
  const sections: Section[] = [];

  // Remove unwanted elements first
  $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar, .social-share, .comments, .related-posts, .newsletter, .popup, .modal, .banner, .notification, .cookie-notice, .privacy-notice, .terms-notice, .disclaimer, .legal-notice, .copyright, .footer-links, .social-links, .share-buttons, .newsletter-signup, .subscribe-form, .contact-form, .search-form, .login-form, .signup-form, .password-form, .reset-form, .forgot-form, .remember-form, .profile-form, .settings-form, .preferences-form, .notification-settings, .privacy-settings, .account-settings, .billing-settings, .payment-settings, .shipping-settings, .delivery-settings, .order-settings, .cart-settings, .wishlist-settings, .favorite-settings, .bookmark-settings, .save-settings, .share-settings, .export-settings, .import-settings, .backup-settings, .restore-settings, .sync-settings, .update-settings, .upgrade-settings, .downgrade-settings, .cancel-settings, .delete-settings, .remove-settings, .hide-settings, .show-settings, .toggle-settings, .switch-settings, .change-settings, .edit-settings, .modify-settings, .adjust-settings, .configure-settings, .customize-settings, .personalize-settings, .optimize-settings, .improve-settings, .enhance-settings').remove();

  // Try to find main content container
  const mainContent = $('main, article, .content, #content, [role="main"], .main-content, .page-content, .post-content, .entry-content, .article-content, .blog-content, .news-content, .product-content, .service-content, .about-content, .contact-content, .pricing-content, .faq-content, .help-content, .support-content, .documentation-content, .guide-content, .tutorial-content, .how-to-content, .instructions-content, .manual-content, .reference-content, .api-content, .sdk-content, .library-content, .framework-content, .platform-content, .solution-content, .product-content, .service-content, .feature-content, .benefit-content, .advantage-content, .value-content, .proposition-content, .offer-content, .deal-content, .promotion-content, .discount-content, .sale-content, .clearance-content, .bargain-content, .special-content, .limited-content, .exclusive-content, .premium-content, .vip-content, .pro-content, .enterprise-content, .business-content, .corporate-content, .commercial-content, .retail-content, .wholesale-content, .b2b-content, .b2c-content, .c2c-content, .p2p-content, .marketplace-content, .store-content, .shop-content, .boutique-content, .gallery-content, .showroom-content, .exhibition-content, .display-content, .showcase-content, .portfolio-content, .collection-content, .catalog-content, .directory-content, .listing-content, .index-content, .table-content, .grid-content, .list-content, .menu-content, .navigation-content, .sidebar-content, .widget-content, .module-content, .component-content, .element-content, .block-content, .section-content, .divider-content, .spacer-content, .container-content, .wrapper-content, .holder-content, .box-content, .panel-content, .card-content, .tile-content, .item-content, .entry-content, .post-content, .article-content, .page-content, .content-area, .content-block, .content-section, .content-wrapper, .content-container, .content-box, .content-panel, .content-card, .content-tile, .content-item, .content-entry, .content-post, .content-article, .content-page').first();

  if (mainContent.length === 0) {
    // If no main content container found, use body
    $('body script').remove();
    const bodyText = $('body').text().trim();
    if (bodyText) {
      sections.push({
        title: 'Main Content',
        html: bodyText,
        text: bodyText
      });
    }
    return sections;
  }

  let currentSectionTitle = '';
  let currentSectionHtml = '';
  let currentText = '';

  // Process all elements in the main content
  mainContent.children().each((_, el) => {
    const $el = $(el);
    const tag = el.type === 'tag' ? el.name.toLowerCase() : '';

    // Check for section headers
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      // Save previous section if it exists
      if (currentSectionHtml.trim()) {
        sections.push({
          title: currentSectionTitle || 'Untitled Section',
          html: currentSectionHtml,
          text: currentText
        });
      }

      // Start new section
      currentSectionTitle = $el.text().trim();
      currentSectionHtml = $el.prop('outerHTML');
      currentText = $el.text().trim();
    } else {
      // Add to current section
      const elHtml = $el.prop('outerHTML');
      const elText = $el.text().trim();

      if (elText) {
        currentSectionHtml += '\n' + elHtml;
        currentText += '\n' + elText;
      }
    }
  });

  // Add the last section if it exists
  if (currentSectionHtml.trim()) {
    sections.push({
      title: currentSectionTitle || 'Untitled Section',
      html: currentSectionHtml,
      text: currentText
    });
  }

  // If no sections were created but we have content, create a single section
  if (sections.length === 0 && mainContent.text().trim()) {
    sections.push({
      title: 'Main Content',
      html: mainContent.html() || '',
      text: mainContent.text().trim()
    });
  }

  return sections;
}

async function categorizePageContent(
  pageUrl: string,
  html: string,
  title: string
): Promise<CategorizedContent[]> {
  const sections = splitHtmlIntoSections(html);
  const categorizedContent: CategorizedContent[] = [];
  const seenHashes = new Set<string>();

  for (const section of sections) {
    const cleanText = section.text.trim();
    if (cleanText.length < 100) continue; // Skip tiny or junky sections

    const hash = hashContent(cleanText);
    if (seenHashes.has(hash)) continue; // Skip duplicates
    seenHashes.add(hash);

    try {
      const categories = await categorizeContentSections(cleanText, section.title || title);

      for (const cat of categories) {
        if (cat.confidence < 0.6) continue;

        categorizedContent.push({
          ...cat,
          content: cleanText,
        });
      }
    } catch (err) {
      console.warn(`Categorization failed for a section on ${pageUrl}:`, err);
    }
  }

  return categorizedContent;
}

export function cleanContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .replace(/[^\S\n]+/g, ' ') // Replace multiple spaces (except newlines) with single space
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .replace(/\n\s*\n/g, '\n\n') // Replace multiple empty lines with single empty line
    .trim();
}

export function extractMainContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar, .social-share, .comments, .related-posts, .newsletter, .popup, .modal, .banner, .notification, .cookie-notice, .privacy-notice, .terms-notice, .disclaimer, .legal-notice, .copyright, .footer-links, .social-links, .share-buttons, .newsletter-signup, .subscribe-form, .contact-form, .search-form, .login-form, .signup-form, .password-form, .reset-form, .forgot-form, .remember-form, .profile-form, .settings-form, .preferences-form, .notification-settings, .privacy-settings, .account-settings, .billing-settings, .payment-settings, .shipping-settings, .delivery-settings, .order-settings, .cart-settings, .wishlist-settings, .favorite-settings, .bookmark-settings, .save-settings, .share-settings, .export-settings, .import-settings, .backup-settings, .restore-settings, .sync-settings, .update-settings, .upgrade-settings, .downgrade-settings, .cancel-settings, .delete-settings, .remove-settings, .hide-settings, .show-settings, .toggle-settings, .switch-settings, .change-settings, .edit-settings, .modify-settings, .adjust-settings, .configure-settings, .customize-settings, .personalize-settings, .optimize-settings, .improve-settings, .enhance-settings').remove();
  
  // Try to find main content in semantic order
  const main = $('main').text().trim();
  if (main) return main;

  const article = $('article').text().trim();
  if (article) return article;

  const content = $('.content, #content, [role="main"], .main-content, .page-content, .post-content, .entry-content, .article-content, .blog-content, .news-content, .product-content, .service-content, .about-content, .contact-content, .pricing-content, .faq-content, .help-content, .support-content, .documentation-content, .guide-content, .tutorial-content, .how-to-content, .instructions-content, .manual-content, .reference-content, .api-content, .sdk-content, .library-content, .framework-content, .platform-content, .solution-content, .product-content, .service-content, .feature-content, .benefit-content, .advantage-content, .value-content, .proposition-content, .offer-content, .deal-content, .promotion-content, .discount-content, .sale-content, .clearance-content, .bargain-content, .special-content, .limited-content, .exclusive-content, .premium-content, .vip-content, .pro-content, .enterprise-content, .business-content, .corporate-content, .commercial-content, .retail-content, .wholesale-content, .b2b-content, .b2c-content, .c2c-content, .p2p-content, .marketplace-content, .store-content, .shop-content, .boutique-content, .gallery-content, .showroom-content, .exhibition-content, .display-content, .showcase-content, .portfolio-content, .collection-content, .catalog-content, .directory-content, .listing-content, .index-content, .table-content, .grid-content, .list-content, .menu-content, .navigation-content, .sidebar-content, .widget-content, .module-content, .component-content, .element-content, .block-content, .section-content, .divider-content, .spacer-content, .container-content, .wrapper-content, .holder-content, .box-content, .panel-content, .card-content, .tile-content, .item-content, .entry-content, .post-content, .article-content, .page-content, .content-area, .content-block, .content-section, .content-wrapper, .content-container, .content-box, .content-panel, .content-card, .content-tile, .content-item, .content-entry, .content-post, .content-article, .content-page').text().trim();
  if (content) return content;

  // Fallback to body, but remove any remaining script tags and their content
  $('body script').remove();
  return $('body').text().trim();
}

export async function processPdfContent(url: string, arrayBuffer: ArrayBuffer, businessId: string): Promise<PageContent | null> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Extract text from all pages
  let content = '';
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    content += `Page ${i + 1}: ${width}x${height}\n`;
  }
  
  // Get PDF metadata
  const title = pdfDoc.getTitle() || 
               decodeURIComponent(new URL(url).pathname.replace(/\//g, ' ').trim()) || 
               'Untitled PDF';
  
  // Clean and trim content
  const cleanedContent = cleanContent(content);

  if (!cleanedContent) {
    console.warn(`No content found in PDF at ${url}`);
    return null;
  }

  // Skip non-English content
  const language = detectLanguage(url, cleanedContent);
  if (language !== 'en') {
    console.warn(`Skipping non-English PDF at ${url} (detected language: ${language})`);
    return null;
  }

  // Categorize content sections
  const categorizedSections = await categorizeContentSections(cleanedContent, title);

  // Get primary category from the section with highest confidence
  const primaryCategory = categorizedSections.length > 0 
    ? categorizedSections.reduce((prev, current) => 
        (current.confidence > prev.confidence) ? current : prev
      ).category
    : VALID_CATEGORIES[0];

  const contentHash = generateContentHash(cleanedContent, language);

  return {
    url,
    title,
    content: cleanedContent,
    category: primaryCategory,
    contentHash,
    links: [], // PDFs don't have links
    businessId,
    categorizedContent: categorizedSections,
    metadata: {
      crawlTimestamp: Date.now(),
      depth: 0,
      status: 'success',
      language: 'en',
      originalUrl: url,
      fileType: 'pdf'
    }
  };
}

export async function processHtmlContent(url: string, html: string, businessId: string): Promise<PageContent | null> {
  const $ = cheerio.load(html) as cheerio.CheerioAPI;
  
  // Check HTML lang attribute
  const htmlLang = $('html').attr('lang')?.toLowerCase();
  if (htmlLang && !htmlLang.startsWith('en')) {
    console.warn(`Skipping non-English page at ${url} (HTML lang: ${htmlLang})`);
    return null;
  }

  // Get valid links first
  const links = await getLinks(url);
  
  const title = $('title').text().trim() || 
               $('h1').first().text().trim() || 
               decodeURIComponent(new URL(url).pathname.replace(/\//g, ' ').trim()) || 
               'Untitled Page';
  
  // Extract and clean content
  const content = cleanContent(extractMainContent($));

  if (!content) {
    console.warn(`No content found at ${url}`);
    return null;
  }

  // Skip non-English content
  const language = detectLanguage(url, content);
  if (language !== 'en') {
    console.warn(`Skipping non-English page at ${url} (detected language: ${language})`);
    return null;
  }

  // Categorize content sections using the new semantic approach
  const categorizedSections = await categorizePageContent(url, html, title);
  
  // Get primary category from the section with highest confidence
  const primaryCategory = categorizedSections.length > 0 
    ? categorizedSections.reduce((prev, current) => 
        (current.confidence > prev.confidence) ? current : prev
      ).category
    : VALID_CATEGORIES[0];

  const contentHash = generateContentHash(content, language);

  return {
    url,
    title,
    content,
    category: primaryCategory,
    contentHash,
    links,
    businessId,
    categorizedContent: categorizedSections,
    metadata: {
      crawlTimestamp: Date.now(),
      depth: 0,
      status: 'success',
      language: 'en',
      originalUrl: url,
      fileType: 'html'
    }
  };
} 