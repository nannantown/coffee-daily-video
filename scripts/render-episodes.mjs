/**
 * Preview upcoming episodes in a look, built exactly like the daily video
 * (content-format.mjs → CoffeeCardsVideo) but without TTS: every slide gets
 * the minimum reading time. Per episode a contact sheet of its six scenes;
 * for the batch the covers as the Instagram profile grid shows them.
 *
 * Usage: node scripts/render-episodes.mjs --look=lab [--from=b02-measure] [--count=4]
 * Writes docs/previews/episodes-<look>-<id>.png and episodes-<look>-grid.png.
 */
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { CURRICULUM, buildCardsData, computeCardTimeline, fallbackLessonContent } from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const look = arg("look", "lab");
const eps = CURRICULUM.episodes;
const start = Math.max(0, eps.findIndex((e) => e.id === arg("from", eps[0].id)));
const count = Number(arg("count", "4"));
const outDir = join(rootDir, "docs", "previews");
const tmp = join(rootDir, "output", "episodes");
mkdirSync(tmp, { recursive: true });
const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);

const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });
const covers = [];
for (let k = 0; k < count; k++) {
  const ep = eps[(start + k) % eps.length];
  const data = buildCardsData(fallbackLessonContent(ep, "2026-09-27"), { dateDisplay: "" });
  const timeline = computeCardTimeline({}, data.slides.length);
  const inputProps = { format: "brew-lesson", slides: data.slides, ending: data.ending, timeline, withAudio: false, look };
  const composition = await selectComposition({ serveUrl, id: "CoffeeCardsVideo", inputProps });
  // one frame per scene: the cover at 1.5s (the grid thumbnail), the rest once their text is in
  let at = 0;
  const frames = timeline.slides.map((d, i) => {
    const f = i === 0 ? 45 : at + 60;
    at += d;
    return f;
  });
  frames.push(at + 60);
  const shots = [];
  for (const [i, frame] of frames.entries()) {
    const output = join(tmp, `${look}-${ep.id}-${i}.png`);
    await renderStill({ composition, serveUrl, output, frame, inputProps, imageFormat: "png" });
    shots.push(output);
  }
  covers.push(shots[0]);
  const cells = shots.map((_, i) => `[${i}:v]scale=324:576,pad=330:576:3:0:0x111111[s${i}]`).join(";");
  ffmpeg([...shots.flatMap((f) => ["-i", f]), "-filter_complex", `${cells};${shots.map((_, i) => `[s${i}]`).join("")}hstack=${shots.length}`, "-frames:v", "1", join(outDir, `episodes-${look}-${ep.id}.png`)]);
  console.log(`${ep.id}: ${shots.length} scenes`);
}
if (covers.length > 1) {
const cells = covers.map((_, i) => `[${i}:v]crop=1080:1440:0:240,scale=360:480,pad=364:480:2:0:white[c${i}]`).join(";");
ffmpeg([...covers.flatMap((f) => ["-i", f]), "-filter_complex", `${cells};${covers.map((_, i) => `[c${i}]`).join("")}hstack=${covers.length}`, "-frames:v", "1", join(outDir, `episodes-${look}-grid.png`)]);
console.log(`grid of ${covers.length} covers written`);
}
