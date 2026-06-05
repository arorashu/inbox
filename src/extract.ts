import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ExtractedContent } from "./types";

/**
 * Fetch a URL and extract clean reader-view content.
 * Uses Mozilla's Readability (same engine as Firefox Reader View).
 */
export async function extract(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  // Set base URI so relative links resolve
  const base = document.createElement("base");
  base.href = url;
  document.head.prepend(base);

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article) {
    throw new Error(`Could not extract content from ${url}`);
  }

  // Convert HTML content to markdown-like plain text for storage
  const textContent = htmlToText(article.content);
  const title = article.title || extractTitle(html) || url;
  const excerpt = article.excerpt || textContent.slice(0, 280);
  const siteName = article.siteName || tryGetDomain(url);

  return {
    title,
    content: article.content,
    textContent,
    excerpt,
    siteName,
    byline: article.byline || null,
    length: textContent.length,
  };
}

/**
 * Simple HTML-to-text converter. Keeps structure for readability.
 * A proper markdown converter could be swapped in later.
 */
function htmlToText(html: string): string {
  // Use linkedom to parse and extract text
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);

  // Convert headings, paragraphs, lists to markdown-like text
  const body = document.body;
  const lines: string[] = [];

  function walk(node: Node, depth: number = 0) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        // Text node
        const text = child.textContent?.trim();
        if (text) lines.push(text);
      } else if (child.nodeType === 1) {
        // Element node
        const el = child as Element;
        const tag = el.tagName.toLowerCase();

        switch (tag) {
          case "h1":
            lines.push("");
            lines.push(`# ${el.textContent?.trim()}`);
            lines.push("");
            break;
          case "h2":
            lines.push("");
            lines.push(`## ${el.textContent?.trim()}`);
            lines.push("");
            break;
          case "h3":
            lines.push("");
            lines.push(`### ${el.textContent?.trim()}`);
            lines.push("");
            break;
          case "h4":
          case "h5":
          case "h6":
            lines.push("");
            lines.push(`#### ${el.textContent?.trim()}`);
            lines.push("");
            break;
          case "p":
            lines.push(el.textContent?.trim() || "");
            lines.push("");
            break;
          case "li":
            lines.push(`- ${el.textContent?.trim()}`);
            break;
          case "em":
          case "i":
            lines.push(`*${el.textContent?.trim()}*`);
            break;
          case "strong":
          case "b":
            lines.push(`**${el.textContent?.trim()}**`);
            break;
          case "a": {
            const href = (el as Element).getAttribute("href");
            lines.push(`[${el.textContent?.trim()}](${href || "#"})`);
            break;
          }
          case "img": {
            const src = (el as Element).getAttribute("src");
            const alt = (el as Element).getAttribute("alt") || "";
            if (src) lines.push(`![${alt}](${src})`);
            break;
          }
          case "pre":
          case "code":
            lines.push("");
            lines.push("```");
            lines.push(el.textContent || "");
            lines.push("```");
            lines.push("");
            break;
          case "blockquote":
            for (const line of (el.textContent || "").split("\n")) {
              lines.push(`> ${line.trim()}`);
            }
            lines.push("");
            break;
          case "hr":
            lines.push("");
            lines.push("---");
            lines.push("");
            break;
          case "br":
            lines.push("");
            break;
          default:
            walk(child, depth + 1);
        }
      }
    }
  }

  walk(body);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function tryGetDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
