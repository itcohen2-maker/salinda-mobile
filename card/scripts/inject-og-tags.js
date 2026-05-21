const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(distIndex, 'utf-8');

const ogTags = `
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://salinda-mobile.vercel.app/" />
  <meta property="og:title" content="Salinda / סלינדה" />
  <meta property="og:description" content="משחק קלפים חברתי – סלינדה 🃏" />
  <meta property="og:image" content="https://salinda-mobile.vercel.app/joker-preview.jpg" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="1024" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://salinda-mobile.vercel.app/joker-preview.jpg" />`;

html = html.replace('</head>', `${ogTags}\n</head>`);
fs.writeFileSync(distIndex, html);

// Copy joker image to dist as static asset for the preview
const jokerSrc = path.join(__dirname, '../assets/joker.jpg');
const jokerDst = path.join(__dirname, '../dist/joker-preview.jpg');
fs.copyFileSync(jokerSrc, jokerDst);

console.log('OG tags injected and joker-preview.jpg copied to dist/');
