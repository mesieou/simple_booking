import got from 'got';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import normalizeUrl from 'normalize-url';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
};

const SOCIAL_DOMAINS = [
  'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'whatsapp.com',
];

// Common TLDs for international domains
const COMMON_TLDS = [
  'com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'uk', 'de', 'fr', 'es', 'it',
  'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'pt', 'gr', 'hu', 'cz',
  'sk', 'ro', 'bg', 'hr', 'rs', 'si', 'me', 'mk', 'al', 'ba', 'md', 'ua', 'by',
  'ru', 'tr', 'il', 'ae', 'sa', 'qa', 'kw', 'bh', 'om', 'jo', 'eg', 'za', 'ng',
  'ke', 'ma', 'dz', 'tn', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'sg', 'my', 'id',
  'ph', 'vn', 'th', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 've', 'ec', 'uy', 'py',
  'bo', 'cr', 'pa', 'do', 'pr', 'gt', 'sv', 'hn', 'ni', 'cu'
];

const SKIPPED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.tar', '.gz', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.css', '.js', '.json', '.xml', '.txt'
];

const SKIPPED_PARAMS = [
  'utm_', 'ref_', 'source_', 'campaign_', 'medium_',
  'fbclid', 'gclid', 'msclkid', 'dclid',
  'share', 'share=', 'share?',
  'print', 'print=', 'print?',
  'preview', 'preview=', 'preview?'
];

const SKIPPED_PATTERNS = [
  /\/tag\//i,
  /\/category\/page\//i,
  /\/archive\//i,
  /\/feed\//i,
  /\/rss\//i,
  /\/atom\//i,
  /\/sitemap\//i,
  /\/wp-/i,
  /\/wp-content\//i,
  /\/wp-includes\//i,
  /\/wp-admin\//i,
  /\/wp-json\//i,
  /\/wp-login\//i,
  /\/wp-register\//i,
  /\/wp-signup\//i,
  /\/wp-cron\//i,
  /\/wp-trackback\//i,
  /\/wp-comments\//i,
  /\/wp-feed\//i,
  /\/wp-rss\//i,
  /\/wp-atom\//i,
  /\/wp-rdf\//i,
  /\/wp-rss2\//i,
  /\/wp-rss3\//i,
  /\/wp-rss4\//i,
  /\/wp-rss5\//i,
  /\/wp-rss6\//i,
  /\/wp-rss7\//i,
  /\/wp-rss8\//i,
  /\/wp-rss9\//i,
  /\/wp-rss10\//i,
  /\/wp-rss11\//i,
  /\/wp-rss12\//i,
  /\/wp-rss13\//i,
  /\/wp-rss14\//i,
  /\/wp-rss15\//i,
  /\/wp-rss16\//i,
  /\/wp-rss17\//i,
  /\/wp-rss18\//i,
  /\/wp-rss19\//i,
  /\/wp-rss20\//i
];

const URL_CATEGORY_PATTERNS = {
  services: [
    /\/services\//i,
    /\/our-services\//i,
    /\/what-we-do\//i,
    /\/offerings\//i
  ],
  about: [
    /\/about\//i,
    /\/about-us\//i,
    /\/company\//i,
    /\/team\//i,
    /\/our-story\//i,
    /\/history\//i
  ],
  contact: [
    /\/contact\//i,
    /\/contact-us\//i,
    /\/get-in-touch\//i,
    /\/locations\//i,
    /\/find-us\//i
  ],
  blog: [
    /\/blog\//i,
    /\/news\//i,
    /\/articles\//i,
    /\/insights\//i,
    /\/resources\//i
  ],
  products: [
    /\/products\//i,
    /\/solutions\//i,
    /\/offerings\//i,
    /\/services\//i
  ],
  pricing: [
    /\/pricing\//i,
    /\/plans\//i,
    /\/packages\//i,
    /\/rates\//i
  ],
  faq: [
    /\/faq\//i,
    /\/faqs\//i,
    /\/help\//i,
    /\/support\//i
  ],
  testimonials: [
    /\/testimonials\//i,
    /\/reviews\//i,
    /\/case-studies\//i,
    /\/clients\//i
  ],
  careers: [
    /\/careers\//i,
    /\/jobs\//i,
    /\/work-with-us\//i,
    /\/join-us\//i
  ],
  booking: [
    /\/book\//i,
    /\/booking\//i,
    /\/schedule\//i,
    /\/appointment\//i
  ],
  quote: [
    /\/quote\//i,
    /\/get-a-quote\//i,
    /\/request-quote\//i,
    /\/estimate\//i
  ]
};

