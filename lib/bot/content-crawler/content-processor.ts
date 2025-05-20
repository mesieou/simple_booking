import * as cheerio from 'cheerio';
import { detectLanguage, PRICE_REGEX, isLowValueContent } from './utils';
import crypto from 'crypto';
import { cleanContent } from './utils';

interface Section {
  title: string;
  html: string;
  text: string;
}

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function splitByHeadings($: cheerio.Root, root: cheerio.Element): Section[] {
  const sections: Section[] = [];
  let currentTitle = '';
  let currentNodes: cheerio.Element[] = [];

  $(root).children().each((_, el) => {
    const $el = $(el);
    const tag = el.type === 'tag' ? el.name.toLowerCase() : '';

    if (tag === 'h1' || tag === 'h2') {
      // Save the previous section
      if (currentNodes.length) {
        const text = $(currentNodes).text().trim();
        const html = $(currentNodes).map((_, e) => $.html(e)).get().join('\n');
        if (text) {
          sections.push({
            title: currentTitle || 'Untitled Section',
            text,
            html
          });
        }
      }
      currentTitle = $el.text().trim();
      currentNodes = [];
    } else {
      currentNodes.push(el);
    }
  });

  // Last section
  if (currentNodes.length) {
    const text = $(currentNodes).text().trim();
    const html = $(currentNodes).map((_, e) => $.html(e)).get().join('\n');
    if (text) {
      sections.push({
        title: currentTitle || 'Untitled Section',
        text,
        html
      });
    }
  }
  return sections;
}

function splitHtmlIntoSections(html: string): Section[] {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements first
  $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar, .social-share, .comments, .related-posts, .newsletter, .popup, .modal, .banner, .notification, .cookie-notice, .privacy-notice, .terms-notice, .disclaimer, .legal-notice, .copyright, .footer-links, .social-links, .share-buttons, .newsletter-signup, .subscribe-form, .contact-form, .search-form, .login-form, .signup-form, .password-form, .reset-form, .forgot-form, .remember-form, .profile-form, .settings-form, .preferences-form, .notification-settings, .privacy-settings, .account-settings, .billing-settings, .payment-settings, .shipping-settings, .delivery-settings, .order-settings, .cart-settings, .wishlist-settings, .favorite-settings, .bookmark-settings, .save-settings, .share-settings, .export-settings, .import-settings, .backup-settings, .restore-settings, .sync-settings, .update-settings, .upgrade-settings, .downgrade-settings, .cancel-settings, .delete-settings, .remove-settings, .hide-settings, .show-settings, .toggle-settings, .switch-settings, .change-settings, .edit-settings, .modify-settings, .adjust-settings, .configure-settings, .customize-settings, .personalize-settings, .optimize-settings, .improve-settings, .enhance-settings').remove();

  // Try to find main content container
  const mainContent = $('main, article, .content, #content, [role="main"], .main-content, .page-content, .post-content, .entry-content, .article-content, .blog-content, .news-content, .product-content, .service-content, .about-content, .contact-content, .pricing-content, .faq-content, .help-content, .support-content, .documentation-content, .guide-content, .tutorial-content, .how-to-content, .instructions-content, .manual-content, .reference-content, .api-content, .sdk-content, .library-content, .framework-content, .platform-content, .solution-content, .product-content, .service-content, .feature-content, .benefit-content, .advantage-content, .value-content, .proposition-content, .offer-content, .deal-content, .promotion-content, .discount-content, .sale-content, .clearance-content, .bargain-content, .special-content, .limited-content, .exclusive-content, .premium-content, .vip-content, .pro-content, .enterprise-content, .business-content, .corporate-content, .commercial-content, .retail-content, .wholesale-content, .b2b-content, .c2c-content, .p2p-content, .marketplace-content, .store-content, .shop-content, .boutique-content, .gallery-content, .showroom-content, .exhibition-content, .display-content, .showcase-content, .portfolio-content, .collection-content, .catalog-content, .directory-content, .listing-content, .index-content, .table-content, .grid-content, .list-content, .menu-content, .navigation-content, .sidebar-content, .widget-content, .module-content, .component-content, .element-content, .block-content, .section-content, .divider-content, .spacer-content, .container-content, .wrapper-content, .holder-content, .box-content, .panel-content, .card-content, .tile-content, .item-content, .entry-content, .post-content, .article-content, .page-content, .content-area, .content-block, .content-section, .content-wrapper, .content-container, .content-box, .content-panel, .content-card, .content-tile, .content-item, .content-entry, .content-post, .content-article, .content-page').first();

  if (mainContent.length === 0) {
    // If no main content container found, use body
    $('body script').remove();
    const bodyText = $('body').text().trim();
    if (bodyText) {
      return [{
        title: 'Main Content',
        html: bodyText,
        text: bodyText
      }];
    }
    return [];
  }
  console.log('Main Content HTML:', mainContent.html());
  console.log('Main Content Text:', mainContent.text());

  return splitByHeadings($, mainContent[0]);
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

// --- Modularized HTML Content Processing ---

/**
 * Extracts and cleans the main content from HTML using cheerio.
 */
function getLargestContentBlock($: cheerio.Root): cheerio.Cheerio {
  // Try <main>, <article>, <section> first
  const candidates = ['main', 'article', 'section'];
  let largest = null;
  let maxLen = 0;
  for (const tag of candidates) {
    $(tag).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > maxLen) {
        largest = $(el);
        maxLen = text.length;
      }
    });
  }
  // If none found, try <div> with class containing 'content'
  if (!largest) {
    $('div[class*="content"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > maxLen) {
        largest = $(el);
        maxLen = text.length;
      }
    });
  }
  // Fallback to body
  if (!largest) {
    largest = $('body');
  }
  return largest;
}

