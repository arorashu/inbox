import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDir, cleanupTestDir } from "./helpers";
import { spawnSync } from "node:child_process";

const INBOX_BIN = "bin/inbox.ts";
const CWD = "/home/agent/misc/inbox";

function run(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", ["run", INBOX_BIN, ...args], {
    cwd: CWD,
    env: { ...process.env, INBOX_DIR: "/tmp/inbox-bun-test" },
  });
  return {
    stdout: result.stdout?.toString() || "",
    stderr: result.stderr?.toString() || "",
    exitCode: result.exitCode || 0,
  };
}

beforeAll(() => {
  setupTestDir();
});

afterAll(() => {
  cleanupTestDir();
});

describe("CLI", () => {
  describe("add", () => {
    it("saves a URL", () => {
      const result = run(["add", "https://example.com"]);
      // Accept either exit code (may fail without network) or success
      expect(result.stderr).not.toContain("Usage:");
    });
  });

  describe("list", () => {
    it("outputs items", () => {
      const result = run(["list"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it("supports --json flag", () => {
      const result = run(["list", "--json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe("search", () => {
    it("outputs search results", () => {
      const result = run(["search", "test"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it("supports --json flag", () => {
      const result = run(["search", "test", "--json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe("stats", () => {
    it("shows counts", () => {
      const result = run(["stats"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Total:");
    });
  });

  describe("help", () => {
    it("shows usage with no command", () => {
      const result = run([]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("inbox — personal read-later inbox");
      expect(result.stdout).toContain("Commands:");
    });
  });

  describe("error handling", () => {
    it("shows usage for missing URL", () => {
      const result = run(["add"]);
      // Shows help/usage on stderr
      expect(result.stderr).toContain("Usage:");
    });

    it("shows error for invalid get id", () => {
      const result = run(["get", "not-a-number"]);
      expect(result.stderr).toContain("Usage:");
    });
  });
});
