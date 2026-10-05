import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const urlParams = new URL(request.url).searchParams;
  const targetUrl = urlParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote url: ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();
    
    // Extract file extension from Content-Type or targetUrl
    let ext = 'png';
    if (contentType.includes('video/mp4') || targetUrl.endsWith('.mp4')) ext = 'mp4';
    else if (contentType.includes('image/jpeg') || targetUrl.endsWith('.jpg') || targetUrl.endsWith('.jpeg')) ext = 'jpg';
    else if (contentType.includes('image/gif') || targetUrl.endsWith('.gif')) ext = 'gif';
    else if (contentType.includes('image/webp') || targetUrl.endsWith('.webp')) ext = 'webp';

    const filename = `download-${Date.now()}.${ext}`;

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to download file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
