declare module 'sitemap' {
  export interface SitemapItem {
    url: string;
    changefreq?: string;
    priority?: number;
    lastmod?: string;
  }

  export function parseSitemap(sitemapUrl: string): Promise<SitemapItem[]>;
} 