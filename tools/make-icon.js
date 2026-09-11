'use strict';

// Renders the CSS front face into a 1024x1024 macOS-style rounded-square
// icon PNG (build/icon.png), using Electron's own page capture so the
// artwork matches the app exactly. Run via: npm run icon
//
// After this, build/icon.png is converted to build/icon.icns by
// tools/make-icns.sh.

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function frontMarkup() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const start = html.indexOf('<div class="camera-front shell"');
  const end = html.indexOf('<!-- ============ BACK');
  return html.slice(start, end).trim();
}

function buildPage() {
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const front = frontMarkup();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: 1024px; height: 1024px; background: transparent; overflow: hidden; }
    .icon-bg {
      position: absolute; inset: 0;
      border-radius: 229px; /* macOS squircle-ish corner for 1024 */
      background: linear-gradient(155deg, #fff7e6 0%, #ffe6a8 45%, #ffcf72 100%);
      box-shadow: inset 0 -18px 60px rgba(180,120,0,0.18), inset 0 6px 0 rgba(255,255,255,0.6);
    }
    .icon-camera {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -50%) scale(1.62);
      transform-origin: center;
      filter: drop-shadow(0 20px 30px rgba(80,50,0,0.28));
    }
    ${styles}
  </style></head><body>
    <div class="icon-bg"></div>
    <div class="icon-camera">${front}</div>
  </body></html>`;
}

app.whenReady().then(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });

  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: false },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(buildPage()));
  // give fonts/layout a moment to settle
  await new Promise((r) => setTimeout(r, 500));

  const image = await win.webContents.capturePage();
  const png = image.toPNG();
  const out = path.join(root, 'build', 'icon.png');
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} ${JSON.stringify(image.getSize())} (${png.length} bytes)`);

  app.quit();
});

app.on('window-all-closed', () => app.quit());
