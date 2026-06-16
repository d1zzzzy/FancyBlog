import { Marked, type Tokens } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import python from "highlight.js/lib/languages/python";
import markdown from "highlight.js/lib/languages/markdown";
import type { Post } from "../types";
import { SITE } from "./site.config";

/* Register a curated set of languages (their aliases — js, ts, sh, py,
   html … — come along automatically) instead of the full ~900 KB bundle.
   Add more here if your posts need them. */
for (const [name, def] of Object.entries({
  javascript, typescript, json, bash, css, xml, python, markdown,
})) {
  hljs.registerLanguage(name, def);
}

/* A configured Markdown renderer: syntax-highlighted code fences (via
   highlight.js) and images wrapped in <figure> with optional captions. */
const md = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);
md.use({
  renderer: {
    image({ href, title, text }: Tokens.Image): string {
      const caption = title || text;
      const alt = text ? ` alt="${text}"` : "";
      return `<figure class="r-image"><img src="${href}"${alt} loading="lazy" />${
        caption ? `<figcaption>${caption}</figcaption>` : ""
      }</figure>`;
    },
  },
});

/* ============================================================
   Content loader — turns Markdown files under content/ into Post objects.

   Each Markdown file looks like:

     ---
     title: On Keeping a Slow Notebook
     category: essay
     date: Feb 2026
     read: 5 min
     excerpt: A one-line teaser shown on the placard.
     image: /images/slow-notebook.jpg   # optional, lives in public/
     ---

     The body, in **Markdown**.

   Files are imported at build time via import.meta.glob, so adding a
   .md file under content/ is all it takes to add a monument.
   ============================================================ */

interface FrontMatter {
  title?: string;
  category?: string;
  date?: string;
  read?: string;
  excerpt?: string;
  image?: string;
}

/** Minimal frontmatter parser (scalar `key: value` pairs only). */
function parseFrontMatter(raw: string): { data: FrontMatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  return { data: data as FrontMatter, body: match[2] };
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function yearOf(date: string): number {
  const m = /(\d{4})/.exec(date);
  return m ? Number(m[1]) : 0;
}

/** A sortable key so newest pieces stand at the front of a district. */
function sortKey(date: string): number {
  const year = yearOf(date) || 0;
  const lower = date.toLowerCase();
  const month = MONTHS.findIndex((mo) => lower.includes(mo));
  return year * 12 + (month < 0 ? 0 : month);
}

function slugFromPath(path: string): string {
  const file = path.split("/").pop() || path;
  return file.replace(/\.md$/i, "");
}

/** Eagerly import every Markdown file as a raw string. */
const FILES = import.meta.glob("../../content/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

interface Loaded extends Post {}

/**
 * Parse all Markdown, group by the category order in SITE, sort each
 * district newest-first, and assign `local` (index within district) and
 * `n` (global display number). Returns the flat post list in district order.
 */
export function loadPosts(): Post[] {
  const known = new Set(SITE.categories.map((c) => c.id));
  const parsed: Loaded[] = [];

  for (const [path, raw] of Object.entries(FILES)) {
    const { data, body } = parseFrontMatter(raw);
    const cat = data.category || "";
    if (!known.has(cat)) {
      console.warn(`[content] "${path}" has unknown category "${cat}", skipping.`);
      continue;
    }
    const date = data.date || "";
    parsed.push({
      id: slugFromPath(path),
      n: "",
      cat,
      title: data.title || slugFromPath(path),
      date,
      year: yearOf(date),
      read: data.read || "",
      excerpt: data.excerpt || "",
      image: data.image || undefined,
      bodyHtml: md.parse(body.trim(), { async: false }) as string,
      local: 0,
    });
  }

  // group by configured category order; sort each district newest-first
  const ordered: Post[] = [];
  let counter = 0;
  for (const cat of SITE.categories) {
    const inCat = parsed
      .filter((p) => p.cat === cat.id)
      .sort((a, b) => sortKey(b.date) - sortKey(a.date));
    inCat.forEach((post, local) => {
      counter++;
      post.local = local;
      post.n = String(counter).padStart(2, "0");
      ordered.push(post);
    });
  }
  return ordered;
}
