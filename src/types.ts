export interface InboxItem {
  id: number;
  url: string;
  title: string;
  description: string | null;
  site_name: string | null;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  filename: string;
  word_count: number;
  read: boolean;
  archived: boolean;
}

export interface InboxItemWithSnippet extends InboxItem {
  snippet: string;
  rank: number;
}

export interface AddOptions {
  tags?: string[];
}

export interface ListOptions {
  tags?: string[];
  archived?: boolean;
  limit?: number;
  offset?: number;
  read?: boolean;
}

export interface SearchOptions {
  query: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ExtractedContent {
  title: string;
  content: string; // markdown
  textContent: string; // plain text
  excerpt: string;
  siteName: string | null;
  byline: string | null;
  length: number;
}
