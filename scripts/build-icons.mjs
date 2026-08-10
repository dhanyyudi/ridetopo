import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SIZES = [
  { name: "apple-touch-icon", size: 180 },
  { name: "favicon-32x32", size: 32 },
  { name: "favicon-48x48", size: 48 },
  { name: "pwa-192x192", size: 192 },
  { name: "pwa-512x512", size: 512 },
  { name: "pwa-maskable-512x512", size: 512 },
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="100" fill="#0F766E"/>
  <path d="M128 320C170 240 200 200 256 200C312 200 352 260 384 240" stroke="white" stroke-width="28" stroke-linecap="round" fill="none"/>
  <circle cx="128" cy="320" r="32" fill="white"/>
  <circle cx="384" cy="240" r="32" fill="white"/>
</svg>`;

const outDir = new URL("../public/brand/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

for (const { name, size } of SIZES) {
  const isMaskable = name.includes("maskable");
  const padding = isMaskable ? 0.1 : 0;
  const padded = Math.round(size * (1 - padding * 2));

  await sharp(Buffer.from(svg))
    .resize(padded, padded)
    .extend({
      top: Math.round(size * padding),
      bottom: Math.round(size * padding),
      left: Math.round(size * padding),
      right: Math.round(size * padding),
      background: isMaskable ? { r: 15, g: 118, b: 110, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(`${outDir}${name}.png`);

  console.log(`Generated ${name}.png (${size}x${size})`);
}
