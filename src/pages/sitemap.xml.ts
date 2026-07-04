import type { APIRoute } from 'astro';
import { BLOG_POSTS } from '@/lib/blog-data';
import { SERVICES, TOOLS } from '@/lib/seo-data';

const BASE_URL = 'https://amberlydigital.com';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

export const GET: APIRoute = async () => {
  const urls: SitemapUrl[] = [];
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Homepage (Priority 1.0)
  urls.push({
    loc: `${BASE_URL}/`,
    priority: 1.0,
    changefreq: 'daily',
    lastmod: currentDate
  });

  // 2. Free AI Generation Landing Pages (Priority 0.9)
  urls.push({
    loc: `${BASE_URL}/free-image-generation`,
    priority: 0.9,
    changefreq: 'weekly',
    lastmod: currentDate
  });
  urls.push({
    loc: `${BASE_URL}/free-video-generation`,
    priority: 0.9,
    changefreq: 'weekly',
    lastmod: currentDate
  });

  // 3. Services Pages (Priority 0.8)
  urls.push({
    loc: `${BASE_URL}/services`,
    priority: 0.8,
    changefreq: 'weekly',
    lastmod: currentDate
  });
  Object.keys(SERVICES).forEach((service) => {
    urls.push({
      loc: `${BASE_URL}/services/${service}`,
      priority: 0.8,
      changefreq: 'weekly',
      lastmod: currentDate
    });
  });

  // 4. AI Studio Pages (Priority 0.7)
  urls.push({
    loc: `${BASE_URL}/ai-studio`,
    priority: 0.7,
    changefreq: 'weekly',
    lastmod: currentDate
  });
  Object.keys(TOOLS).forEach((tool) => {
    urls.push({
      loc: `${BASE_URL}/ai-studio/${tool}`,
      priority: 0.7,
      changefreq: 'weekly',
      lastmod: currentDate
    });
  });

  // 5. Blog Pages (Priority 0.6)
  urls.push({
    loc: `${BASE_URL}/blog`,
    priority: 0.6,
    changefreq: 'monthly',
    lastmod: currentDate
  });
  Object.values(BLOG_POSTS).forEach((post) => {
    urls.push({
      loc: `${BASE_URL}/blog/${post.slug}`,
      priority: 0.6,
      changefreq: 'monthly',
      lastmod: post.date,
    });
  });

  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''}${url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority !== undefined ? `\n    <priority>${url.priority.toFixed(1)}</priority>` : ''}
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
