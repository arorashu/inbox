import { Database } from "bun:sqlite";
import type { InboxItem, InboxItemWithSnippet, ListOptions, SearchOptions } from "./types";
import { existsSync, writeFileSync, readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export class Store {
  private db: Database;
  private itemsDir: string;
  private inboxDir: string;

  constructor(inboxDir: string = ".inbox") {
    this.inboxDir = inboxDir;
    this.itemsDir = join(inboxDir, "items");
    const dbPath = join(inboxDir, "inbox.sqlite");

    // Ensure directories exist
    if (!existsSync(inboxDir)) mkdirSync(inboxDir, { recursive: true });
    if (!existsSync(this.itemsDir)) mkdirSync(this.itemsDir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        site_name TEXT,
        body TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        filename TEXT NOT NULL UNIQUE,
        word_count INTEGER NOT NULL DEFAULT 0,
        read INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      )
    `);

    // FTS5 for full-text search
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title,
        body,
        description,
        tokenize='porter unicode61'
      )
    `);

    // Triggers to keep FTS in sync
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, body, description) VALUES (new.id, new.title, new.body, new.description);
      END
    `);
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
      END
    `);
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.id;
        INSERT INTO items_fts(rowid, title, body, description) VALUES (new.id, new.title, new.body, new.description);
      END
    `);

    this.db.run("CREATE INDEX IF NOT EXISTS idx_items_url ON items(url)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_items_tags ON items(tags)");
  }

  /**
   * Add an item to the store. Saves markdown file to disk and metadata to SQLite.
   */
  add(params: {
    url: string;
    title: string;
    description: string | null;
    siteName: string | null;
    content: string;
  }): InboxItem {
    const { url, title, description, siteName, content } = params;

    // Generate a safe filename from title and date
    const date = new Date().toISOString().slice(0, 10);
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    const filename = `${date}-${safeTitle}.md`;

    // Save markdown file
    const markdown = this.buildMarkdown(title, url, siteName, description, content);
    const filepath = join(this.itemsDir, filename);
    writeFileSync(filepath, markdown, "utf-8");

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const tags = "[]";

    try {
      const stmt = this.db.prepare(`
        INSERT INTO items (url, title, description, site_name, body, tags, filename, word_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(url, title, description, siteName, content, tags, filename, wordCount);
      return this.getById(Number(result.lastInsertRowid))!;
    } catch (err) {
      // Clean up orphaned file if DB insert fails
      try { unlinkSync(filepath); } catch {}
      throw err;
    }
  }

  /**
   * Get a single item by ID.
   */
  getById(id: number): InboxItem | null {
    const item = this.db
      .query<InboxItem, [number]>("SELECT * FROM items WHERE id = ?")
      .get(id) ?? null;
    return item ? this.normalize(item) : null;
  }

  /**
   * Get an item with its full markdown content from disk.
   */
  getWithContent(id: number): (InboxItem & { content: string }) | null {
    const item = this.getById(id);
    if (!item) return null;
    try {
      const content = readFileSync(join(this.itemsDir, item.filename), "utf-8");
      return { ...item, content };
    } catch {
      return null;
    }
  }

  /**
   * List items with optional filters.
   */
  list(options: ListOptions = {}): InboxItem[] {
    const { tags, archived, limit = 50, offset = 0, read } = options;

    let sql = "SELECT * FROM items WHERE 1=1";
    const params: any[] = [];

    if (archived !== undefined) {
      sql += " AND archived = ?";
      params.push(archived ? 1 : 0);
    } else {
      sql += " AND archived = 0";
    }

    if (read !== undefined) {
      sql += " AND read = ?";
      params.push(read ? 1 : 0);
    }

    if (tags && tags.length > 0) {
      // Use json_each to check if any of the requested tags exist in the tags array
      sql += " AND EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value IN (";
      sql += tags.map(() => "?").join(", ");
      sql += "))";
      tags.forEach((t) => params.push(t));
    }

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.db.query<InboxItem, any[]>(sql).all(...params).map(i => this.normalize(i));
  }

  /**
   * Full-text search with FTS5.
   */
  search(options: SearchOptions): InboxItemWithSnippet[] {
    const { query, tags, limit = 20, offset = 0 } = options;

    let sql = `
      SELECT i.*, snippet(items_fts, 1, '**', '**', '...', 40) as snippet, rank
      FROM items_fts f
      JOIN items i ON i.id = f.rowid
      WHERE items_fts MATCH ?
    `;
    const params: any[] = [this.escapeFts5(query)];

    if (tags && tags.length > 0) {
      sql += " AND EXISTS (SELECT 1 FROM json_each(i.tags) WHERE json_each.value IN (";
      sql += tags.map(() => "?").join(", ");
      sql += "))";
      tags.forEach((t) => params.push(t));
    }

    sql += " ORDER BY rank LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.db
      .query<InboxItemWithSnippet, any[]>(sql)
      .all(...params).map(i => ({ ...this.normalize(i as any), snippet: i.snippet, rank: i.rank }));
  }

  /**
   * Update an item's tags.
   */
  setTags(id: number, tags: string[]) {
    this.db.run(
      "UPDATE items SET tags = ?, updated_at = datetime('now') WHERE id = ?",
      [JSON.stringify(tags), id]
    );
    return this.getById(id);
  }

  /**
   * Mark an item as read/unread.
   */
  setRead(id: number, read: boolean) {
    this.db.run(
      "UPDATE items SET read = ?, updated_at = datetime('now') WHERE id = ?",
      [read ? 1 : 0, id]
    );
    return this.getById(id);
  }

  /**
   * Archive/unarchive an item.
   */
  setArchived(id: number, archived: boolean) {
    this.db.run(
      "UPDATE items SET archived = ?, updated_at = datetime('now') WHERE id = ?",
      [archived ? 1 : 0, id]
    );
    return this.getById(id);
  }

  /**
   * Delete an item and its markdown file.
   */
  delete(id: number): boolean {
    const item = this.getById(id);
    if (!item) return false;
    try {
      unlinkSync(join(this.itemsDir, item.filename));
    } catch {
      // File might already be gone
    }
    this.db.run("DELETE FROM items WHERE id = ?", [id]);
    return true;
  }

  /**
   * Get item count.
   */
  count(): number {
    const row = this.db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM items").get();
    return row?.count ?? 0;
  }

  close() {
    this.db.close();
  }

  /** Escape special characters for FTS5 query syntax */
  private escapeFts5(query: string): string {
    // FTS5 special characters: * " - ( ) + ^ ~
    // Wrap each word in double quotes to make it a literal match,
    // then append * for prefix matching
    return query
      .replace(/[\x00-\x1f\x7f"*()^~]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(w => `"${w}"*`)
      .join(" ");
  }

  private normalize(item: InboxItem): InboxItem {
    if (typeof item.tags === "string") {
      try {
        return { ...item, tags: JSON.parse(item.tags as any) };
      } catch {
        return { ...item, tags: [] };
      }
    }
    return item;
  }

  private buildMarkdown(
    title: string,
    url: string,
    siteName: string | null,
    description: string | null,
    content: string
  ): string {
    const lines = [
      `# ${title}`,
      "",
      `> Source: [${siteName || url}](${url})`,
    ];
    if (description) {
      lines.push(`> ${description}`);
    }
    lines.push("", "---", "", content);
    return lines.join("\n");
  }
}
