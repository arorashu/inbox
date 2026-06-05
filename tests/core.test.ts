import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { add, list, get, search, tag, read, unread, archive, unarchive, remove, stats } from "../src/core";
import { setupTestDir, cleanupTestDir } from "./helpers";

let counter = 0;
function uniqueUrl(): string {
  return `https://httpbin.org/html?id=${++counter}`;
}

const origDir = process.env.INBOX_DIR;
beforeAll(() => {
  setupTestDir();
  process.env.INBOX_DIR = "/tmp/inbox-bun-test";
});

afterAll(() => {
  process.env.INBOX_DIR = origDir;
  cleanupTestDir();
});

describe("Core: add", () => {
  it("fetches and saves a real URL", async () => {
    const item = await add(uniqueUrl(), { tags: ["test"] });

    expect(item.id).toBeGreaterThan(0);
    expect(item.title.length).toBeGreaterThan(0);
    expect(item.body.length).toBeGreaterThan(0);
    expect(item.tags).toEqual(["test"]);
    expect(item.word_count).toBeGreaterThan(0);
    expect(item.read).toBe(0);

    remove(item.id);
  });

  it("adds tags during creation", async () => {
    const item = await add(uniqueUrl(), { tags: ["tag1", "tag2"] });
    expect(item.tags).toEqual(["tag1", "tag2"]);
    remove(item.id);
  });
});

describe("Core: list", () => {
  it("returns items", () => {
    const items = list();
    expect(Array.isArray(items)).toBe(true);
  });

  it("filters by archived", async () => {
    const item = await add(uniqueUrl(), { tags: ["archive-test"] });
    archive(item.id);

    const active = list();
    expect(active.some((i) => i.id === item.id)).toBe(false);

    const archivedItems = list({ archived: true });
    expect(archivedItems.some((i) => i.id === item.id)).toBe(true);

    remove(item.id);
  });
});

describe("Core: get", () => {
  it("returns item with content", async () => {
    const item = await add(uniqueUrl());
    const full = get(item.id);

    expect(full).not.toBeNull();
    expect(full!.content).toContain("#");
    expect(full!.content).toContain("httpbin.org");

    remove(item.id);
  });

  it("returns null for missing id", () => {
    expect(get(99999)).toBeNull();
  });
});

describe("Core: search", () => {
  it("finds items by keyword", async () => {
    const item = await add(uniqueUrl(), { tags: ["searchable"] });

    const results = search({ query: "html" });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === item.id)).toBe(true);

    remove(item.id);
  });

  it("returns empty for no matches", () => {
    const results = search({ query: "xyznonexistent99999" });
    expect(results.length).toBe(0);
  });
});

describe("Core: tag", () => {
  it("sets tags on an item", async () => {
    const item = await add(uniqueUrl());
    const updated = tag(item.id, ["rust", "design"]);
    expect(updated).not.toBeNull();
    expect(updated!.tags).toEqual(["rust", "design"]);
    remove(item.id);
  });

  it("returns null for missing id", () => {
    expect(tag(99999, ["nope"])).toBeNull();
  });
});

describe("Core: read/unread", () => {
  it("toggles read state", async () => {
    const item = await add(uniqueUrl());

    const marked = read(item.id);
    expect(marked!.read).toBe(1);

    const unmarked = unread(item.id);
    expect(unmarked!.read).toBe(0);

    remove(item.id);
  });
});

describe("Core: archive/unarchive", () => {
  it("toggles archive state", async () => {
    const item = await add(uniqueUrl());

    const archived = archive(item.id);
    expect(archived!.archived).toBe(1);

    const unarchived = unarchive(item.id);
    expect(unarchived!.archived).toBe(0);

    remove(item.id);
  });
});

describe("Core: remove", () => {
  it("deletes an item", async () => {
    const item = await add(uniqueUrl());
    expect(remove(item.id)).toBe(true);
    expect(get(item.id)).toBeNull();
  });

  it("returns false for missing id", () => {
    expect(remove(99999)).toBe(false);
  });
});

describe("Core: stats", () => {
  it("returns counts", () => {
    const s = stats();
    expect(s).toHaveProperty("total");
    expect(s).toHaveProperty("unread");
    expect(s).toHaveProperty("archived");
    expect(typeof s.total).toBe("number");
  });
});
