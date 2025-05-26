import { DEFAULT_HEADERS } from '../config';

async function handleRedirect(response: Response, originalUrl: string): Promise<string | null> {
  const redirectUrl = response.headers.get('location');
  if (!redirectUrl) return null;

  const originalUrlObj = new URL(originalUrl);
  const redirectUrlObj = new URL(redirectUrl, originalUrl);
  
  if (redirectUrlObj.hostname !== originalUrlObj.hostname) {
    console.log(`[Crawler] Blocked external redirect from ${originalUrl} to ${redirectUrl}`);
    return null;
  }

  return fetchHtml(redirectUrlObj.href);
}

function isValidContentType(contentType: string | null): boolean {
  return contentType?.includes('text/html') ?? false;
}

// Function to fetch HTML content from a URL
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'manual' // Don't automatically follow redirects
    });

    // Check if we got a redirect
    if (response.status >= 300 && response.status < 400) {
      return handleRedirect(response, url);
    }

    if (!response.ok) {
      console.log(`[Crawler] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    if (!isValidContentType(response.headers.get('content-type'))) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[Crawler] Error fetching ${url}:`, error);
    return null;
  }
}

export { fetchHtml }; 