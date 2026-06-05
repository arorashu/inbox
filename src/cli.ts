import { add, list, get, search, tag, read, unread, archive, unarchive, remove, stats } from "./core";

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function printItem(item: any, showContent = false) {
  const tags = Array.isArray(item.tags)
    ? item.tags
    : typeof item.tags === "string"
    ? JSON.parse(item.tags)
    : [];
  const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
  const readMarker = item.read ? " " : "●";

  console.log(`${readMarker} #${item.id}  ${item.title}${tagStr}`);
  console.log(`   ${item.site_name || "—"}  ·  ${item.created_at?.slice(0, 10)}  ·  ${item.word_count || 0} words`);
  if (item.snippet) {
    console.log(`   ...${item.snippet.replace(/\*\*/g, "").replace(/\n/g, " ")}...`);
  }
  if (showContent && item.content) {
    console.log(`\n${item.content}`);
  }
  console.log();
}

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case "add": {
      const url = args[0];
      if (!url) {
        console.error("Usage: inbox add <url> [--tags tag1,tag2]");
        process.exit(1);
      }
      const tagsArg = args.indexOf("--tags");
      const tags = tagsArg >= 0 ? args[tagsArg + 1]?.split(",").map((t) => t.trim()) : [];
      console.log(`Fetching and extracting ${url}...`);
      const item = await add(url, { tags });
      console.log("\nSaved:");
      printItem(item);
      break;
    }

    case "list": {
      const tagsArg = args.indexOf("--tags");
      const filterTags = tagsArg >= 0 ? args[tagsArg + 1]?.split(",").map((t) => t.trim()) : [];
      const showArchived = args.includes("--archived");
      const showRead = args.includes("--read");
      const isJson = args.includes("--json");

      const items = list({
        tags: filterTags.length ? filterTags : undefined,
        archived: showArchived ? true : undefined,
        read: showRead ? undefined : false,
      });

      if (isJson) {
        printJson(items);
      } else {
        if (items.length === 0) {
          console.log("Inbox is empty. Add something: inbox add <url>");
        } else {
          console.log(`${items.length} item(s):\n`);
          for (const item of items) {
            printItem(item);
          }
        }
      }
      break;
    }

    case "get": {
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        console.error("Usage: inbox get <id> [--json]");
        process.exit(1);
      }
      const isJson = args.includes("--json");
      const item = get(id);
      if (!item) {
        console.error(`Item #${id} not found.`);
        process.exit(1);
      }
      if (isJson) {
        printJson(item);
      } else {
        printItem(item, true);
      }
      // Auto-mark as read
      read(id);
      break;
    }

    case "search": {
      const query = args[0];
      if (!query) {
        console.error("Usage: inbox search <query> [--json] [--tags tag1,tag2]");
        process.exit(1);
      }
      const tagsArg = args.indexOf("--tags");
      const filterTags = tagsArg >= 0 ? args[tagsArg + 1]?.split(",").map((t) => t.trim()) : [];
      const isJson = args.includes("--json");

      const results = search({
        query,
        tags: filterTags.length ? filterTags : undefined,
        limit: 20,
      });

      if (isJson) {
        printJson(results);
      } else {
        if (results.length === 0) {
          console.log(`No results for "${query}".`);
        } else {
          console.log(`${results.length} result(s) for "${query}":\n`);
          for (const item of results) {
            printItem(item);
          }
        }
      }
      break;
    }

    case "tag": {
      const id = parseInt(args[0]);
      const tags = args.slice(1).filter((a) => !a.startsWith("--"));
      if (isNaN(id) || tags.length === 0) {
        console.error("Usage: inbox tag <id> <tag1> [tag2...]");
        process.exit(1);
      }
      const item = tag(id, tags);
      if (!item) {
        console.error(`Item #${id} not found.`);
        process.exit(1);
      }
      console.log(`Tagged #${id}: [${tags.join(", ")}]`);
      break;
    }

    case "read":
    case "unread": {
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        console.error(`Usage: inbox ${command} <id>`);
        process.exit(1);
      }
      const item = command === "read" ? read(id) : unread(id);
      if (!item) {
        console.error(`Item #${id} not found.`);
        process.exit(1);
      }
      console.log(`Marked #${id} as ${command}.`);
      break;
    }

    case "archive":
    case "unarchive": {
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        console.error(`Usage: inbox ${command} <id>`);
        process.exit(1);
      }
      const item = command === "archive" ? archive(id) : unarchive(id);
      if (!item) {
        console.error(`Item #${id} not found.`);
        process.exit(1);
      }
      console.log(`${command === "archive" ? "Archived" : "Unarchived"} #${id}.`);
      break;
    }

    case "rm":
    case "delete": {
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        console.error(`Usage: inbox ${command} <id>`);
        process.exit(1);
      }
      if (remove(id)) {
        console.log(`Deleted #${id}.`);
      } else {
        console.error(`Item #${id} not found.`);
        process.exit(1);
      }
      break;
    }

    case "stats": {
      const s = stats();
      console.log(`Total: ${s.total}  |  Unread: ${s.unread}  |  Archived: ${s.archived}`);
      break;
    }

    default:
      console.log(`
inbox — personal read-later inbox

Commands:
  inbox add <url> [--tags tag1,tag2]    Save a URL
  inbox list [--tags tag1,tag2] [--archived] [--json]
  inbox get <id> [--json]              Read an item (marks as read)
  inbox search <query> [--tags ...] [--json]
  inbox tag <id> <tag1> [tag2...]
  inbox read <id>                      Mark as read
  inbox unread <id>                    Mark as unread
  inbox archive <id>                   Archive an item
  inbox unarchive <id>                 Unarchive an item
  inbox rm <id>                        Delete an item
  inbox stats                          Show counts

All commands support --json for structured output.
Data stored in ~/.inbox/
`);
      break;
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
