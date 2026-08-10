import { execSync } from "node:child_process";

const PRIVATE_DIRS = ["plan/", ".superpowers/", "docs/superpowers/plans/", ".codex/", ".agents/"];

const CREDENTIAL_NAMES = [
  ".env", ".dev.vars", ".npmrc", ".yarnrc.yml",
  "wrangler.toml.local", "auth.json",
];

const CREDENTIAL_EXTENSIONS = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".mobileprovision"];

const SECRET_PATTERNS = [
  /-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/-]{16,}/,
];

const SECRET_ASSIGNMENTS = '(API_KEY|API_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD|PRIVATE_KEY)[\\s]*[:=][\\s]*[\'"]?[A-Za-z0-9._~+/-]{16,}';

let exitCode = 0;

let output;
try {
  output = execSync("git ls-files -z", { encoding: "utf-8" });
} catch {
  console.error("Failed to run git ls-files");
  process.exit(1);
}

const files = output.split("\0").filter(Boolean);

for (const file of files) {
  for (const dir of PRIVATE_DIRS) {
    if (file.startsWith(dir)) {
      console.error(`BLOCKED: private path tracked: ${file}`);
      exitCode = 1;
    }
  }

  const basename = file.split("/").pop() || "";

  if (basename.startsWith(".env") && basename !== ".env.example") {
    console.error(`BLOCKED: credential file tracked: ${file}`);
    exitCode = 1;
  }

  if (CREDENTIAL_NAMES.includes(basename)) {
    console.error(`BLOCKED: credential file tracked: ${file}`);
    exitCode = 1;
  }

  for (const ext of CREDENTIAL_EXTENSIONS) {
    if (file.endsWith(ext)) {
      console.error(`BLOCKED: credential file tracked: ${file}`);
      exitCode = 1;
    }
  }

  if (file.startsWith("credentials/") || file.startsWith("secrets/")) {
    console.error(`BLOCKED: credential directory file tracked: ${file}`);
    exitCode = 1;
  }

  if (file.endsWith("service-account") || file.includes("service-account")) {
    console.error(`BLOCKED: service account file tracked: ${file}`);
    exitCode = 1;
  }
}

for (const file of files) {
  try {
    const content = execSync(`git show ":${file}"`, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

    if (file === ".env.example") {
      if (content.includes("sk-") || content.includes("Bearer ") || content.includes("PRIVATE KEY")) {
        console.error("BLOCKED: .env.example contains a secret-like value");
        exitCode = 1;
      }
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        console.error(`BLOCKED: high-confidence secret in tracked file: ${file}`);
        exitCode = 1;
      }
    }

    const assignmentRegex = new RegExp(SECRET_ASSIGNMENTS, "gi");
    const matches = content.matchAll(assignmentRegex);
    for (const match of matches) {
      const line = match[0];
      if (!/(example|placeholder|changeme|dummy|your[-_]|test[-_])/i.test(line)) {
        console.error(`BLOCKED: credential assignment in tracked file: ${file}`);
        exitCode = 1;
      }
    }
  } catch {
    // binary file, skip
  }
}

if (exitCode !== 0) {
  process.exit(1);
}
