/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://skedy.io/', // Reemplaza con tu dominio real
  generateRobotsTxt: true, // Opcional: genera también el robots.txt
  exclude: [
    '/components-preview',
    '/dashboard',
    '/debug-chat',
    '/debug-escalations',
    '/invite',
    '/onboarding',
    '/pdf-parser',
    '/test-whatsapp',
    '/sign-in',
    '/sign-up',
  ],
  generateIndexSitemap: true,
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,
  // Configuraciones específicas para App Router
  additionalPaths: async (config) => {
    const result = [
      {
        loc: '/',
        changefreq: 'daily',
        priority: 1.0,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/services',
        changefreq: 'daily',
        priority: 0.8,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/contact',
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/about',
        changefreq: 'monthly',
        priority: 0.7,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/privacy',
        changefreq: 'monthly',
        priority: 0.5,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/terms',
        changefreq: 'monthly',
        priority: 0.5,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/faq',
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date().toISOString(),
      },
      {
        loc: '/blog',
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: new Date().toISOString(),
      },
    ];
    return result;
  },
}; 