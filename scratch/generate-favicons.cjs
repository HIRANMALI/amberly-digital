const sharp = require('sharp');
const fs = require('fs');
const pngToIco = require('png-to-ico');

async function generate() {
  const svgBuffer = fs.readFileSync('public/favicon.svg');
  
  const highDensity = { density: 1024 };

  await sharp(svgBuffer, highDensity).resize(180, 180).toFile('public/apple-touch-icon.png');
  await sharp(svgBuffer, highDensity).resize(192, 192).toFile('public/favicon-192.png');
  await sharp(svgBuffer, highDensity).resize(512, 512).toFile('public/favicon-512.png');

  await sharp(svgBuffer, highDensity).resize(48, 48).toFile('public/favicon-48.png');
  await sharp(svgBuffer, highDensity).resize(32, 32).toFile('public/favicon-32.png');
  await sharp(svgBuffer, highDensity).resize(16, 16).toFile('public/favicon-16.png');

  const icoBuffer = await pngToIco([
    'public/favicon-48.png',
    'public/favicon-32.png',
    'public/favicon-16.png'
  ]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);

  fs.unlinkSync('public/favicon-48.png');
  fs.unlinkSync('public/favicon-32.png');
  fs.unlinkSync('public/favicon-16.png');
  
  console.log('Favicons generated successfully.');
}

generate().catch(console.error);
