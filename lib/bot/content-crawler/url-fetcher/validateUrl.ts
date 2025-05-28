import { URL_VALIDATION_CONFIG } from '@/lib/config/config';

// Function to validate URLs
function isValidLink(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    // Allow same domain and its subdomains
    if (
      parsedUrl.hostname !== baseUrl.hostname && 
      !parsedUrl.hostname.endsWith('.' + baseUrl.hostname)
    ) {
      return false;
    }
    // Skip social
    if (URL_VALIDATION_CONFIG.SOCIAL_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) return false;
    // Skip file extensions
    const pathname = parsedUrl.pathname.toLowerCase();
    if (URL_VALIDATION_CONFIG.SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) return false;
    // Skip patterns
    if (URL_VALIDATION_CONFIG.SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) return false;
    return true;
  } catch {
    return false;
  }
}

export { isValidLink }; 