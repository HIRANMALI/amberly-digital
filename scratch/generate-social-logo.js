import sharp from 'sharp';
import fs from 'fs';

async function generate() {
  const width = 1080;
  const height = 1080;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="1080" height="1080">
  <!-- Solid Amber Background for perfect circular cropping on social platforms -->
  <rect x="0" y="0" width="48" height="48" fill="#f59e0b" />
  
  <!-- Vector Letter A (Converted to path) -->
  <path fill-rule="evenodd" clip-rule="evenodd" d="M 21.5 10 L 26.5 10 L 36.5 38 L 29.5 38 L 27.5 31 L 20.5 31 L 18.5 38 L 11.5 38 L 21.5 10 Z M 24 16 L 22 25 L 26 25 Z" fill="#090d16" />
</svg>`;

  fs.writeFileSync('public/social-media-profile.svg', svgContent);
  
  await sharp(Buffer.from(svgContent)).png().toFile('public/social-media-profile.png');
  
  console.log('Social media logos generated successfully.');
}

generate().catch(console.error);