export function extractAndCleanContent(html: string): string {
  const $ = cheerio.load(html);
  // Remove unwanted elements
  $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar, .social-share, .comments, .related-posts, .newsletter, .popup, .modal, .banner, .notification, .cookie-notice, .privacy-notice, .terms-notice, .disclaimer, .legal-notice, .copyright, .footer-links, .social-links, .share-buttons, .newsletter-signup, .subscribe-form, .contact-form, .search-form, .login-form, .signup-form, .password-form, .reset-form, .forgot-form, .remember-form, .profile-form, .settings-form, .preferences-form, .notification-settings, .privacy-settings, .account-settings, .billing-settings, .payment-settings, .shipping-settings, .delivery-settings, .order-settings, .cart-settings, .wishlist-settings, .favorite-settings, .bookmark-settings, .save-settings, .share-settings, .export-settings, .import-settings, .backup-settings, .restore-settings, .sync-settings, .update-settings, .upgrade-settings, .downgrade-settings, .cancel-settings, .delete-settings, .remove-settings, .hide-settings, .show-settings, .toggle-settings, .switch-settings, .change-settings, .edit-settings, .modify-settings, .adjust-settings, .configure-settings, .customize-settings, .personalize-settings, .optimize-settings, .improve-settings, .enhance-settings').remove();
  // Convert tables to Markdown before extracting text
  $('table').each((_, el) => {
    const $el = $(el);
    const md = tableToMarkdown($el);
    $el.replaceWith(`<div class="markdown-table">${md}</div>`);
  });
  // Use the largest content block
  const mainBlock = getLargestContentBlock($);
  const mainText = mainBlock.text().trim();
  if (mainText) return cleanText(mainText);
  // Fallback to body
  return cleanText($('body').text().trim());
}

function cleanText(content: string): string {
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

function tableToMarkdown($table: cheerio.Cheerio): string {
  const $ = cheerio.load($table.html() || '');
  const rows = $('tr').toArray().map(row => {
    return $(row).find('th,td').toArray().map((cell: cheerio.Element) => {
      return $(cell).text().trim().replace(/\|/g, '\\|');
    });
  });
  if (rows.length === 0) return '';
  const header = rows[0];
  const body = rows.slice(1);
  const md = [
    '| ' + header.join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |',
    ...body.map(r => '| ' + r.join(' | ') + ' |')
  ];
  return md.join('\n');
}

export function deduplicateParagraphs(texts: string[]): { merged: string, uniqueCount: number } {
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const text of texts) {
    for (const para of text.split(/\n{2,}/)) {
      const trimmed = para.trim();
      // Do not skip short lines if they look like prices
      if (trimmed.length < 40 && !PRICE_REGEX.test(trimmed)) continue;
      const hash = hashString(trimmed);
      if (!seen.has(hash)) {
        seen.add(hash);
        paragraphs.push(trimmed);
      }
    }
  }
  return { merged: paragraphs.join('\n\n'), uniqueCount: paragraphs.length };
}

function hashString(str: string): string {
  // Simple hash for deduplication
  let hash = 0, i, chr;
  if (str.length === 0) return hash.toString();
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString();
}

export { splitByHeadings, splitHtmlIntoSections };
