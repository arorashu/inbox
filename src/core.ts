import { Store } from "./store";
import { extract } from "./extract";
import type { InboxItem, InboxItemWithSnippet } from "./types";

const INBOX_DIR =
  process.env.INBOX_DIR || `${process.env.HOME || "~"}/.inbox`;

function getStore(): Store {
  return new Store(INBOX_DIR);
}

export async function add(
  url: string,
  options?: { tags?: string[] }
): Promise<InboxItem> {
  const store = getStore();
  try {
    const extracted = await extract(url);
    const item = store.add({
      url,
      title: extracted.title,
      description: extracted.excerpt,
      siteName: extracted.siteName,
      content: extracted.textContent,
    });

    if (options?.tags && options.tags.length > 0) {
      store.setTags(item.id, options.tags);
    }

    const result = store.getById(item.id)!;
    return { ...result, tags: options?.tags || [] };
  } finally {
    store.close();
  }
}

export function list(options?: {
  tags?: string[];
  archived?: boolean;
  limit?: number;
  read?: boolean;
}): InboxItem[] {
  const store = getStore();
  try {
    return store.list(options);
  } finally {
    store.close();
  }
}

export function get(
  id: number
): (InboxItem & { content: string }) | null {
  const store = getStore();
  try {
    return store.getWithContent(id);
  } finally {
    store.close();
  }
}

export function search(options: {
  query: string;
  tags?: string[];
  limit?: number;
}): InboxItemWithSnippet[] {
  const store = getStore();
  try {
    return store.search(options);
  } finally {
    store.close();
  }
}

export function tag(id: number, tags: string[]): InboxItem | null {
  const store = getStore();
  try {
    const item = store.setTags(id, tags);
    return item ? { ...item, tags } : null;
  } finally {
    store.close();
  }
}

export function read(id: number): InboxItem | null {
  const store = getStore();
  try {
    return store.setRead(id, true);
  } finally {
    store.close();
  }
}

export function unread(id: number): InboxItem | null {
  const store = getStore();
  try {
    return store.setRead(id, false);
  } finally {
    store.close();
  }
}

export function archive(id: number): InboxItem | null {
  const store = getStore();
  try {
    return store.setArchived(id, true);
  } finally {
    store.close();
  }
}

export function unarchive(id: number): InboxItem | null {
  const store = getStore();
  try {
    return store.setArchived(id, false);
  } finally {
    store.close();
  }
}

export function remove(id: number): boolean {
  const store = getStore();
  try {
    return store.delete(id);
  } finally {
    store.close();
  }
}

export function stats(): {
  total: number;
  unread: number;
  archived: number;
} {
  const store = getStore();
  try {
    const total = store.count();
    const allItems = store.list({ archived: true, limit: 100000 });
    const unread = allItems.filter(i => i.read === 0 && i.archived === 0).length;
    const archived = allItems.filter(i => i.archived === 1).length;
    return { total, unread, archived };
  } finally {
    store.close();
  }
}
