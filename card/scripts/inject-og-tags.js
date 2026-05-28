const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(distIndex, 'utf-8');

html = html.replace(
  /<meta name="viewport" content="[^"]*" \/>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
);

html = html.replace(
  '<link rel="icon" href="/favicon.ico" />',
  '<link rel="icon" type="image/png" href="/favicon.png" />',
);

const ogTags = `
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Salinda" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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

function copyToDist(srcRelative, distFileName) {
  fs.copyFileSync(
    path.join(__dirname, '..', srcRelative),
    path.join(__dirname, '../dist', distFileName),
  );
}

copyToDist('assets/joker.jpg', 'joker-preview.jpg');
copyToDist('web/manifest.json', 'manifest.json');
copyToDist('web/icon-192.png', 'icon-192.png');
copyToDist('web/icon-512.png', 'icon-512.png');
copyToDist('web/apple-touch-icon.png', 'apple-touch-icon.png');
copyToDist('web/favicon.png', 'favicon.png');

console.log('OG/PWA tags injected and static web assets copied to dist/');
