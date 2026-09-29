/**
 * Rasterises the monogram SVG and packs a multi-size .ico.
 *
 * Kept separate from the Python generator so the only Node dependency is
 * `sharp`, which is already present in the tree. Invoked once by
 * `scripts/generate-icons.py`; not part of the app build.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const [, , svgPath, outDir, sizesJson] = process.argv;
const sizes = JSON.parse(sizesJson);
const svg = readFileSync(svgPath);

/**
 * Builds an ICO from already-rasterised PNG buffers.
 *
 * The container format is trivial: a 6-byte header, then one 16-byte directory
 * entry per image, then the image bytes. Storing PNGs inside is the modern
 * variant and every current browser understands it; the old BMP encoding is
 * only needed for pre-2005 Windows.
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach((entry, index) => {
    const at = index * 16;
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 0); // 0 => 256
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(entry.data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.data)]);
}

const pngs = new Map();

for (const size of sizes) {
  // Renders on a transparent-safe background; the plate is already opaque.
  const data = await sharp(svg, {density: 384})
    .resize(size, size, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png({compressionLevel: 9})
    .toBuffer();
  pngs.set(size, data);
}

const named = {
  16: 'favicon-16.png',
  32: 'favicon-32.png',
  48: 'favicon-48.png',
  180: 'apple-touch-icon.png',
  192: 'icon-192.png',
  512: 'icon-512.png',
};

for (const [size, file] of Object.entries(named)) {
  writeFileSync(path.join(outDir, file), pngs.get(Number(size)));
}

const ico = buildIco([16, 32, 48].map((size) => ({size, data: pngs.get(size)})));
writeFileSync(path.join(outDir, 'favicon.ico'), ico);

console.log(`rasterised ${sizes.length} sizes, ico ${ico.length}B`);
