/**
 * Build output/trending-data.json (narration + slide data) for today's video.
 *
 * data/enriched-coffee-news.json is written by the morning routine:
 *   - `format: "recipe" | "news-top5"` → 「今日の一杯」recipe cards / Sunday news TOP5
 *   - no `format`, dated today          → legacy news explainer (3 sections)
 *   - missing / stale / invalid         → bean-of-the-day house recipe from data/coffee-lineup.json
 *
 * Options:
 *   --content=<path>       render another content file, date check skipped (dry runs / samples)
 *   --template-narration   drop the routine's narration and use the short templates
 *                          (the pipeline's 60-second guard uses this as a last resort)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  buildCardsData,
  fallbackRecipeContent,
  jstDateParts,
  narrationLength,
  validateDailyContent,
  withTemplateNarration,
} from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const enrichedPath = join(rootDir, "data", "enriched-coffee-news.json");
const lineupPath = join(rootDir, "data", "coffee-lineup.json");

const contentArg = process.argv.find((a) => a.startsWith("--content="))?.slice("--content=".length);
const templateNarration = process.argv.includes("--template-narration");
const forceFallback = process.argv.includes("--fallback");

function readJSON(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    console.error(`  Unreadable ${path}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy news explainer (content JSON without `format`)
// ---------------------------------------------------------------------------

function loadEnrichedData(enriched, todayStr) {
  if (!enriched || enriched.date !== todayStr) return null;
  const map = {};
  for (const a of enriched.articles || []) {
    map[a.rank] = a;
  }
  console.log(`  Loaded enriched data for ${Object.keys(map).length} articles`);
  return map;
}

function generateSections(article, enriched, dateJpSpoken) {
  // If Claude-enriched narration sections exist, use them
  const ns = enriched?.narration_sections;

  // Slide titles & subtitles are topic-specific. Prefer enriched-provided
  // values; fall back to topic-agnostic defaults (the previous coffee-origin
  // hard-coded strings broke every non-origin topic, e.g. brewing method,
  // science, seasonal, etc.).
  const st = enriched?.section_titles || {};
  const sd = enriched?.section_descriptions || {};

  const hookBase = ns?.hook
    || `今日のコーヒー豆知識。${article.title}。${article.description}`;

  return [
    {
      key: "hook",
      name: st.hook || `${article.title}`,
      description: sd.hook || enriched?.description || article.description,
      detail: "",
      narration: `${dateJpSpoken}、${hookBase}`,
    },
    {
      key: "origin",
      name: st.origin || "詳しく",
      description: sd.origin || enriched?.description || article.description,
      detail: enriched?.detail || article.detail,
      narration: ns?.origin
        || enriched?.detail || article.detail,
    },
    {
      key: "recommend",
      name: st.recommend || "おすすめ",
      description: sd.recommend || "今日試してみよう",
      detail: article.tags ? `キーワード: ${article.tags.join("、")}` : "",
      narration: ns?.recommend
        || (article.tags
          ? `この豆のキーワードは、${article.tags.join("、")}。ぜひ試してみてください。`
          : `ぜひ一度試してみてください。`),
    },
  ];
}

function buildLegacyNewsData(enrichedFile, todayStr) {
  const raw = JSON.parse(readFileSync(join(outputDir, "raw-coffee-news.json"), "utf-8"));
  const enrichedMap = loadEnrichedData(enrichedFile, todayStr);
  const article = raw[0]; // Single topic per day
  const enriched = enrichedMap?.[article.rank];

  const source = enriched
    ? { ...article, ...enriched, title: enriched.title || article.title }
    : article;

  console.log(`  Topic: ${source.title} [${source.source || source.category}]`);
  if (enriched?.narration_sections) {
    console.log(`  Using Claude-enriched narration sections!`);
  }

  const now = new Date();
  const dateDisplay = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const dateJpSpoken = `${now.getMonth() + 1}月${now.getDate()}日`;

  const sections = generateSections(source, enriched, dateJpSpoken);
  const projects = sections.map((s, i) => ({
    rank: i + 1,
    name: s.name,
    fullName: source.source || source.category || "",
    description: s.description,
    detail: s.detail,
    narration: s.narration,
    category: source.source || source.category || "",
    url: source.link || "",
    ...(i === 0 ? { date: dateDisplay } : {}),
  }));

  return {
    // Intentionally no openingNarration: the brand-intro title call was
    // hurting IG Reels / YT Shorts retention. Viewers bounce during the
    // "OPEN GROUND Coffee" sting, so the video now opens straight into
    // the hook narration (project-1). The downstream audio pipeline and
    // composition both treat a missing opening as a skipped segment.
    endingNarration: "以上、今日のコーヒー豆知識でした。フォローといいねで、毎日のコーヒー情報をチェックしましょう。",
    projects,
    topicTitle: source.title,
    discovery: enrichedFile?.discovery || null,
  };
}

// ---------------------------------------------------------------------------
// Card formats
// ---------------------------------------------------------------------------

function chooseCardContent(file, lineup, today) {
  if (!file) {
    console.log(`  No content file → house recipe fallback`);
    return fallbackRecipeContent(lineup, today);
  }
  const { errors, warnings } = validateDailyContent(file, lineup, contentArg ? {} : { today });
  for (const w of warnings) console.log(`  warning: ${w}`);
  if (errors.length === 0) return file;
  console.error(`  Content rejected (${errors.length} error(s)) → house recipe fallback`);
  for (const e of errors) console.error(`    - ${e}`);
  return fallbackRecipeContent(lineup, today);
}

function displayDate(iso) {
  return iso.replace(/-/g, ".");
}

async function main() {
  const today = jstDateParts().iso;
  const contentPath = contentArg ? resolve(contentArg) : enrichedPath;
  const file = readJSON(contentPath);
  const outputPath = join(outputDir, "trending-data.json");

  if (!contentArg && !forceFallback && file && !file.format && file.date === today) {
    console.log("Legacy news content for today (no `format`) → news explainer\n");
    const data = buildLegacyNewsData(file, today);
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nGenerated ${data.projects.length} sections → ${outputPath}`);
    return;
  }

  const lineup = JSON.parse(readFileSync(lineupPath, "utf-8"));
  let content = forceFallback
    ? fallbackRecipeContent(lineup, today)
    : chooseCardContent(file?.format || contentArg ? file : null, lineup, today);
  if (templateNarration) {
    console.log("  --template-narration: using template narration");
    content = withTemplateNarration(content);
  }

  const data = buildCardsData(content, lineup, { dateDisplay: displayDate(content.date) });
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(
    `Format: ${data.format}${data.fallback ? " (fallback: house recipe)" : ""} — "${data.topicTitle}"`
  );
  console.log(`  ${data.slides.length} slides + ending, narration ${narrationLength(data)} chars → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
