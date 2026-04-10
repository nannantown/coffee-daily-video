/**
 * Transform coffee news into narration-ready data.
 * Input:  output/raw-coffee-news.json
 * Output: output/trending-data.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const enrichedPath = join(rootDir, "data", "enriched-coffee-news.json");

function loadEnrichedData() {
  if (!existsSync(enrichedPath)) return null;
  try {
    const enriched = JSON.parse(readFileSync(enrichedPath, "utf-8"));
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (enriched.date !== todayStr) return null;
    const map = {};
    for (const a of enriched.articles || []) {
      map[a.rank] = a;
    }
    console.log(`  Loaded enriched data for ${Object.keys(map).length} articles`);
    return map;
  } catch {
    return null;
  }
}

function generateNarration(article) {
  // Single topic narration for coffee knowledge
  return `今日のコーヒー豆知識。${article.title}。${article.description}`;
}

async function main() {
  const rawPath = join(outputDir, "raw-coffee-news.json");
  const raw = JSON.parse(readFileSync(rawPath, "utf-8"));

  const enrichedMap = loadEnrichedData();
  if (enrichedMap) {
    console.log("Using Claude-enriched descriptions!\n");
  } else {
    console.log("Using raw article data.\n");
  }

  const projects = [];
  for (const article of raw) {
    const enriched = enrichedMap?.[article.rank];

    if (enriched) {
      console.log(`  #${article.rank}: using enriched data`);
      projects.push({
        rank: article.rank,
        name: enriched.title || article.title,
        fullName: article.source,
        description: enriched.description || article.title,
        detail: enriched.detail || article.description,
        narration: enriched.narration || generateNarration(article),
        language: article.source,
        stars: 0,
        todayStars: 0,
        url: article.link,
      });
    } else {
      console.log(`  #${article.rank}: ${article.title}`);
      projects.push({
        rank: article.rank,
        name: article.title,
        fullName: article.source,
        description: article.title,
        detail: article.description || article.title,
        narration: generateNarration(article),
        language: article.source,
        stars: 0,
        todayStars: 0,
        url: article.link,
      });
    }
  }

  const data = {
    openingNarration: "今日のコーヒー豆知識をお届けします。",
    endingNarration: "以上、今日のコーヒー豆知識でした。フォローといいねで、毎日のコーヒー情報をチェックしましょう。",
    projects,
  };

  const outputPath = join(outputDir, "trending-data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nGenerated ${projects.length} articles → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
