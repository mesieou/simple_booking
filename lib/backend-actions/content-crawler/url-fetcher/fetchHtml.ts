import { DEFAULT_HEADERS, URL_FETCHER_CONFIG } from '@/lib/general-config/general-config';

/** Represents the outcome of a fetch attempt, including handling of redirects and content type validation. */
export interface FetchResult {
  success: boolean;
  html?: string;
  finalUrl?: string; // The URL after all redirects, or the initial URL if no redirects or on error.
  errorStatus?: number;
  errorMessage?: string;
  isRedirectProblem?: boolean; // Specifically for issues during redirect handling (e.g. missing location)
}

const MAX_REDIRECTS_FALLBACK = 5;
const XHTML_CONTENT_TYPE_FALLBACK = 'application/xhtml+xml';

/**
 * Handles a redirect response by attempting to follow the location header.
 * @param response The fetch Response object (should be a redirect).
 * @param currentUrl The URL that led to this redirect.
 * @param redirectCount The current count of redirects followed for this request chain.
 * @returns A Promise resolving to a FetchResult, either from a subsequent fetch or an error.
 */
async function _handleRedirect(
  response: Response,
  currentUrl: string,
  redirectCount: number
): Promise<FetchResult> {
  // Extract the Location header to find the new URL.
  const locationHeader = response.headers.get('location');
  if (locationHeader) {
    let newUrl: string;
    try {
      // Resolve the new URL, which might be relative, against the current URL.
      newUrl = new URL(locationHeader, currentUrl).toString();
    } catch (e) {
      return { 
        success: false, 
        errorStatus: response.status, 
        errorMessage: `Invalid redirect location format: ${locationHeader}`,
        finalUrl: currentUrl, 
        isRedirectProblem: true 
      };
    }
    // Recursively call fetchRawHtmlContent to follow the redirect.
    return fetchRawHtmlContent(newUrl, redirectCount + 1);
  } else {
    // If Location header is missing on a redirect, it's an error.
    return { 
      success: false, 
      errorStatus: response.status, 
      errorMessage: 'Redirect location header missing', 
      finalUrl: currentUrl, 
      isRedirectProblem: true 
    };
  }
}

/**
 * Validates if the provided Content-Type string indicates an HTML or XHTML document.
 * @param contentType The Content-Type header string from the HTTP response.
 * @returns True if the content type is considered valid HTML/XHTML, false otherwise.
 */
function _isValidHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false; // No content type header present.
  }
  // Use configured HTML content type and a common XHTML fallback.
  const htmlContentType = URL_FETCHER_CONFIG.CONTENT_TYPES.HTML;
  const acceptedHtmlTypes = [htmlContentType, XHTML_CONTENT_TYPE_FALLBACK];
  
  // Check if the response content type includes any of the accepted types.
  return acceptedHtmlTypes.some(type => type && contentType.toLowerCase().includes(type.toLowerCase()));
}

/**
 * Fetches raw HTML content from a URL, handling redirects and basic content type validation.
 * @param initialUrl The URL to fetch content from.
 * @param redirectCount The current number of redirects already followed for this request chain (internal use).
 * @returns A Promise resolving to a FetchResult object detailing the outcome of the fetch attempt.
 */
export async function fetchRawHtmlContent(
  initialUrl: string,
  redirectCount: number = 0
): Promise<FetchResult> {

  // Prevent infinite redirect loops by checking against a maximum limit.
  if (redirectCount > MAX_REDIRECTS_FALLBACK) {
    return { success: false, errorMessage: 'Maximum redirects exceeded', finalUrl: initialUrl };
  }

  try {
    // Perform the HTTP fetch request with manual redirect handling.
    const response = await fetch(initialUrl, {
      headers: DEFAULT_HEADERS,
      redirect: URL_FETCHER_CONFIG.REDIRECT.MANUAL, // Rely on config for 'manual' string.
    });

    // Stage 1: Handle HTTP redirects (3xx status codes).
    if (response.status >= 300 && response.status < 400) {
      return _handleRedirect(response, initialUrl, redirectCount);
    }

    // Stage 2: Check for non-successful HTTP responses (e.g., 4xx, 5xx).
    if (!response.ok) {
      return { 
        success: false, 
        errorStatus: response.status, 
        errorMessage: `HTTP error: ${response.statusText || response.status}`,
        finalUrl: initialUrl 
      };
    }

    // Stage 3: Validate the Content-Type header to ensure it's HTML/XHTML.
    const contentType = response.headers.get('content-type');
    if (!_isValidHtmlContentType(contentType)) {
      return { 
        success: false, 
        errorMessage: `Skipped non-HTML content type: ${contentType || 'N/A'}`,
        finalUrl: initialUrl 
      };
    }

    // Stage 4: Extract HTML text from the successful response.
    const html = await response.text();
    return { success: true, html, finalUrl: initialUrl }; // finalUrl here is correct as we didn't redirect from *this* call

  } catch (error: any) {
    // Handle network errors or other exceptions during the fetch process.
    console.error(`[fetchRawHtmlContent] Network or fetch error for ${initialUrl}:`, error.message || error);
    return { 
      success: false, 
      errorMessage: error.message || 'Unknown network or fetch error', 
      finalUrl: initialUrl 
    };
  }
} 