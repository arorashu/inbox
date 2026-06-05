import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Store } from "../src/store";
import { setupTestDir, cleanupTestDir, TEST_DIR } from "./helpers";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

let store: Store;

beforeAll(() => {
  setupTestDir();
  store = new Store(TEST_DIR);
});

// Clean all items between tests to avoid collisions
beforeEach(() => {
  const items = store.list({ archived: true });
  for (const item of items) {
    store.delete(item.id);
  }
});

afterAll(() => {
  store.close();
  cleanupTestDir();
});

describe("Store", () => {
  describe("add", () => {
    it("adds an item and returns it with an id", () => {
      const item = store.add({
        url: "https://example.com/article",
        title: "Test Article",
        description: "A test description",
        siteName: "example.com",
        content: "This is the body content of the article.",
      });

      expect(item.id).toBeGreaterThan(0);
      expect(item.url).toBe("https://example.com/article");
      expect(item.title).toBe("Test Article");
      expect(item.description).toBe("A test description");
      expect(item.site_name).toBe("example.com");
      expect(item.body).toBe("This is the body content of the article.");
      expect(item.word_count).toBe(8);
      expect(item.read).toBe(0);
      expect(item.archived).toBe(0);
      expect(item.filename).toMatch(/\.md$/);
    });

    it("generates a filename from date and title", () => {
      const item = store.add({
        url: "https://example.com/rust-error-handling",
        title: "Error Handling in Rust",
        description: null,
        siteName: null,
        content: "Content here.",
      });

      expect(item.filename).toContain("error-handling-in-rust");
      expect(item.filename).toMatch(/^\d{4}-\d{2}-\d{2}-.*\.md$/);
    });

    it("writes a markdown file to disk", () => {
      const item = store.add({
        url: "https://example.com/md-test",
        title: "Markdown Test",
        description: null,
        siteName: null,
        content: "Some content.",
      });

      const path = join(TEST_DIR, "items", item.filename);
      expect(existsSync(path)).toBe(true);
      const md = readFileSync(path, "utf-8");
      expect(md).toContain("# Markdown Test");
      expect(md).toContain("https://example.com/md-test");
    });
  });

  describe("getById", () => {
    it("returns an item by id", () => {
      const item = store.add({
        url: "https://example.com/get-test",
        title: "Get Test",
        description: null,
        siteName: null,
        content: "Get body.",
      });

      const fetched = store.getById(item.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe("Get Test");
    });

    it("returns null for missing id", () => {
      expect(store.getById(99999)).toBeNull();
    });
  });

  describe("getWithContent", () => {
    it("returns item with full markdown content from disk", () => {
      const item = store.add({
        url: "https://example.com/content-test",
        title: "Content Test",
        description: null,
        siteName: null,
        content: "Full article text here.",
      });

      const full = store.getWithContent(item.id);
      expect(full).not.toBeNull();
      expect(full!.content).toContain("# Content Test");
      expect(full!.content).toContain("Full article text here.");
      expect(full!.content).toContain("https://example.com/content-test");
    });

    it("returns null for missing id", () => {
      expect(store.getWithContent(99999)).toBeNull();
    });
  });

  describe("list", () => {
    it("lists items newest first", () => {
      const a = store.add({ url: "https://a.com", title: "Article A", description: null, siteName: null, content: "A" });
      const b = store.add({ url: "https://b.com", title: "Article B", description: null, siteName: null, content: "B" });

      const items = store.list({});
      // Only our 2 items (beforeEach cleaned everything)
      const ours = items.filter((i) => i.id === a.id || i.id === b.id);
      expect(ours.length).toBe(2);
      expect(ours[0].title).toBe("Article B"); // newest first
      expect(ours[1].title).toBe("Article A");
    });

    it("filters by tags", () => {
      const a = store.add({ url: "https://rust.com", title: "Rust", description: null, siteName: null, content: "Rust" });
      const b = store.add({ url: "https://go.com", title: "Go", description: null, siteName: null, content: "Go" });
      store.setTags(a.id, ["rust", "systems"]);
      store.setTags(b.id, ["go", "backend"]);

      const rustItems = store.list({ tags: ["rust"] });
      expect(rustItems.length).toBe(1);
      expect(rustItems[0].title).toBe("Rust");
    });

    it("filters archived/unarchived", () => {
      const a = store.add({ url: "https://active.com", title: "Active", description: null, siteName: null, content: "A" });
      store.setArchived(a.id, true);

      const defaults = store.list({});
      expect(defaults.every((i) => i.id !== a.id)).toBe(true);

      const archived = store.list({ archived: true });
      expect(archived.some((i) => i.id === a.id)).toBe(true);
    });

    it("respects limit and offset", () => {
      const items = [];
      for (let i = 0; i < 10; i++) {
        items.push(store.add({ url: `https://x.com/${i}`, title: `Item ${i}`, description: null, siteName: null, content: `${i}` }));
      }

      const page1 = store.list({ limit: 3, offset: 0 });
      expect(page1.length).toBe(3);

      const page2 = store.list({ limit: 3, offset: 3 });
      expect(page2.length).toBe(3);
      expect(page2[0].id).not.toBe(page1[0].id);
    });
  });

  describe("search", () => {
    it("finds items by keyword in title", () => {
      store.add({ url: "https://rust.com/ownership", title: "Rust Ownership Rules", description: null, siteName: null, content: "Learn about ownership." });

      const results = store.search({ query: "ownership" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain("Ownership");
    });

    it("finds items by keyword in body", () => {
      store.add({ url: "https://go.com/goroutines", title: "Go Concurrency", description: null, siteName: null, content: "Goroutines are lightweight threads." });

      const results = store.search({ query: "lightweight" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain("Go Concurrency");
    });

    it("returns snippets with highlights", () => {
      store.add({ url: "https://zig.com", title: "Zig Build System", description: null, siteName: null, content: "Zig has a powerful build system that replaces make and cmake." });

      const results = store.search({ query: "build" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].snippet).toContain("**build**");
    });

    it("returns empty for no matches", () => {
      const results = store.search({ query: "xyznonexistent12345" });
      expect(results.length).toBe(0);
    });
  });

  describe("tag management", () => {
    it("sets tags on an item", () => {
      const item = store.add({ url: "https://x.com/tag-test", title: "Tag Test", description: null, siteName: null, content: "test" });
      store.setTags(item.id, ["rust", "systems", "low-level"]);

      const updated = store.getById(item.id);
      const tags = JSON.parse(updated!.tags as any);
      expect(tags).toEqual(["rust", "systems", "low-level"]);
    });
  });

  describe("read/unread", () => {
    it("marks item as read", () => {
      const item = store.add({ url: "https://x.com/read-test", title: "Read Test", description: null, siteName: null, content: "test" });
      store.setRead(item.id, true);
      expect(store.getById(item.id)!.read).toBe(1);

      store.setRead(item.id, false);
      expect(store.getById(item.id)!.read).toBe(0);
    });
  });

  describe("archive", () => {
    it("marks item as archived", () => {
      const item = store.add({ url: "https://x.com/archive-test", title: "Archive Test", description: null, siteName: null, content: "test" });
      store.setArchived(item.id, true);
      expect(store.getById(item.id)!.archived).toBe(1);

      store.setArchived(item.id, false);
      expect(store.getById(item.id)!.archived).toBe(0);
    });
  });

  describe("delete", () => {
    it("deletes an item and its file from disk", () => {
      const item = store.add({ url: "https://x.com/delete-test", title: "Delete Test", description: null, siteName: null, content: "test" });
      const filepath = join(TEST_DIR, "items", item.filename);

      expect(existsSync(filepath)).toBe(true);
      store.delete(item.id);
      expect(store.getById(item.id)).toBeNull();
      expect(existsSync(filepath)).toBe(false);
    });

    it("returns false for missing id", () => {
      expect(store.delete(99999)).toBe(false);
    });
  });

  describe("count", () => {
    it("returns the number of items", () => {
      const before = store.count();
      const item = store.add({ url: "https://x.com/count-test", title: "Count", description: null, siteName: null, content: "test" });
      expect(store.count()).toBe(before + 1);
      store.delete(item.id);
      expect(store.count()).toBe(before);
    });
  });
});
