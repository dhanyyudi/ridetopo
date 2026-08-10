import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const DIST = resolve("dist");
let exitCode = 0;

function check(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

check(existsSync(DIST), "dist/ directory exists");
check(existsSync(resolve(DIST, "index.html")), "dist/index.html exists");

const walk = (dir) => {
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
};

const files = walk(DIST);
const relPaths = files.map(f => relative(DIST, f));

check(relPaths.some(p => p.includes("manifest")), "PWA manifest exists");
check(relPaths.some(p => p.includes("sw")), "Service worker exists");
check(relPaths.some(p => p.startsWith("brand/")), "Brand assets present");

const htmlContent = readFileSync(resolve(DIST, "index.html"), "utf-8");
check(!htmlContent.includes("/plan/"), "No private plan paths in index.html");
check(!htmlContent.includes(".superpowers"), "No private agent paths in index.html");

for (const file of files) {
  if (file.endsWith(".js") || file.endsWith(".css") || file.endsWith(".html")) {
    const content = readFileSync(file, "utf-8");
    if (content.includes("plan/") || content.includes(".superpowers/")) {
      console.error(`FAIL: Private path found in ${relative(DIST, file)}`);
      exitCode = 1;
    }
  }
}

const textFiles = files.filter(f => /\.(js|css|html|json|svg|xml|txt)$/.test(f));
for (const file of textFiles) {
  const content = readFileSync(file, "utf-8");
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /github_pat_/.test(content)) {
    console.error(`FAIL: Secret pattern in ${relative(DIST, file)}`);
    exitCode = 1;
  }
}

check(!relPaths.some(p => p.includes("_worker.js") || p.includes("functions/")),
  "No Worker or Pages Function artifacts");

if (exitCode === 0) {
  console.log("Build verification passed.");
} else {
  process.exit(1);
}
