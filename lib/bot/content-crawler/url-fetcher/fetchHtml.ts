import { DEFAULT_HEADERS, URL_FETCHER_CONFIG } from '@/lib/config/config';

interface FetchResult {
  success: boolean;
  html?: string;
  finalUrl?: string;
  errorStatus?: number;
  errorMessage?: string;
  isRedirect?: boolean;
}

const MAX_REDIRECTS_FALLBACK = 5;
const XHTML_CONTENT_TYPE_FALLBACK = 'application/xhtml+xml';

// Function to fetch HTML content from a URL, handling redirects internally.
export async function fetchRawHtmlContent(
  initialUrl: string,
  redirectCount: number = 0
): Promise<FetchResult> {

  if (redirectCount > MAX_REDIRECTS_FALLBACK) {
    return { success: false, errorMessage: 'Maximum redirects exceeded', finalUrl: initialUrl };
  }

  try {
    const response = await fetch(initialUrl, {
      headers: DEFAULT_HEADERS,
      // Assuming URL_FETCHER_CONFIG.REDIRECT.MANUAL is guaranteed to exist by the linter errors.
      redirect: URL_FETCHER_CONFIG.REDIRECT.MANUAL, 
    });

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const newUrl = new URL(location, initialUrl).toString();
        return fetchRawHtmlContent(newUrl, redirectCount + 1); // Recursive call for redirect
      } else {
        return { success: false, errorStatus: response.status, errorMessage: 'Redirect location header missing', finalUrl: initialUrl, isRedirect: true };
      }
    }

    if (!response.ok) {
      return { success: false, errorStatus: response.status, errorMessage: `HTTP error: ${response.status}`, finalUrl: initialUrl };
    }

    const contentType = response.headers.get('content-type');
    // Assuming URL_FETCHER_CONFIG.CONTENT_TYPES.HTML is guaranteed to exist.
    const htmlContentType = URL_FETCHER_CONFIG.CONTENT_TYPES.HTML;

    const acceptedHtmlTypes = [htmlContentType, XHTML_CONTENT_TYPE_FALLBACK];
    
    if (!contentType || !acceptedHtmlTypes.some(type => type && contentType.includes(type))) {
      return { success: false, errorMessage: `Skipped non-HTML content type: ${contentType}`, finalUrl: initialUrl };
    }

    const html = await response.text();
    return { success: true, html, finalUrl: initialUrl };

  } catch (error: any) {
    console.error(`[fetchRawHtmlContent] Error fetching ${initialUrl}:`, error);
    return { success: false, errorMessage: error.message || 'Unknown fetch error', finalUrl: initialUrl };
  }
} 