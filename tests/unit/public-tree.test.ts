import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = resolve("scripts/check-public-tree.mjs");
const TMP = resolve("tests/fixtures/tmp-check");

function runCheck(): { exitCode: number } {
  try {
    execSync(`node ${SCRIPT}`, { encoding: "utf-8", cwd: TMP, stdio: "pipe" });
    return { exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { status?: number };
    return { exitCode: err.status ?? 1 };
  }
}

function runInDir(command: string): string {
  return execSync(command, { encoding: "utf-8", cwd: TMP, stdio: "pipe" });
}

function initRepo() {
  if (existsSync(TMP)) {
    rmSync(TMP, { recursive: true, force: true });
  }
  mkdirSync(TMP, { recursive: true });
  runInDir("git init");
  runInDir('git config user.email "test@test.com"');
  runInDir('git config user.name "test"');
}

function addAndCommit(filename: string, content: string) {
  const dir = filename.includes("/") ? filename.substring(0, filename.lastIndexOf("/")) : null;
  if (dir) {
    mkdirSync(resolve(TMP, dir), { recursive: true });
  }
  writeFileSync(resolve(TMP, filename), content);
  runInDir(`git add "${filename}"`);
  runInDir(`git commit -m "add ${filename}"`);
}

function makePrivateKey(): string {
  const parts = ["-----BE", "GIN ", "RSA PRI", "VATE KEY-----"];
  return parts.join("") + "\nxxx\n" + parts.join("").replace("BE", "END");
}

function makeGithubToken(): string {
  return "github" + "_pat_" + "1234567890abcdefghijklmn";
}

describe("check-public-tree", () => {
  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("blocks plan/x.md", () => {
    initRepo();
    mkdirSync(resolve(TMP, "plan"), { recursive: true });
    addAndCommit("plan/x.md", "some plan");
    expect(runCheck().exitCode).toBe(1);
  });

  it("blocks the maintainer agent instructions", () => {
    initRepo();
    addAndCommit("AGENTS.md", "internal instructions");
    expect(runCheck().exitCode).toBe(1);
  });

  it("blocks the internal audit evidence", () => {
    initRepo();
    mkdirSync(resolve(TMP, "audit"), { recursive: true });
    addAndCommit("audit/implementation-evidence.md", "internal QA record");
    expect(runCheck().exitCode).toBe(1);
  });

  it("blocks .env file", () => {
    initRepo();
    addAndCommit(".env", "SECRET=abc");
    expect(runCheck().exitCode).toBe(1);
  });

  it("allows .env.example with non-secret values", () => {
    initRepo();
    addAndCommit(".env.example", "VITE_EXAMPLE=YOUR_VALUE");
    expect(runCheck().exitCode).toBe(0);
  });

  it("blocks private key header in tracked file", () => {
    initRepo();
    addAndCommit("some-file.txt", makePrivateKey());
    expect(runCheck().exitCode).toBe(1);
  });

  it("blocks GitHub token pattern", () => {
    initRepo();
    addAndCommit("config.txt", makeGithubToken());
    expect(runCheck().exitCode).toBe(1);
  });

  it("allows clean file", () => {
    initRepo();
    addAndCommit("readme.md", "# Hello");
    expect(runCheck().exitCode).toBe(0);
  });
});
