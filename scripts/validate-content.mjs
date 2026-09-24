/**
 * Validate the day's content JSON before the morning routine commits it.
 *
 * Usage:
 *   node scripts/validate-content.mjs                                   # data/enriched-coffee-news.json, date must be today (JST)
 *   node scripts/validate-content.mjs data/samples/brew-lesson.sample.json --no-date-check
 *
 * Besides the shape and the brewing numbers this runs the brand guard: a bean
 * name, an origin or a sales line anywhere in the slides, the title or the
 * caption is an error (owner decision 2026-09-22, audience-growth phase).
 *
 * Exit 0 = renderable as-is. Exit 1 = fix the listed errors (the pipeline
 * would otherwise fall back to the evergreen lesson of the day).
 */

import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  PILLARS,
  validateDailyContent,
  buildCardsData,
  narrationLength,
  jstDateParts,
  LIMITS,
} from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const pathArg = args.find((a) => !a.startsWith("--"));
const contentPath = resolve(pathArg || join(rootDir, "data", "enriched-coffee-news.json"));
const skipDate = args.includes("--no-date-check");
const today = jstDateParts().iso;

let content;
try {
  content = JSON.parse(readFileSync(contentPath, "utf-8"));
} catch (err) {
  console.error(`NG: cannot read ${contentPath}: ${err.message}`);
  process.exit(1);
}

let result;
try {
  result = validateDailyContent(content, skipDate ? {} : { today });
} catch (err) {
  console.error(`NG: validation crashed on ${contentPath}: ${JSON.stringify(String(err?.message ?? err))}`);
  process.exit(1);
}
const { errors, warnings } = result;
for (const w of warnings) console.log(`warning: ${w}`);
if (errors.length > 0) {
  console.error(`NG: ${errors.length} error(s) in ${contentPath}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const data = buildCardsData(content, { dateDisplay: "" });
console.log(
  `OK: ${content.format} ${content.date} ${PILLARS[content.lesson.pillar]}「${content.lesson.hook}」 — ${data.slides.length} slides + ending, narration ${narrationLength(data)}/${LIMITS.narrationTotal} chars`
);
