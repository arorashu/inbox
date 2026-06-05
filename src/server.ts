import { Hono } from "hono";
import type { Context, Next } from "hono";
import { add, list } from "./core";

const PORT = parseInt(process.env.INBOX_PORT || "3333");
const TOKEN = process.env.INBOX_TOKEN;
const app = new Hono();

// --- Auth middleware ---
function auth(c: Context, next: Next) {
  // Localhost doesn't need auth
  const ip = c.req.header("x-forwarded-for") || "";
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return next();
  }
  // Phone requests need token
  if (!TOKEN) return next(); // No token set = open
  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}

// --- API ---

// Add a link
app.post("/api/links", auth, async (c) => {
  let body: { url?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const url = body.url;
  if (!url) {
    return c.json({ error: "Missing url" }, 400);
  }
  try {
    const item = await add(url);
    return c.json({ ok: true, item });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// List items
app.get("/api/links", (c) => {
  const items = list();
  return c.json(items);
});

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// --- Web UI ---
app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Inbox</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; padding: 24px 16px; background: #1a1a2e; color: #e0e0e0; }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 24px; }
  .item { padding: 16px; margin-bottom: 8px; background: #16213e; border-radius: 8px; }
  .item.unread { border-left: 3px solid #4fc3f7; }
  .item.read { border-left: 3px solid transparent; opacity: 0.7; }
  .item-title { font-weight: 600; margin-bottom: 4px; }
  .item-title a { color: #e0e0e0; text-decoration: none; }
  .item-title a:hover { text-decoration: underline; }
  .item-meta { font-size: 0.8rem; color: #888; }
  .item-snippet { font-size: 0.85rem; color: #aaa; margin-top: 6px; }
  .empty { text-align: center; padding: 48px 0; color: #666; }
  .empty p { margin-top: 8px; font-size: 0.9rem; }
  .tag { display: inline-block; background: #0f3460; color: #4fc3f7; padding: 1px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; }
</style>
</head>
<body>
  <h1>📥 Inbox</h1>
  <p class="subtitle">Share links from your phone → they appear here</p>
  <div id="items"></div>
  <script>
    async function load() {
      const res = await fetch('/api/links');
      const items = await res.json();
      const el = document.getElementById('items');
      if (!items.length) {
        el.innerHTML = '<div class="empty"><p style="font-size:2rem">📭</p><p>No items yet. Share a link from your phone!</p></div>';
        return;
      }
      el.innerHTML = items.map(i => {
        const tags = Array.isArray(i.tags) ? i.tags : (typeof i.tags === 'string' ? JSON.parse(i.tags) : []);
        return '<div class="item ' + (i.read ? 'read' : 'unread') + '">' +
          '<div class="item-title"><a href="' + i.url + '" target="_blank">' + (i.read ? '' : '● ') + escapeHtml(i.title) + '</a>' +
          (tags.length ? tags.map(t => '<span class="tag">' + t + '</span>').join('') : '') +
          '</div>' +
          '<div class="item-meta">' + (i.site_name || '') + ' · ' + (i.created_at || '').slice(0, 10) + ' · ' + (i.word_count || 0) + ' words</div>' +
          (i.description ? '<div class="item-snippet">' + escapeHtml(i.description) + '</div>' : '') +
        '</div>';
      }).join('');
    }
    function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    load();
    setInterval(load, 5000); // Auto-refresh every 5s
  </script>
</body>
</html>`);
});

// --- Start ---
console.log(`📥 Inbox server starting on http://localhost:${PORT}`);
console.log(`   API: POST /api/links  (add a link)`);
console.log(`   API: GET  /api/links  (list items)`);
console.log(`   Web: http://localhost:${PORT}/`);
if (TOKEN) console.log(`   Auth: token set (Bearer)`);
else console.log(`   Auth: open (no token set)`);

export default {
  port: PORT,
  fetch: app.fetch,
};
