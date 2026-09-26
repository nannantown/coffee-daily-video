/**
 * Motion samples of the why scene, built exactly like the daily video
 * (curriculum episode → content-format.mjs → CoffeeCardsVideo in a look), no TTS.
 * Per sample: an mp4 of the why scene and a strip of five key frames.
 *
 * Usage: node scripts/render-motion.mjs lab:b06-temp photo:b06-temp lab:b04-grind photo:a01-tds
 * Writes docs/previews/motion-<look>-<episode>.mp4 and motion-<look>-<episode>-frames.png.
 */
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { CURRICULUM, buildCardsData, computeCardTimeline, fallbackLessonContent } from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "docs", "previews");
const tmp = join(rootDir, "output", "motion");
mkdirSync(tmp, { recursive: true });
const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const WHY_SECONDS = 5; // the why scene is at least this long in the sample (narration sets it in production)

const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });
for (const spec of process.argv.slice(2)) {
  const [look, id] = spec.split(":");
  const ep = CURRICULUM.episodes.find((e) => e.id === id);
  if (!ep) throw new Error(`no episode ${id}`);
  const data = buildCardsData(fallbackLessonContent(ep, "2026-09-27"), { dateDisplay: "" });
  const timeline = computeCardTimeline({}, data.slides.length);
  const whyIndex = data.slides.findIndex((s) => s.kind === "lesson-why");
  timeline.slides[whyIndex] = Math.max(timeline.slides[whyIndex], WHY_SECONDS * 30);
  timeline.total = timeline.slides.reduce((a, b) => a + b, 0) + timeline.ending;
  const inputProps = { format: "brew-lesson", slides: data.slides, ending: data.ending, timeline, withAudio: false, look };
  const composition = await selectComposition({ serveUrl, id: "CoffeeCardsVideo", inputProps });
  const start = timeline.slides.slice(0, whyIndex).reduce((a, b) => a + b, 0);
  const len = timeline.slides[whyIndex];
  const raw = join(tmp, `${look}-${id}.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: raw, inputProps, muted: true, frameRange: [start, start + len - 1] });
  const base = join(outDir, `motion-${look}-${id}`);
  ffmpeg(["-i", raw, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", `${base}.mp4`]);
  const keys = [10, 40, 70, 100, len - 5];
  const select = keys.map((f) => `eq(n\\,${f})`).join("+");
  ffmpeg(["-i", raw, "-vf", `select='${select}',scale=432:768,pad=440:768:4:0:0x111111,tile=${keys.length}x1`, "-frames:v", "1", "-vsync", "vfr", `${base}-frames.png`]);
  console.log(`${look} ${id}: ${ep.lesson.motion.type}, ${len} frames`);
}
