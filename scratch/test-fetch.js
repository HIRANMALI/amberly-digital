async function test() {
  const url = 'https://www.amazon.in';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Status Code:', response.status);
    const text = await response.text();
    console.log('HTML Length:', text.length);
    console.log('First 600 chars of HTML:', text.substring(0, 600));
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    console.log('Extracted Title:', titleMatch ? titleMatch[1].trim() : 'None');
  } catch (e) {
    console.error('Error fetching:', e);
  }
}

test();
