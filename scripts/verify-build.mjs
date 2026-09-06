import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const DIST = resolve("dist");
let exitCode = 0;
let checks = 0;

function check(condition, message) {
  checks++;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/* Build output basics */
check(existsSync(DIST), "dist/ directory exists");
check(existsSync(resolve(DIST, "index.html")), "dist/index.html exists");
check(existsSync(resolve(DIST, "manifest.webmanifest")), "PWA manifest exists");

const files = walk(DIST);
const relPaths = files.map((f) => relative(DIST, f));

/* Required public artifacts must be present in the build output */
const REQUIRED_ARTIFACTS = [
  "config.json",
  "_headers",
  "_redirects",
  "brand/pwa-192x192.png",
  "brand/pwa-512x512.png",
  "brand/pwa-maskable-512x512.png",
  "brand/apple-touch-icon.png",
  "brand/favicon-32x32.png",
  "brand/favicon-48x48.png",
  "brand/favicon.svg",
  "brand/logo-mark.svg",
  "brand/logo-mark-mono.svg",
  "brand/logo-horizontal.svg",
  "fonts/PlusJakartaSans-Variable.woff2",
  "fonts/OFL.txt",
];

for (const artifact of REQUIRED_ARTIFACTS) {
  check(relPaths.includes(artifact), `artifact present: ${artifact}`);
}

/* Exact PNG dimensions for the PWA icons */
const ICON_DIMENSIONS = {
  "brand/pwa-192x192.png": [192, 192],
  "brand/pwa-512x512.png": [512, 512],
  "brand/pwa-maskable-512x512.png": [512, 512],
  "brand/apple-touch-icon.png": [180, 180],
  "brand/favicon-32x32.png": [32, 32],
  "brand/favicon-48x48.png": [48, 48],
};

for (const [path, [w, h]] of Object.entries(ICON_DIMENSIONS)) {
  const full = resolve(DIST, path);
  if (existsSync(full)) {
    try {
      const info = await readPngDimensions(full);
      check(
        info && info.width === w && info.height === h,
        `icon dimensions ${path}: ${w}x${h}`,
      );
    } catch {
      check(false, `icon readable as PNG: ${path}`);
    }
  }
}

async function readPngDimensions(file) {
  const buf = readFileSync(file);
  const isPng = buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
  if (!isPng) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/* The font file must be a real WOFF2 (signature wOF2) */
const fontPath = resolve(DIST, "fonts/PlusJakartaSans-Variable.woff2");
if (existsSync(fontPath)) {
  const fontBuf = readFileSync(fontPath);
  check(
    fontBuf.length > 4 && fontBuf.toString("ascii", 0, 4) === "wOF2",
    "font file is a valid WOFF2",
  );
}

/* config.json must be the validated non-secret runtime config */
const configPath = resolve(DIST, "config.json");
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    check(config.version === 1, "config.json has version 1");
    check(typeof config.valhallaBaseUrl === "string" && config.valhallaBaseUrl.startsWith("https://"), "config valhallaBaseUrl is https");
    check(typeof config.geocodingEnabled === "boolean", "config geocodingEnabled is boolean");
  } catch {
    check(false, "config.json parses as JSON");
  }
}

/* CSP must be declared without wildcard origins or unsafe-eval */
const headersPath = resolve(DIST, "_headers");
if (existsSync(headersPath)) {
  const headers = readFileSync(headersPath, "utf-8");
  check(headers.includes("Content-Security-Policy"), "CSP header declared");
  check(!headers.includes("unsafe-eval"), "CSP has no unsafe-eval");
  check(!headers.includes("https://*"), "CSP has no wildcard origins");
  check(headers.includes("object-src 'none'"), "CSP blocks object embedding");
}

/* SPA fallback redirect */
const redirectsPath = resolve(DIST, "_redirects");
if (existsSync(redirectsPath)) {
  const redirects = readFileSync(redirectsPath, "utf-8");
  check(redirects.includes("/* /index.html 200"), "SPA fallback redirect present");
}

/* No Worker or Pages Function artifacts */
check(
  !relPaths.some((p) => p.includes("_worker.js") || p.includes("functions/")),
  "no Worker or Pages Function artifacts",
);

/* No production source maps */
check(
  !relPaths.some((p) => p.endsWith(".map")),
  "no production source maps",
);

/* Reject HTML masquerading as asset content and private path leaks */
const PRIVATE_MARKERS = ["/plan/", ".superpowers", ".codex", ".agents", "ridetopo-private"];
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/,
];

/* Reject HTML masquerading as asset content (all files) */
for (const file of files) {
  if (file.endsWith(".png")) {
    const buf = readFileSync(file);
    const isPng = buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
    if (!isPng) {
      check(false, `no HTML masquerading as PNG: ${relative(DIST, file)}`);
    }
  }
}

for (const file of files) {
  const rel = relative(DIST, file);
  const isText = /\.(js|css|html|json|svg|xml|txt|webmanifest)$/.test(file);
  if (!isText) continue;

  const content = readFileSync(file, "utf-8");

  if (PRIVATE_MARKERS.some((m) => content.includes(m))) {
    check(false, `no private path in ${rel}`);
  }
  if (SECRET_PATTERNS.some((p) => p.test(content))) {
    check(false, `no secret pattern in ${rel}`);
  }
}

/* Manifest references must resolve to real files */
const manifestPath = resolve(DIST, "manifest.webmanifest");
if (existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    check(manifest.name === "RideTopo", "manifest name is RideTopo");
    check(manifest.display === "standalone", "manifest display is standalone");
    const icons = manifest.icons ?? [];
    check(icons.length >= 3, "manifest has at least three icons");
    for (const icon of icons) {
      const src = icon.src.replace(/^\//, "");
      check(relPaths.includes(src), `manifest icon exists: ${src}`);
    }
  } catch {
    check(false, "manifest parses as JSON");
  }
}

/* The worker is how a release reaches someone who has opened the site before.
   Built with registerType "prompt" and no prompt in the app, it installs and
   then waits forever — which is how three releases went live without reaching
   returning visitors. These checks fail the build if that regresses. */
const swPath = resolve(DIST, "sw.js");
check(existsSync(swPath), "service worker exists");
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf-8");
  /* Both modes call self.skipWaiting(); only "prompt" gates it behind a
     SKIP_WAITING message that the app has to send. Its absence is the proof
     that the worker activates without being asked. */
  check(!sw.includes("SKIP_WAITING"), "service worker activates without being asked");
  check(sw.includes("clientsClaim"), "service worker claims open clients");
  check(sw.includes("cleanupOutdatedCaches"), "service worker drops stale precaches");
}

if (existsSync(headersPath)) {
  const headers = readFileSync(headersPath, "utf-8");
  for (const path of ["/sw.js", "/registerSW.js"]) {
    const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith(`${path}\n`));
    check(
      Boolean(block?.includes("Cache-Control: no-cache")),
      `${path} is served no-cache`,
    );
  }
}

console.log(`\nBuild verification: ${checks} checks.`);
if (exitCode === 0) {
  console.log("Build verification passed.");
} else {
  process.exit(1);
}
