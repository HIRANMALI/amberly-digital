import type { APIRoute } from 'astro';
import { BLOG_POSTS } from '@/lib/blog-data';
import { SERVICES, CITIES, TOOLS } from '@/lib/seo-data';

const BASE_URL = 'https://amberlydigital.com';

export const GET: APIRoute = async () => {
  const urls: { loc: string; lastmod?: string }[] = [];

  // 1. Static pages
  urls.push({ loc: `${BASE_URL}/` });
  urls.push({ loc: `${BASE_URL}/services` });
  urls.push({ loc: `${BASE_URL}/tools` });
  urls.push({ loc: `${BASE_URL}/blog` });

  // 2. Individual Services
  Object.keys(SERVICES).forEach((service) => {
    urls.push({ loc: `${BASE_URL}/services/${service}` });
  });

  // 3. Individual Tools
  Object.keys(TOOLS).forEach((tool) => {
    urls.push({ loc: `${BASE_URL}/tools/${tool}` });
  });

  // 4. Dynamic Service-City locations
  Object.keys(SERVICES).forEach((service) => {
    Object.keys(CITIES).forEach((city) => {
      urls.push({ loc: `${BASE_URL}/services/${service}/${city}` });
    });
  });

  // 5. Blog Posts
  Object.values(BLOG_POSTS).forEach((post) => {
    urls.push({
      loc: `${BASE_URL}/blog/${post.slug}`,
      lastmod: post.date,
    });
  });

  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ''}
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
