import type { APIRoute } from 'astro';
import { BLOG_POSTS } from '@/lib/blog-data';
import { SERVICES, CITIES, TOOLS } from '@/lib/seo-data';

const BASE_URL = 'https://amberlydigital.com.au';

export const GET: APIRoute = async () => {
  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = [];

  // 1. Static pages
  urls.push({ loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0' });
  urls.push({ loc: `${BASE_URL}/services`, changefreq: 'weekly', priority: '0.8' });
  urls.push({ loc: `${BASE_URL}/tools`, changefreq: 'weekly', priority: '0.8' });
  urls.push({ loc: `${BASE_URL}/blog`, changefreq: 'daily', priority: '0.8' });

  // 2. Individual Services
  Object.keys(SERVICES).forEach((service) => {
    urls.push({
      loc: `${BASE_URL}/services/${service}`,
      changefreq: 'weekly',
      priority: '0.7',
    });
  });

  // 3. Individual Tools
  Object.keys(TOOLS).forEach((tool) => {
    urls.push({
      loc: `${BASE_URL}/tools/${tool}`,
      changefreq: 'weekly',
      priority: '0.7',
    });
  });

  // 4. Dynamic Service-City locations
  Object.keys(SERVICES).forEach((service) => {
    Object.keys(CITIES).forEach((city) => {
      urls.push({
        loc: `${BASE_URL}/services/${service}/${city}`,
        changefreq: 'weekly',
        priority: '0.6',
      });
    });
  });

  // 5. Blog Posts
  Object.values(BLOG_POSTS).forEach((post) => {
    urls.push({
      loc: `${BASE_URL}/blog/${post.slug}`,
      lastmod: post.date,
      changefreq: 'monthly',
      priority: '0.6',
    });
  });

  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xmlString, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
};
