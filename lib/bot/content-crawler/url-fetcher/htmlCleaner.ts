import * as cheerio from 'cheerio';

/**
 * Removes unwanted elements from HTML and extracts main content
 */
export function cleanAndExtractMainContent(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, footer, header, .ads, .advertisement, .cookie-banner, .menu, .sidebar, .social-share, .comments, .related-posts, .newsletter, .popup, .modal, .banner, .notification, .cookie-notice, .privacy-notice, .terms-notice, .disclaimer, .legal-notice, .copyright, .footer-links, .social-links, .share-buttons, .newsletter-signup, .subscribe-form, .contact-form, .search-form, .login-form, .signup-form, .password-form, .reset-form, .forgot-form, .remember-form, .profile-form, .settings-form, .preferences-form, .notification-settings, .privacy-settings, .account-settings, .billing-settings, .payment-settings, .shipping-settings, .delivery-settings, .order-settings, .cart-settings, .wishlist-settings, .favorite-settings, .bookmark-settings, .save-settings, .share-settings, .export-settings, .import-settings, .backup-settings, .restore-settings, .sync-settings, .update-settings, .upgrade-settings, .downgrade-settings, .cancel-settings, .delete-settings, .remove-settings, .hide-settings, .show-settings, .toggle-settings, .switch-settings, .change-settings, .edit-settings, .modify-settings, .adjust-settings, .configure-settings, .customize-settings, .personalize-settings, .optimize-settings, .improve-settings, .enhance-settings').remove();

  // Convert tables to Markdown before extracting text
  $('table').each((_, el) => {
    const $el = $(el);
    const md = tableToMarkdown($el);
    $el.replaceWith(`<div class="markdown-table">${md}</div>`);
  });

  // Get main content
  const mainContent = getLargestContentBlock($);
  const mainText = mainContent.text().trim();
  
  return cleanText(mainText || $('body').text().trim());
}

/**
 * Gets the largest content block from the HTML
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
  return largest || $('body');
}

/**
 * Converts an HTML table to Markdown format
 */
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

/**
 * Cleans text content by removing extra whitespace and normalizing
 */
function cleanText(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .replace(/\n+/g, '\n')   // Collapse newlines
    .replace(/[^\S\n]+/g, ' ') // Collapse spaces except newlines
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .replace(/\n\s*\n/g, '\n\n') // Collapse multiple empty lines
    .trim();
} 