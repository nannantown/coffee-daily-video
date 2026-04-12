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

function generateSections(article, enriched) {
  // If Claude-enriched narration sections exist, use them
  const ns = enriched?.narration_sections;

  const sections = [
    {
      key: "hook",
      name: `${article.title}`,
      description: enriched?.description || article.description,
      detail: "",
      narration: ns?.hook
        || `今日のコーヒー豆知識。${article.title}。${article.description}`,
    },
    {
      key: "origin",
      name: "産地と特徴",
      description: `${article.title}の産地と栽培環境`,
      detail: enriched?.detail || article.detail,
      narration: ns?.origin
        || enriched?.detail || article.detail,
    },
    {
      key: "recommend",
      name: "おすすめポイント",
      description: `${article.title}の楽しみ方`,
      detail: article.tags ? `キーワード: ${article.tags.join("、")}` : "",
      narration: ns?.recommend
        || (article.tags
          ? `この豆のキーワードは、${article.tags.join("、")}。ぜひ試してみてください。`
          : `ぜひ一度試してみてください。`),
    },
  ];
  return sections;
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

  const article = raw[0]; // Single topic per day
  const enriched = enrichedMap?.[article.rank];

  const source = enriched
    ? { ...article, ...enriched, title: enriched.title || article.title }
    : article;

  console.log(`  Topic: ${source.title} [${source.source || source.category}]`);
  if (enriched?.narration_sections) {
    console.log(`  Using Claude-enriched narration sections!`);
  }

  const sections = generateSections(source, enriched);
  const projects = sections.map((s, i) => ({
    rank: i + 1,
    name: s.name,
    fullName: source.source || source.category || "",
    description: s.description,
    detail: s.detail,
    narration: s.narration,
    category: source.source || source.category || "",
    url: source.link || "",
  }));

  const data = {
    openingNarration: `OPEN GROUND Coffee。今日のコーヒー豆知識をお届けします。`,
    endingNarration: "以上、今日のコーヒー豆知識でした。フォローといいねで、毎日のコーヒー情報をチェックしましょう。",
    projects,
    topicTitle: source.title,
  };

  const outputPath = join(outputDir, "trending-data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nGenerated ${projects.length} articles → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
