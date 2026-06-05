---
name: inbox
description: Save, search, and read articles from a personal read-later inbox. Use when the user wants to save a link for later, search their saved articles, read saved content, or manage their inbox. Commands run via `bun inbox` from the /home/agent/misc/inbox directory.
---

# Inbox

Personal read-later system. Articles are fetched, extracted to clean markdown via Mozilla Readability, and stored with full-text search via SQLite FTS5.

Project directory: `/home/agent/misc/inbox`
Data directory: `~/.inbox/`

## Setup

No setup needed. All commands run from the project directory.

## Save a URL

```bash
bun inbox add "<url>" --tags tag1,tag2
```

Fetches the page, extracts clean reader-view content, saves as markdown to `~/.inbox/items/`, and stores metadata in SQLite. Tags are optional but recommended for organization.

Example:
```bash
bun inbox add "https://blog.rust-lang.org/ownership" --tags rust,memory
```

## Browse the inbox

```bash
bun inbox list                      # Unread items, newest first
bun inbox list --tags rust          # Filter by tag
bun inbox list --archived           # Include archived items
bun inbox list --json               # Structured output for processing
```

Unread items show `●`, read items show ` `.

## Search

```bash
bun inbox search "<query>"                         # Full-text search with snippets
bun inbox search "<query>" --json                  # Structured output
bun inbox search "<query>" --tags rust,design      # Filter by tags
```

Searches titles and full content. Returns snippets with matched terms highlighted.

## Read an item

```bash
bun inbox get <id>              # Full content (auto-marks as read)
bun inbox get <id> --json       # Structured output with full content
```

## Manage items

```bash
bun inbox tag <id> <tag1> [tag2...]    # Add tags to an item
bun inbox read <id>                    # Mark as read
bun inbox unread <id>                  # Mark as unread
bun inbox archive <id>                 # Hide from default list
bun inbox unarchive <id>               # Restore from archive
bun inbox rm <id>                      # Delete item and its markdown file
bun inbox stats                        # Total, unread, archived counts
```

## Agent behavior

- When the user shares a URL or asks to save something for later, use `bun inbox add`
- When the user asks "what did I save about X" or "find articles about Y", use `bun inbox search`
- When the user asks to read a specific item, use `bun inbox get <id>`
- When presenting search results, include the item ID so the user can say "show me #3"
- Run all commands from `/home/agent/misc/inbox`
- Use `--json` when you need to parse results programmatically
