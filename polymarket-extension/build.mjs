/**
 * Custom build script for Polymarket Radar Chrome Extension.
 *
 * Strategy:
 *   1. esbuild → content.js   (IIFE — required for content scripts)
 *   2. esbuild → background.js (ESM module service worker)
 *   3. esbuild → popup.js     (IIFE — avoids Vite's crossorigin/absolute-path issues)
 *   4. Write popup.html with plain <script src="popup.js"> (no type=module)
 *   5. Copy manifest.json, icons → dist/
 */

import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, copyFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, 'dist');

// Ensure dist directory exists
mkdirSync(dist, { recursive: true });
mkdirSync(resolve(dist, 'icons'), { recursive: true });

console.log('🔨 Building content script (IIFE)...');
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/content/index.ts')],
  bundle: true,
  outfile: resolve(dist, 'content.js'),
  format: 'iife',
  globalName: 'PolymarketRadar',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: false,
  minify: false,
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
console.log('✓ content.js');

console.log('🔨 Building background service worker (ESM)...');
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/background/service-worker.ts')],
  bundle: true,
  outfile: resolve(dist, 'background.js'),
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: false,
  minify: false,
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
console.log('✓ background.js');

console.log('🔨 Building popup (esbuild + React)...');
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/popup/main.tsx')],
  bundle: true,
  outfile: resolve(dist, 'popup.js'),
  format: 'iife',
  globalName: 'PolymarketPopup',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: false,
  minify: false,
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  jsx: 'automatic',
});

// Write popup.html with a plain <script> tag (no type=module, no crossorigin)
writeFileSync(
  resolve(dist, 'popup.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Polymarket Radar</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 360px; min-height: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="popup.js"></script>
  </body>
</html>`
);
console.log('✓ popup.html + popup.js');

console.log('📋 Copying static assets...');

// Copy manifest
copyFileSync(
  resolve(__dirname, 'manifest.json'),
  resolve(dist, 'manifest.json')
);

// Copy icons (SVG or PNG)
const iconsDir = resolve(__dirname, 'public/icons');
if (existsSync(iconsDir)) {
  cpSync(iconsDir, resolve(dist, 'icons'), { recursive: true });
}

console.log('✓ Static assets copied');
console.log('');
console.log('✅ Build complete → dist/');
console.log('   Load dist/ as unpacked extension in Chrome:');
console.log('   chrome://extensions → Developer mode → Load unpacked');
