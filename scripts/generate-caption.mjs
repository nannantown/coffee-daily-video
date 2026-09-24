/**
 * Build the YouTube title/description and the Instagram caption for today's
 * brewing lesson.
 *
 * Input:  output/trending-data.json
 * Output: output/captions.json
 *
 * All the wording lives in scripts/content-format.mjs (buildCardCaptions), so
 * the save/follow CTA and the hashtags have one home. Nothing here reads
 * data/coffee-lineup.json — the growth phase never names a coffee we sell.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildCardCaptions, jstDateParts } from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "output");

function main() {
  const data = JSON.parse(readFileSync(join(outputDir, "trending-data.json"), "utf-8"));
  const jst = jstDateParts();
  const { youtube, instagram } = buildCardCaptions(data, jst.slash);
  const captions = { date: { full: jst.slash, compact: jst.compact }, format: data.format, youtube, instagram };

  const outputPath = join(outputDir, "captions.json");
  writeFileSync(outputPath, JSON.stringify(captions, null, 2));
  console.log(`Captions → ${outputPath}`);
  console.log(`  YouTube title: ${captions.youtube.title}`);
  console.log(`  Instagram: ${captions.instagram.length} chars (ends with the save / follow CTA)`);
}

main();
