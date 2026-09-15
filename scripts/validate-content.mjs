/**
 * Validate the day's content JSON before the morning routine commits it.
 *
 * Usage:
 *   node scripts/validate-content.mjs                                  # data/enriched-coffee-news.json, date must be today (JST)
 *   node scripts/validate-content.mjs data/samples/recipe.sample.json --no-date-check --allow-candidate
 *
 * Production rules by default: only beans with status "confirmed" in
 * data/coffee-lineup.json pass. --allow-candidate is for dry runs and samples.
 *
 * Exit 0 = renderable as-is. Exit 1 = fix the listed errors (the pipeline
 * would otherwise fall back to the bean-of-the-day house recipe).
 */

import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  validateDailyContent,
  buildCardsData,
  narrationLength,
  jstDateParts,
  expectedFormatFor,
  LIMITS,
} from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const pathArg = args.find((a) => !a.startsWith("--"));
const contentPath = resolve(pathArg || join(rootDir, "data", "enriched-coffee-news.json"));
const skipDate = args.includes("--no-date-check");
const allowCandidate = args.includes("--allow-candidate");
const today = jstDateParts().iso;

let content;
try {
  content = JSON.parse(readFileSync(contentPath, "utf-8"));
} catch (err) {
  console.error(`NG: cannot read ${contentPath}: ${err.message}`);
  process.exit(1);
}
const lineup = JSON.parse(readFileSync(join(rootDir, "data", "coffee-lineup.json"), "utf-8"));

const { errors, warnings } = validateDailyContent(content, lineup, { ...(skipDate ? {} : { today }), allowCandidate });
for (const w of warnings) console.log(`warning: ${w}`);
if (!skipDate && content?.format && content.format !== expectedFormatFor(today)) {
  console.log(`warning: today (${today}) expects "${expectedFormatFor(today)}"`);
}
if (errors.length > 0) {
  console.error(`NG: ${errors.length} error(s) in ${contentPath}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const data = buildCardsData(content, lineup, { dateDisplay: "" });
console.log(
  `OK: ${content.format} ${content.date} "${data.topicTitle}" — ${data.slides.length} slides + ending, narration ${narrationLength(data)}/${LIMITS.narrationTotal} chars`
);
