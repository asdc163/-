/**
 * Generates PNG icons from SVG data using pure JavaScript (no native deps).
 * Creates 16x16, 48x48, and 128x128 PNGs with a simple teal radar design.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../public/icons');
mkdirSync(iconsDir, { recursive: true });

// Minimal PNG encoder (pure JS, no dependencies)
function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row

  function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function deflate(data) {
    // Simple uncompressed deflate (zlib level 0)
    const chunks = [];
    const BLOCK_SIZE = 32768;
    for (let i = 0; i < data.length; i += BLOCK_SIZE) {
      const block = data.slice(i, i + BLOCK_SIZE);
      const last = i + BLOCK_SIZE >= data.length ? 1 : 0;
      const header = new Uint8Array([last, block.length & 0xff, (block.length >> 8) & 0xff, ~block.length & 0xff, (~block.length >> 8) & 0xff]);
      chunks.push(header, block);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(2 + totalLen + 4);
    out[0] = 0x78; out[1] = 0x01;
    let offset = 2;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    // Adler32
    let s1 = 1, s2 = 0;
    for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
    const adler = (s2 << 16) | s1;
    out[offset] = (adler >> 24) & 0xff; out[offset+1] = (adler >> 16) & 0xff;
    out[offset+2] = (adler >> 8) & 0xff; out[offset+3] = adler & 0xff;
    return out;
  }

  function chunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length, false);
    const crcInput = new Uint8Array(typeBytes.length + data.length);
    crcInput.set(typeBytes); crcInput.set(data, typeBytes.length);
    const crcVal = new Uint8Array(4);
    new DataView(crcVal.buffer).setUint32(0, crc32(crcInput), false);
    return [len, typeBytes, data, crcVal];
  }

  // Build raw image data with filter bytes
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2]; raw[dst+3] = pixels[src+3];
    }
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width, false); dv.setUint32(4, height, false);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = deflate(raw);

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', idat),
    ...chunk('IEND', new Uint8Array(0)),
  ];

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) { result.set(p, offset); offset += p.length; }
  return result;
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2, cy = size / 2;
  const bg = [13, 148, 136, 255];     // teal #0d9488
  const white = [255, 255, 255, 255];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r = size / 2;

      // Background circle
      if (dist > r) {
        pixels[idx + 3] = 0; // transparent outside circle
        continue;
      }

      // Default: teal background
      pixels[idx] = bg[0]; pixels[idx+1] = bg[1];
      pixels[idx+2] = bg[2]; pixels[idx+3] = bg[3];

      // Draw concentric rings
      const rings = [0.65, 0.42, 0.18].map(f => f * r);
      const lineW = Math.max(1, size / 40);

      for (const rr of rings) {
        if (Math.abs(dist - rr) < lineW) {
          const alpha = Math.max(0.3, 1 - rings.indexOf(rr) * 0.2);
          pixels[idx] = Math.round(255 * alpha + bg[0] * (1 - alpha));
          pixels[idx+1] = Math.round(255 * alpha + bg[1] * (1 - alpha));
          pixels[idx+2] = Math.round(255 * alpha + bg[2] * (1 - alpha));
          pixels[idx+3] = 255;
        }
      }

      // Center dot
      if (dist < r * 0.12) {
        pixels[idx] = 255; pixels[idx+1] = 255;
        pixels[idx+2] = 255; pixels[idx+3] = 255;
      }

      // Crosshair lines (4 directions)
      const crossW = Math.max(1, size / 48);
      const inCross = (
        (Math.abs(dx) < crossW && dist > r * 0.12 && dist < r * 0.65) ||
        (Math.abs(dy) < crossW && dist > r * 0.12 && dist < r * 0.65)
      );
      if (inCross) {
        const alpha = 0.7;
        pixels[idx] = Math.round(255 * alpha + bg[0] * (1 - alpha));
        pixels[idx+1] = Math.round(255 * alpha + bg[1] * (1 - alpha));
        pixels[idx+2] = Math.round(255 * alpha + bg[2] * (1 - alpha));
        pixels[idx+3] = 255;
      }
    }
  }

  return pixels;
}

for (const size of [16, 48, 128]) {
  const pixels = drawIcon(size);
  const png = createPNG(size, size, pixels);
  const path = resolve(iconsDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`✓ icon${size}.png`);
}
