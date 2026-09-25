/**
 * Write silent Remotion props for one curriculum episode (its evergreen lesson),
 * for previews: `render-previews.mjs --props=<out>` renders its cards without
 * TTS or network. Segment lengths are the timeline minimums (no audio).
 *
 * Usage:
 *   node scripts/episode-props.mjs --episode=b06-temp --out=output/props-b06.json
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { buildCardsData, computeCardTimeline, episodeById, fallbackLessonContent, jstDateParts } from "./content-format.mjs";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const episode = episodeById(arg("episode"));
if (!episode) {
  console.error(`unknown --episode=${arg("episode")} (ids: data/curriculum.json)`);
  process.exit(1);
}
const out = resolve(arg("out") || `output/props-${episode.id}.json`);
const today = jstDateParts();
const content = { ...fallbackLessonContent(episode, today.iso), fallback: false };
const data = buildCardsData(content, { dateDisplay: today.display });
const timeline = computeCardTimeline({}, data.slides.length);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ format: data.format, withAudio: false, slides: data.slides, ending: data.ending, timeline }, null, 2));
console.log(`${episode.id} (${episode.lesson.visual.type}) → ${out}`);
