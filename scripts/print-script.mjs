#!/usr/bin/env node
/**
 * Print today's video as a plain script — scene by scene, what is on screen
 * and what is read aloud — for the first-viewer review (docs/first-viewer-review.md).
 * The reviewer reads only this, so it must show exactly what a viewer gets.
 *
 * Usage:
 *   node scripts/print-script.mjs                      # data/enriched-coffee-news.json
 *   node scripts/print-script.mjs path/to/content.json
 *   node scripts/print-script.mjs --episode=i12-soft-water   # an episode's evergreen draft
 */

import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { buildCardsData, episodeById, fallbackLessonContent, jstDateParts } from "./content-format.mjs";

// fields that are not text a viewer reads
const HIDDEN = new Set(["kind", "narration", "episode", "pillar", "date", "type", "shape", "pick", "motion", "strength", "from", "to"]);

/** Every on-screen string of a slide, in field order. */
export function screenText(slide) {
  const out = [];
  const walk = (v, key) => {
    if (HIDDEN.has(key)) return;
    if (key === "topic" && slide.kind === "lesson-cta") return; // carried for the caption, not drawn on the ending
    if (typeof v === "string") {
      if (v) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, ""));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(slide, "");
  return out;
}

export function scriptOf(content) {
  const data = buildCardsData(content, {});
  const scenes = [...data.slides, data.ending];
  return scenes
    .map((s, i) => [`【場面 ${i + 1}】`, `画面: ${screenText(s).join(" / ")}`, `読み上げ: ${s.narration}`].join("\n"))
    .join("\n\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const ep = args.find((a) => a.startsWith("--episode="))?.slice("--episode=".length);
  let content;
  if (ep) {
    const episode = episodeById(ep);
    if (!episode) throw new Error(`no episode ${ep}`);
    content = fallbackLessonContent(episode, jstDateParts().iso);
  } else {
    const path = resolve(args.find((a) => !a.startsWith("--")) || join(rootDir, "data", "enriched-coffee-news.json"));
    content = JSON.parse(readFileSync(path, "utf-8"));
  }
  console.log(scriptOf(content));
}
