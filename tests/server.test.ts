import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDir, cleanupTestDir } from "./helpers";

const SERVER_PORT = 19999;
const BASE_URL = `http://localhost:${SERVER_PORT}`;
let serverProcess: any = null;

beforeAll(async () => {
  // Use test directory, not real inbox
  setupTestDir();
  process.env.INBOX_DIR = "/tmp/inbox-bun-test";

  // Start server on test port
  const { spawn } = require("node:child_process");
  serverProcess = spawn("bun", ["run", "src/server.ts"], {
    cwd: "/home/agent/misc/inbox",
    env: {
      ...process.env,
      INBOX_PORT: String(SERVER_PORT),
      INBOX_DIR: "/tmp/inbox-bun-test",
    },
    stdio: "pipe",
  });

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}, 10000);

afterAll(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
  cleanupTestDir();
  delete process.env.INBOX_DIR;
});

describe("Server API", () => {
  describe("GET /api/health", () => {
    it("returns ok", async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("GET /api/links", () => {
    it("returns a JSON array", async () => {
      const res = await fetch(`${BASE_URL}/api/links`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("POST /api/links", () => {
    it("adds a URL and returns the item", async () => {
      const res = await fetch(`${BASE_URL}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.item.id).toBeGreaterThan(0);
      expect(body.item.title).toBe("Example Domain");
      expect(body.item.word_count).toBeGreaterThan(0);
    });

    it("returns 400 for missing url", async () => {
      const res = await fetch(`${BASE_URL}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await fetch(`${BASE_URL}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });

    it("item appears in GET /api/links after add", async () => {
      // Add an item
      await fetch(`${BASE_URL}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      });

      // Check it appears in the list
      const res = await fetch(`${BASE_URL}/api/links`);
      const items = await res.json();
      expect(items.length).toBeGreaterThan(0);
      // The newest item should be example.com
      const last = items[0];
      expect(last.url).toBe("https://example.com");
    });
  });

  describe("GET / (Web UI)", () => {
    it("returns HTML", async () => {
      const res = await fetch(`${BASE_URL}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Inbox");
    });
  });
});
