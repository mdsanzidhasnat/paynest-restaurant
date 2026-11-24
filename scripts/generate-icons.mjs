/**
 * Generates the PWA icons locally with Node built-ins only. No image library,
 * remote asset or network request is involved. Run with `npm run icons:generate`.
 *
 * The mark is an original cloche-and-plate symbol using the restaurant's
 * existing indigo/white/mint palette. The maskable variant keeps the whole
 * mark inside the central safe zone on a full-bleed background.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUTPUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

const INDIGO = [79, 70, 229]; // #4F46E5
const LIGHT_INDIGO = [199, 210, 254]; // #C7D2FE
const MINT = [16, 185, 129]; // #10B981
const WHITE = [255, 255, 255];

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[n] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, checksum]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function colourAt(x, y, size, maskable) {
  const scale = maskable ? 0.62 : 0.8;
  const mark = size * scale;
  const cx = size / 2;
  const plateY = size / 2 + mark * 0.2;
  const plateRx = mark * 0.36;
  const plateRy = mark * 0.055;
  const domeRx = mark * 0.28;
  const domeRy = mark * 0.3;

  if (insideEllipse(x, y, cx, plateY, plateRx, plateRy)) return LIGHT_INDIGO;

  const inDomeCircle = insideEllipse(x, y, cx, plateY, domeRx, domeRy);
  if (inDomeCircle && y <= plateY) return WHITE;

  if (insideEllipse(x, y, cx, plateY - domeRy - mark * 0.02, mark * 0.03, mark * 0.03)) {
    return WHITE;
  }
  if (insideEllipse(x, y, cx + mark * 0.12, plateY - mark * 0.12, mark * 0.024, mark * 0.024)) {
    return MINT;
  }
  return INDIGO;
}

function renderIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const offsets = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0];
      for (const [ox, oy] of offsets) {
        const colour = colourAt(x + ox, y + oy, size, maskable);
        for (let channel = 0; channel < 3; channel += 1) totals[channel] += colour[channel];
      }
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[index + channel] = Math.round(totals[channel] / offsets.length);
      }
      rgba[index + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [filename, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(path.join(OUTPUT_DIR, filename), renderIcon(size, maskable));
  console.log(`Wrote public/icons/${filename} (${size}x${size})`);
}
