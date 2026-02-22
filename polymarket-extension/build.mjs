/**
 * Custom build script for Polymarket Radar Chrome Extension.
 *
 * Strategy:
 *   1. esbuild → content.js  (IIFE, single bundled file — required for content scripts)
 *   2. esbuild → background.js (ESM module service worker)
 *   3. Vite   → popup.html + popup JS (React, tree-shaken)
 *   4. Copy manifest.json, icons → dist/
 */

import * as esbuild from 'esbuild';
import { build as viteBuild } from 'vite';
import { cpSync, mkdirSync, copyFileSync, existsSync } from 'fs';
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

console.log('🔨 Building popup (Vite + React)...');
await viteBuild({
  configFile: resolve(__dirname, 'vite.config.ts'),
  build: {
    emptyOutDir: false,
  },
  logLevel: 'warn',
});
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
