/**
 * Scrape coffee news from Google News RSS.
 * Output: output/raw-coffee-news.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "output");

const RSS_URL =
  "https://news.google.com/rss/search?q=%E3%82%B3%E3%83%BC%E3%83%92%E3%83%BC+OR+%E3%82%AB%E3%83%95%E3%82%A7+OR+specialty+coffee&hl=ja&gl=JP&ceid=JP:ja";

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
    const content = match[1];
    const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "";
    const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
    const source = content.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || "";
    const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
    const description = content.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim() || "";

    // Clean HTML from description
    const cleanDesc = description
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Clean title
    const cleanTitle = title
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (cleanTitle) {
      items.push({
        rank: items.length + 1,
        title: cleanTitle,
        description: cleanDesc || cleanTitle,
        source,
        link,
        pubDate,
      });
    }
  }

  return items;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  console.log("Fetching coffee news from Google News RSS...");

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    Accept: "application/rss+xml, application/xml, text/xml",
  };

  let xml;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(RSS_URL, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
      break;
    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 5000));
      else throw err;
    }
  }

  const articles = parseRSSItems(xml);

  if (articles.length < 3) {
    console.error(`Only found ${articles.length} articles (expected 5)`);
    if (articles.length === 0) process.exit(1);
  }

  const outputPath = join(outputDir, "raw-coffee-news.json");
  writeFileSync(outputPath, JSON.stringify(articles, null, 2));

  console.log(`Saved ${articles.length} articles to ${outputPath}`);
  articles.forEach((a) =>
    console.log(`  #${a.rank} ${a.title} (${a.source})`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
