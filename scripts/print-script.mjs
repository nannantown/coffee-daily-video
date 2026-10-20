#!/usr/bin/env node
/**
 * Print today's video as a plain script — scene by scene, what is on screen
 * and what is read aloud — for the readers of the script pipeline (docs/script-pipeline.md).
 * A reader gets only this, so it must show exactly what a viewer gets. With --art each scene
 * also names what it draws (for reader E; the review log keeps this version).
 *
 * Usage:
 *   node scripts/print-script.mjs                      # data/enriched-coffee-news.json
 *   node scripts/print-script.mjs path/to/content.json
 *   node scripts/print-script.mjs --episode=i12-soft-water   # an episode's evergreen draft
 *   node scripts/print-script.mjs --art                # + what each scene draws
 */

import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { airDate, buildCardsData, episodeById, fallbackLessonContent } from "./content-format.mjs";

// fields that are not text a viewer reads
const HIDDEN = new Set(["kind", "narration", "art", "episode", "pillar", "date", "type", "shape", "pick", "motion", "strength", "from", "to"]);

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

/** What a scene draws: a SCENE_ART name, or the diagram / motion data the code draws it from. */
export function artOf(slide) {
  const drawn = Object.fromEntries(["art", "visual", "motion"].filter((k) => slide[k]).map((k) => [k, slide[k]]));
  return Object.keys(drawn).length ? JSON.stringify(drawn) : "（絵なし）";
}

export function scriptOf(content, { art = false } = {}) {
  const data = buildCardsData(content, {});
  const scenes = [...data.slides, data.ending];
  return scenes
    .map((s, i) =>
      [`【場面 ${i + 1}】`, `画面: ${screenText(s).join(" / ")}`, `読み上げ: ${s.narration}`, ...(art ? [`絵: ${artOf(s)}`] : [])].join("\n")
    )
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
    content = fallbackLessonContent(episode, airDate());
  } else {
    const path = resolve(args.find((a) => !a.startsWith("--")) || join(rootDir, "data", "enriched-coffee-news.json"));
    content = JSON.parse(readFileSync(path, "utf-8"));
  }
  console.log(scriptOf(content, { art: args.includes("--art") }));
}
