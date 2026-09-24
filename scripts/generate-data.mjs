/**
 * Build output/trending-data.json (narration + slide data) for today's video.
 *
 * data/enriched-coffee-news.json is written by the morning routine:
 *   - `format: "brew-lesson"`, dated today, valid → that lesson
 *   - missing / stale / invalid                   → the evergreen lesson of the
 *     day from data/brew-lessons.json (plain date rotation: one cycle of the
 *     pack with no repeat, and the pack's order keeps consecutive days on
 *     different pillars)
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
const lessonsPath = join(rootDir, "data", "brew-lessons.json");
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

/** Topics posted in the last `days` days, newest first — the fallback's safety net. */
function recentTopics(today, days = 7) {
  const history = readJSON(historyPath);
  const videos = Array.isArray(history?.videos) ? history.videos : [];
  return videos
    .filter((v) => typeof v?.date === "string" && v.date < today && v.date >= addDays(today, -days))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((v) => v.content?.topic)
    .filter(Boolean);
}

/** `iso` shifted by `delta` days (JST dates are plain calendar dates here). */
function addDays(iso, delta) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
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
 * The evergreen lesson of the day, validated like any other content: a lesson
 * edited into the pack without running the tests must not reach a viewer. A
 * rejected lesson is dropped from the pack and the next one in the rotation is
 * tried; if none validates the job fails rather than posting something wrong.
 */
function evergreenLesson(today) {
  const recent = recentTopics(today);
  const pack = JSON.parse(readFileSync(lessonsPath, "utf-8"));
  let lessons = Array.isArray(pack.lessons) ? pack.lessons : [];
  const rejected = [];
  while (lessons.length > 0) {
    const content = fallbackLessonContent({ lessons }, today, recent);
    const { errors } = safely(() => validateDailyContent({ ...content, date: today }, {}));
    if (errors.length === 0) {
      if (recent.length > 0) console.log(`  (last ${recent.length} posted topic(s) skipped in the rotation)`);
      if (rejected.length > 0) {
        actionsWarning(`${rejected.length} lesson(s) in data/brew-lessons.json are invalid and were skipped`, rejected.slice(0, 5));
      }
      return content;
    }
    rejected.push(`${content.lesson.pillar} / ${content.lesson.hook}: ${errors[0]}`);
    lessons = lessons.filter((l) => l !== content.lesson);
  }
  throw new Error(`data/brew-lessons.json has no valid lesson: ${rejected.join(" | ")}`);
}

function fallbackTo(today, reason, details = []) {
  const content = evergreenLesson(today);
  actionsWarning(`${reason} → evergreen lesson (${content.lesson.pillar} × ${content.lesson.method})`, details);
  return content;
}

function chooseContent(file, today) {
  if (forceFallback) return evergreenLesson(today);
  if (!file) {
    console.log(`  No content for today → evergreen lesson fallback`);
    return fallbackTo(today, "No content for today");
  }
  const { errors, warnings } = safely(() => validateDailyContent(file, { ...(contentArg ? {} : { today }) }));
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
    `Format: ${data.format}${data.fallback ? " (fallback: evergreen lesson)" : ""} — ${PILLARS[data.lesson.pillar]}「${data.lesson.hook}」`
  );
  console.log(`  ${data.slides.length} slides + ending, narration ${narrationLength(data)} chars → ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
