const sharp = require('sharp');
const path = require('path');

const createScreenshot = async (width, height, label, outputPath) => {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      <text x="50%" y="45%" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="bold">DROP IN</text>
      <text x="50%" y="55%" text-anchor="middle" fill="white" font-family="system-ui" font-size="24" opacity="0.8">${label}</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log('Created:', outputPath);
};

Promise.all([
  createScreenshot(1280, 720, 'Desktop', 'public/icons/screenshot-desktop.png'),
  createScreenshot(390, 844, 'Mobile', 'public/icons/screenshot-mobile.png')
]).then(() => console.log('Done!')).catch(e => console.error(e));