import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const TEST_DIR = "/tmp/inbox-bun-test";
export const TEST_ITEMS_DIR = join(TEST_DIR, "items");
export const TEST_DB_PATH = join(TEST_DIR, "inbox.sqlite");

/** Create a clean test directory before tests */
export function setupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_ITEMS_DIR, { recursive: true });
}

/** Clean up test directory after tests */
export function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

/** Simple fixture HTML for extraction tests (doesn't require network) */
export function fixtureHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body>
  <article>
    <h1>${title}</h1>
    <p>${body}</p>
  </article>
</body>
</html>`;
}

/** A known-stable URL that should always be fetchable and extractable */
export const KNOWN_URL = "https://example.com";

/** Check if a URL is reachable (skip network tests if offline) */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const res = await fetch("https://example.com", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
