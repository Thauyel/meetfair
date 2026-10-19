// One-off: rasterise app/icon.svg into the PNGs the web manifest needs. Run after changing the icon.
import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("app/icon.svg", "utf8");
// Maskable: full-bleed square, artwork shrunk into the 80% safe zone.
const maskable = svg
  .replace('rx="112"', 'rx="0"')
  .replace(/(<rect[^>]*\/>)([\s\S]*)<\/svg>/, '$1<g transform="translate(51.2 51.2) scale(0.8)">$2</g></svg>');

await sharp(Buffer.from(svg)).resize(192).png().toFile("public/icon-192.png");
await sharp(Buffer.from(svg)).resize(512).png().toFile("public/icon-512.png");
await sharp(Buffer.from(maskable)).resize(512).png().toFile("public/icon-maskable-512.png");
await sharp(Buffer.from(maskable)).resize(180).png().toFile("app/apple-icon.png");
