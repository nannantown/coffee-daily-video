/**
 * Build output/trending-data.json (narration + slide data) for today's video.
 *
 * data/enriched-coffee-news.json is written by the morning routine:
 *   - `format: "recipe" | "news-top5"` → 「今日の一杯」recipe cards / Sunday news TOP5
 *   - no card keys, dated today, legacy keys present → legacy news explainer (3 sections)
 *   - missing / stale / invalid         → bean-of-the-day house recipe from data/coffee-lineup.json
 *   - no confirmed bean to fall back to → legacy evergreen explainer (no bean is promoted)
 * Every fallback is also reported as a GitHub Actions warning + job summary.
 *
 * Options:
 *   --content=<path>       render another content file, date check skipped (dry runs / samples)
 *   --template-narration   drop the routine's narration and use the short templates
 *                          (the pipeline's 60-second guard uses this as a last resort)
 *   --allow-candidate      beans still "candidate" in the lineup may be used (dry runs only)
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  NoPostableBeanError,
  buildCardsData,
  fallbackRecipeContent,
  jstDateParts,
  narrationLength,
  validateDailyContent,
  validateLegacyContent,
  withTemplateNarration,
} from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const enrichedPath = join(rootDir, "data", "enriched-coffee-news.json");
const lineupPath = join(rootDir, "data", "coffee-lineup.json");
const historyPath = join(rootDir, "data", "performance-history.json");

const contentArg = process.argv.find((a) => a.startsWith("--content="))?.slice("--content=".length);
const templateNarration = process.argv.includes("--template-narration");
const forceFallback = process.argv.includes("--fallback");
const allowCandidate = process.argv.includes("--allow-candidate");

// GitHub Actions workflow command escaping (data vs. property values).
const escData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s) => escData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

/** A fallback day is shown as a warning annotation and in the job summary, not only in the log. */
function actionsWarning(title, details = []) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::warning title=${escProp(title)}::${escData([title, ...details].join(" / "))}`);
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const oneLine = (s) => String(s).replace(/[\r\n]+/g, " ");
    appendFileSync(summary, [`### 警告: ${oneLine(title)}`, "", ...details.map((d) => `- ${oneLine(d)}`), "", ""].join("\n"));
  }
}

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

/** The last posted recipe before today ({ beanId, method }), so the fallback does not repeat it. */
function previousRecipe(today) {
  const history = readJSON(historyPath);
  const videos = Array.isArray(history?.videos) ? history.videos : [];
  const last = videos
    .filter((v) => typeof v?.date === "string" && v.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return last?.content?.beanId ? { beanId: last.content.beanId, method: last.content.method } : null;
}

/** Validation must never stop the post: a crash on odd input counts as "rejected". */
function safely(validate) {
  try {
    return validate();
  } catch (err) {
    return { errors: [`validation crashed: ${JSON.stringify(String(err?.message ?? err))}`], warnings: [] };
  }
}

/** The house recipe of a postable bean, or null when no bean may be posted (none confirmed yet). */
function houseRecipe(lineup, today) {
  const previous = previousRecipe(today);
  try {
    const content = fallbackRecipeContent(lineup, today, previous, { allowCandidate });
    if (previous) console.log(`  (previous post: ${previous.beanId} × ${previous.method} → not repeated)`);
    return content;
  } catch (err) {
    if (!(err instanceof NoPostableBeanError)) throw err;
    console.error(`  ${err.message}`);
    return null;
  }
}

function fallbackTo(lineup, today, reason, details = []) {
  const content = houseRecipe(lineup, today);
  if (content) actionsWarning(`${reason} → house recipe (${content.recipe.beanId} × ${content.recipe.method})`, details);
  return content;
}

function chooseCardContent(file, lineup, today) {
  if (!file) {
    console.log(`  No content for today → house recipe fallback`);
    return fallbackTo(lineup, today, "No content for today");
  }
  const { errors, warnings } = safely(() => validateDailyContent(file, lineup, { ...(contentArg ? {} : { today }), allowCandidate }));
  for (const w of warnings) console.log(`  warning: ${w}`);
  if (errors.length === 0) return file;
  console.error(`  Content rejected (${errors.length} error(s)) → house recipe fallback`);
  for (const e of errors) console.error(`    - ${e}`);
  return fallbackTo(lineup, today, `Content rejected (${errors.length} error(s))`, errors.slice(0, 5));
}

function displayDate(iso) {
  return iso.replace(/-/g, ".");
}

async function main() {
  const today = jstDateParts().iso;
  const contentPath = contentArg ? resolve(contentArg) : enrichedPath;
  const file = readJSON(contentPath);
  const outputPath = join(outputDir, "trending-data.json");
  const writeLegacy = (enriched) => {
    const data = buildLegacyNewsData(enriched, today);
    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nGenerated ${data.projects.length} sections → ${outputPath}`);
  };

  // A card JSON that only forgot `format` must not take the legacy path — it
  // goes through validation (and falls back to the house recipe) instead. A
  // JSON without card keys is the legacy explainer only with the legacy keys.
  const looksLikeCards = Boolean(file && (file.format || file.recipe || file.newsTop5));
  let legacyErrors = null;
  if (!contentArg && !forceFallback && file && !looksLikeCards && file.date === today) {
    const { errors } = safely(() => validateLegacyContent(file));
    if (errors.length === 0) {
      console.log("Legacy news content for today (no `format`) → news explainer\n");
      writeLegacy(file);
      return;
    }
    console.error(`  Legacy content rejected (${errors.length} error(s)) → house recipe fallback`);
    for (const e of errors) console.error(`    - ${e}`);
    legacyErrors = errors;
  }

  const lineup = JSON.parse(readFileSync(lineupPath, "utf-8"));
  let content;
  if (forceFallback) content = houseRecipe(lineup, today);
  else if (legacyErrors) content = fallbackTo(lineup, today, `Content without format rejected (${legacyErrors.length} error(s))`, legacyErrors.slice(0, 5));
  else content = chooseCardContent(looksLikeCards || contentArg ? file : null, lineup, today);

  if (!content) {
    // Keep posting without advertising an unconfirmed bean.
    actionsWarning("No confirmed bean in data/coffee-lineup.json → legacy evergreen explainer (no bean promoted)", [
      'Set the beans the owner confirmed to status "confirmed" by PR to start the recipe cards',
    ]);
    console.log("No postable bean → legacy evergreen explainer\n");
    writeLegacy(null);
    return;
  }
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
