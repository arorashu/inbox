# inbox

Personal read-later inbox — save, search, read. Agent-first.

```
inbox add <url>           →  extract clean content, save as markdown
inbox search <query>      →  full-text search with snippets
inbox get <id>            →  read full content (marks as read)
inbox list                →  browse what's in your inbox
```

## Quick Start

```bash
# Save a URL
bun inbox add "https://blog.rust-lang.org/" --tags rust,programming

# See what you've saved
bun inbox list

# Search
bun inbox search "error handling"

# Read an item
bun inbox get 1
```

## Commands

### add — Save a URL

```bash
bun inbox add <url> [--tags tag1,tag2]
```

Fetches the page, extracts reader-view content (Mozilla Readability), saves as a `.md` file and stores metadata in SQLite with FTS5 full-text index.

### list — Browse your inbox

```bash
bun inbox list [--tags tag1,tag2] [--archived] [--read] [--json]
```

Lists items newest first. Unread items shown with `●`, read items with ` `.

### search — Full-text search

```bash
bun inbox search <query> [--tags tag1,tag2] [--json]
```

Searches titles and content via FTS5. Returns snippets with matched terms highlighted.

### get — Read an item

```bash
bun inbox get <id> [--json]
```

Displays full content and auto-marks as read.

### tag — Add tags

```bash
bun inbox tag <id> <tag1> [tag2...]
```

### read / unread

```bash
bun inbox read <id>
bun inbox unread <id>
```

### archive / unarchive

```bash
bun inbox archive <id>
bun inbox unarchive <id>
```

Archived items are hidden from `list` by default. Use `--archived` to include them.

### rm — Delete an item

```bash
bun inbox rm <id>
```

Removes the database entry and the markdown file from disk.

### stats

```bash
bun inbox stats
```

Shows total, unread, and archived counts.

## Output Formats

All commands accept `--json` for structured, machine-readable output — designed for agent consumption and scripting.

```bash
bun inbox list --json
bun inbox search "rust" --json
bun inbox get 1 --json
```

## Data

| Location | Contents |
|----------|----------|
| `~/.inbox/items/` | One `.md` file per saved item |
| `~/.inbox/inbox.sqlite` | Metadata, tags, FTS5 index |

The markdown files are the canonical content. SQLite stores metadata for fast listing, tagging, and search. This design means any file-based tool (qmd, grep, etc.) can work directly with your inbox content.

## Architecture

```
URL → fetch → Readability extract → .md file on disk + SQLite row
                                      │
                         ┌────────────┴────────────┐
                         │    SQLite + FTS5        │
                         │  search / list / tag    │
                         └─────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │    Agent (pi / CLI)     │
                         └─────────────────────────┘
```
