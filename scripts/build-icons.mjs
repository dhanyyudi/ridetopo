import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandDir = resolve(__dirname, "../public/brand");
const svgMaster = Buffer.from(readFileSync(resolve(brandDir, "logo-mark.svg"), "utf-8"));

const OUTPUTS = [
  { name: "favicon-32x32.png", size: 32, maskable: false },
  { name: "favicon-48x48.png", size: 48, maskable: false },
  { name: "apple-touch-icon.png", size: 180, maskable: false },
  { name: "pwa-192x192.png", size: 192, maskable: false },
  { name: "pwa-512x512.png", size: 512, maskable: false },
  { name: "pwa-maskable-512x512.png", size: 512, maskable: true },
];

mkdirSync(brandDir, { recursive: true });

for (const { name, size, maskable } of OUTPUTS) {
  /* Maskable icons: shrink the art to the 80% safe zone on the teal background */
  const artSize = maskable ? Math.round(size * 0.8) : size;
  const pad = Math.round((size - artSize) / 2);

  await sharp(svgMaster)
    .resize(artSize, artSize)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 15, g: 118, b: 110, alpha: 1 },
    })
    .png()
    .toFile(resolve(brandDir, name));

  console.log(`Generated ${name} (${size}x${size}${maskable ? ", maskable" : ""})`);
}
