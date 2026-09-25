/**
 * Build output/trending-data.json (narration + slide data) for today's video.
 *
 * data/enriched-coffee-news.json is written by the morning routine:
 *   - `format: "brew-lesson"`, dated today, valid → that lesson
 *   - missing / stale / invalid / not today's episode → the evergreen lesson
 *     of today's episode from data/curriculum.json (the episode after the last
 *     one aired — scripts/next-episode.mjs prints the same one)
 * Every fallback is also reported as a GitHub Actions warning + job summary.
 *
 * There is no bean in this pipeline: the growth phase teaches brewing and
 * never names a coffee of our own (owner decision 2026-09-22).
 *
 * Options:
 *   --content=<path>       render another content file, date check skipped (dry runs / samples)
 *   --template-narration   drop the routine's narration and use the short templates
 *                          (the pipeline's 60-second guard uses this as a last resort)
 *   --fallback             force the evergreen lesson of the day
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  PILLARS,
  buildCardsData,
  episodeQueue,
  fallbackLessonContent,
  jstDateParts,
  narrationLength,
  validateDailyContent,
  withTemplateNarration,
} from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const enrichedPath = join(rootDir, "data", "enriched-coffee-news.json");
const historyPath = join(rootDir, "data", "performance-history.json");

const contentArg = process.argv.find((a) => a.startsWith("--content="))?.slice("--content=".length);
const templateNarration = process.argv.includes("--template-narration");
const forceFallback = process.argv.includes("--fallback");

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

/** Today's episode order (next not-aired episode first). A broken history file must not stop the post. */
function queue(today) {
  return episodeQueue(readJSON(historyPath), today);
}

/** Validation must never stop the post: a crash on odd input counts as "rejected". */
function safely(validate) {
  try {
    return validate();
  } catch (err) {
    return { errors: [`validation crashed: ${JSON.stringify(String(err?.message ?? err))}`], warnings: [] };
  }
}

/**
 * The evergreen lesson of today's episode, validated like any other content: an
 * episode edited into the curriculum without running the tests must not reach a
 * viewer. A rejected episode is skipped for the next one in the queue; if none
 * validates the job fails rather than posting something wrong.
 */
function evergreenLesson(today) {
  const rejected = [];
  for (const episode of queue(today)) {
    const content = fallbackLessonContent(episode, today);
    const { errors } = safely(() => validateDailyContent(content, {}));
    if (errors.length === 0) {
      if (rejected.length > 0) {
        actionsWarning(`${rejected.length} episode(s) in data/curriculum.json are invalid and were skipped`, rejected.slice(0, 5));
      }
      return content;
    }
    rejected.push(`${episode.id}: ${errors[0]}`);
  }
  throw new Error(`data/curriculum.json has no valid episode: ${rejected.join(" | ")}`);
}

function fallbackTo(today, reason, details = []) {
  const content = evergreenLesson(today);
  actionsWarning(`${reason} → evergreen lesson of episode ${content.lesson.episode} (${content.lesson.pillar} × ${content.lesson.method})`, details);
  return content;
}

function chooseContent(file, today) {
  if (forceFallback) return evergreenLesson(today);
  if (!file) {
    console.log(`  No content for today → evergreen lesson fallback`);
    return fallbackTo(today, "No content for today");
  }
  // Production also requires today's episode, so the series never skips or repeats one.
  const { errors, warnings } = safely(() =>
    validateDailyContent(file, contentArg ? {} : { today, expectedEpisode: queue(today)[0]?.id })
  );
  for (const w of warnings) console.log(`  warning: ${w}`);
  if (errors.length === 0) return file;
  console.error(`  Content rejected (${errors.length} error(s)) → evergreen lesson fallback`);
  for (const e of errors) console.error(`    - ${e}`);
  return fallbackTo(today, `Content rejected (${errors.length} error(s))`, errors.slice(0, 5));
}

function displayDate(iso) {
  return iso.replace(/-/g, ".");
}

async function main() {
  const today = jstDateParts().iso;
  const file = readJSON(contentArg ? resolve(contentArg) : enrichedPath);
  let content = chooseContent(file, today);

  if (templateNarration) {
    console.log("  --template-narration: using template narration");
    content = withTemplateNarration(content);
  }

  const data = buildCardsData(content, { dateDisplay: displayDate(content.date) });
  const outputPath = join(outputDir, "trending-data.json");
  writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(
    `Format: ${data.format}${data.fallback ? " (fallback: evergreen lesson)" : ""} — ${PILLARS[data.lesson.pillar]}「${data.lesson.hook}」 episode ${data.lesson.episode}`
  );
  console.log(`  ${data.slides.length} slides + ending, narration ${narrationLength(data)} chars → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
