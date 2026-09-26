/**
 * Last gate before anything is published: scan what was actually built —
 * output/trending-data.json (every slide text and narration) and
 * output/captions.json (YouTube title, description, tags, IG caption) — for
 * anything we sell.
 *
 * validateDailyContent already runs this on the routine's draft, but the draft
 * is not the only way content reaches a render: a fallback lesson, a hand-run
 * --content file or an edited data file all skip that check. This script runs
 * on the built artefacts, so nothing gets past it.
 *
 * Exit 0 = safe to post. Exit 1 = do not post (the pipeline stops).
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scanBannedTerms } from "./brand-guard.mjs";
import { collectPublishedTexts, recipeNumberHits } from "./content-format.mjs";

const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "output");
const readIfPresent = (name) => {
  const path = join(outputDir, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
};

// Both are optional so the retry / re-upload workflows can run this over an
// archived captions.json alone — that archive may predate 2026-09-22 and be
// full of bean and sales copy, which is exactly what must not be re-posted.
// When only the captions are present the SLIDES ARE NOT CHECKED (there is no
// trending-data.json to read); that path re-posts an already-rendered video,
// so the caption is the only text being decided here.
const data = readIfPresent("trending-data.json");
const captions = readIfPresent("captions.json");
if (!data && !captions) {
  console.error("NG: neither output/trending-data.json nor output/captions.json exists — nothing to check");
  process.exit(1);
}
if (!data) console.log("note: no output/trending-data.json — scanning the captions only");
if (!captions) console.log("note: no output/captions.json — scanning the slides only");

const texts = data
  ? collectPublishedTexts(data, captions)
  : collectPublishedTexts({ slides: [], ending: {}, topicTitle: "" }, captions);
const hits = scanBannedTerms(texts);
if (hits.length > 0) {
  console.error(`NG: ${hits.length} banned term(s) would be published`);
  for (const h of hits) console.error(`  - ${h.label}: ${JSON.stringify(h.term)} — ${h.why}`);
  console.error("The channel is in its audience-growth phase: no bean, no origin, no shop, no sales line (owner decision 2026-09-22).");
  process.exit(1);
}
// No recipe numbers either (owner decision 2026-09-26) — this also stops a re-post
// workflow from publishing an older, number-filled caption or video.
const numbers = recipeNumberHits(texts);
if (numbers.length > 0) {
  console.error(`NG: ${numbers.length} recipe number(s) would be published`);
  for (const [label, why] of numbers) console.error(`  - ${label}: ${why}`);
  process.exit(1);
}
console.log(`OK: nothing we sell and no recipe numbers in ${texts.length} published texts`);
