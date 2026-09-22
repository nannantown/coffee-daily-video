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
import { collectPublishedTexts } from "./content-format.mjs";

const outputDir = join(dirname(fileURLToPath(import.meta.url)), "..", "output");
const read = (name) => JSON.parse(readFileSync(join(outputDir, name), "utf-8"));

const data = read("trending-data.json");
const captionsPath = join(outputDir, "captions.json");
const captions = existsSync(captionsPath) ? read("captions.json") : null;
if (!captions) console.log("warning: output/captions.json not built yet — scanning the slides only");

const hits = scanBannedTerms(collectPublishedTexts(data, captions));
if (hits.length > 0) {
  console.error(`NG: ${hits.length} banned term(s) would be published`);
  for (const h of hits) console.error(`  - ${h.label}: ${JSON.stringify(h.term)} — ${h.why}`);
  console.error("The channel is in its audience-growth phase: no bean, no origin, no shop, no sales line (owner decision 2026-09-22).");
  process.exit(1);
}
console.log(`OK: nothing we sell in ${collectPublishedTexts(data, captions).length} published texts`);