function isRelatedDomain(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    const baseHostname = baseUrl.hostname;
    const urlHostname = parsedUrl.hostname;

    // If it's the same domain, it's related
    if (urlHostname === baseHostname) {
      return true;
    }

    // Check if it's a subdomain of the base domain
    if (urlHostname.endsWith('.' + baseHostname)) {
      return true;
    }

    // Check if it's a parent domain
    if (baseHostname.endsWith('.' + urlHostname)) {
      return true;
    }

    // Check for international domains (e.g., example.com and example.co.uk)
    const baseParts = baseHostname.split('.');
    const urlParts = urlHostname.split('.');
    
    // If they have the same main domain name
    if (baseParts[0] === urlParts[0]) {
      // Check if the TLDs are related (e.g., com and co.uk)
      const baseTLD = baseParts.slice(-2).join('.');
      const urlTLD = urlParts.slice(-2).join('.');
      
      // If either TLD is in our common list, consider them related
      if (COMMON_TLDS.includes(baseTLD) || COMMON_TLDS.includes(urlTLD)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isValidUrl(url: string, baseUrl: URL): boolean {
  try {
    const parsedUrl = new URL(url);
    const canonicalUrl = normalizeUrl(url, {
      stripHash: true,
      stripWWW: true,
      removeTrailingSlash: true,
      removeQueryParameters: [/^utm_/i, /^ref_/i],
      sortQueryParameters: true
    });
    
    // Skip URLs with hash fragments
    if (parsedUrl.hash) {
      return false;
    }

    // Skip URLs with file extensions
    const pathname = parsedUrl.pathname.toLowerCase();
    if (SKIPPED_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      return false;
    }

    // Skip URLs with certain query parameters
    const searchParams = parsedUrl.searchParams;
    if (SKIPPED_PARAMS.some(param => 
      Array.from(searchParams.keys()).some(key => key.startsWith(param))
    )) {
      return false;
    }

    // Skip URLs with certain patterns
    if (SKIPPED_PATTERNS.some(pattern => pattern.test(pathname))) {
      return false;
    }

    // Check if it's a social media domain
    if (SOCIAL_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
      return false;
    }

    // Allow all other URLs, including external ones
    return true;
  } catch {
    return false;
  }
}

export function getCategoryFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();
  
  // Check for specific patterns first
  if (pathname.includes('/blog/') || pathname.includes('/news/') || pathname.includes('/articles/')) {
    return 'blog';
  }
  
  if (pathname.includes('/services/') || pathname.includes('/our-services/') || pathname.includes('/what-we-do/')) {
    return 'services';
  }
  
  if (pathname.includes('/about/') || pathname.includes('/about-us/') || pathname.includes('/company/')) {
    return 'about';
  }
  
  if (pathname.includes('/contact/') || pathname.includes('/contact-us/') || pathname.includes('/get-in-touch/')) {
    return 'contact';
  }
  
  if (pathname.includes('/products/') || pathname.includes('/solutions/')) {
    return 'products';
  }
  
  if (pathname.includes('/pricing/') || pathname.includes('/plans/') || pathname.includes('/packages/')) {
    return 'pricing';
  }
  
  if (pathname.includes('/faq/') || pathname.includes('/faqs/') || pathname.includes('/help/')) {
    return 'faq';
  }
  
  if (pathname.includes('/testimonials/') || pathname.includes('/reviews/') || pathname.includes('/case-studies/')) {
    return 'testimonials';
  }
  
  if (pathname.includes('/careers/') || pathname.includes('/jobs/') || pathname.includes('/work-with-us/')) {
    return 'careers';
  }
  
  if (pathname.includes('/book/') || pathname.includes('/booking/') || pathname.includes('/schedule/')) {
    return 'booking';
  }
  
  if (pathname.includes('/quote/') || pathname.includes('/get-a-quote/') || pathname.includes('/request-quote/')) {
    return 'quote';
  }
  
  // Default to 'services' for the homepage or when no category is found
  if (pathname === '/' || pathname === '') {
    return 'services';
  }
  
  // For other pages without a clear category, use 'about'
  return 'about';
}

export async function getLinks(baseUrl: string): Promise<string[]> {
  try {
    const res = await got(baseUrl, { headers: HEADERS, timeout: { request: 10000 } });
    const $ = cheerio.load(res.body);

    const parsedBase = new URL(baseUrl);
    const validLinks = new Set<string>();

    console.log(`\nExtracting links from ${baseUrl}:`);

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

      try {
        const fullUrl = new URL(href, parsedBase).toString();
        const parsed = new URL(fullUrl);

        // Process both internal and related external links
        if (isRelatedDomain(fullUrl, parsedBase)) {
          const cleanUrl = normalizeUrl(fullUrl, {
            stripHash: true,
            stripWWW: true,
            removeTrailingSlash: true,
            removeQueryParameters: [/^utm_/i, /^ref_/i],
            sortQueryParameters: true
          });

          if (isValidUrl(cleanUrl, parsedBase)) {
            validLinks.add(cleanUrl);
            console.log('Valid:', cleanUrl);
          } else {
            console.log('Skipped:', cleanUrl);
          }
        } else {
          console.log('Skipped external:', fullUrl);
        }
      } catch {
        // Ignore malformed URLs
      }
    });

    console.log('\nSummary:');
    console.log(`Valid links found: ${validLinks.size}`);

    return Array.from(validLinks);
  } catch (err: any) {
    console.warn(`⚠️ Error fetching ${baseUrl}: ${err.message}`);
    return [];
  }
} 