// Constants for URL validation
const SOCIAL_DOMAINS = [
  'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'whatsapp.com',
];
const SKIPPED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.css', '.js', '.json', '.xml', '.txt'
];
const SKIPPED_PATTERNS = [
  /\/tag\//i, /\/category\/page\//i, /\/archive\//i, /\/feed\//i, /\/rss\//i, /\/atom\//i,
  /\/sitemap\//i, /\/wp-/i, /\/wp-content\//i, /\/wp-includes\//i, /\/wp-admin\//i,
  /\/(page|p)[-_]?\d+/i, // e.g. /page_2
  /\/\d{4}\/\d{2}\/\d{2}/i, // date-based blog traps
  /\/product\/.+/i, /\/blog\//i, /\/news\//i, /\/article\//i, /\/posts\//i,
  /\?page=\d+/i, /\?p=\d+/i, /\/search\//i, /\/cart\//i, /\/checkout\//i,
  /\/admin\//i, /\/user\//i, /\/profile\//i
];

// Function to validate URLs
function isValidLink(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    // Only allow same domain or subdomain
    if (
      parsedUrl.hostname !== baseUrl.hostname &&
      !parsedUrl.hostname.endsWith('.' + baseUrl.hostname)
    ) {
      return false;
    }
    // Skip social
    if (SOCIAL_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) return false;
    // Skip file extensions
    const pathname = parsedUrl.pathname.toLowerCase();
    if (SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) return false;
    // Skip patterns
    if (SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) return false;
    return true;
  } catch {
    return false;
  }
}

export { isValidLink }; 