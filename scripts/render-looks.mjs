/**
 * Previews for the 2026-09-26 redesign, second round (the first three looks
 * were rejected as dated). For each look (lab / photo / still): the covers of
 * three episodes as the Instagram profile grid shows them (centre 3:4 of the
 * 9:16 frame), the full 9:16 covers, a clip (cover → why → both ways) and a
 * strip of key frames of that clip (the Canvas cannot play video).
 * Writes docs/previews/look-*.
 *
 * Usage: node scripts/render-looks.mjs [--only=lab]
 */
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const outDir = join(rootDir, "docs", "previews");
const tmp = join(rootDir, "output", "looks");
mkdirSync(tmp, { recursive: true });

const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });
const KEYFRAMES = [45, 100, 160, 220, 290];

for (const look of ["lab", "photo", "still"].filter((l) => !only || l === only)) {
  const covers = [];
  for (const episodeIndex of [0, 1, 2]) {
    const inputProps = { look, episodeIndex };
    const composition = await selectComposition({ serveUrl, id: "LookPreview", inputProps });
    const output = join(tmp, `${look}-${episodeIndex}.png`);
    // frame 45 = 1.5s, the offset IG takes the grid thumbnail from (upload-instagram.mjs)
    await renderStill({ composition, serveUrl, output, frame: 45, inputProps, imageFormat: "png" });
    covers.push(output);
  }
  const inputs = covers.flatMap((f) => ["-i", f]);
  const crops = covers.map((_, i) => `[${i}:v]crop=1080:1440:0:240,scale=540:720,pad=544:720:2:0:white[c${i}]`).join(";");
  ffmpeg([...inputs, "-filter_complex", `${crops};[c0][c1][c2]hstack=3`, "-frames:v", "1", join(outDir, `look-${look}-grid.png`)]);
  const full = covers.map((_, i) => `[${i}:v]scale=432:768,pad=444:768:6:0:0x111111[f${i}]`).join(";");
  ffmpeg([...inputs, "-filter_complex", `${full};[f0][f1][f2]hstack=3`, "-frames:v", "1", join(outDir, `look-${look}-covers.png`)]);

  const inputProps = { look, episodeIndex: 0 };
  const composition = await selectComposition({ serveUrl, id: "LookPreview", inputProps });
  const clip = join(tmp, `${look}-clip.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: clip, inputProps, muted: true });
  ffmpeg(["-i", clip, "-vf", "scale=540:960", "-c:v", "libx264", "-crf", "26", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", join(outDir, `look-${look}-clip.mp4`)]);
  const select = KEYFRAMES.map((f) => `eq(n\\,${f})`).join("+");
  ffmpeg(["-i", clip, "-vf", `select='${select}',scale=324:576,pad=330:576:3:0:0x111111,tile=${KEYFRAMES.length}x1`, "-frames:v", "1", "-vsync", "vfr", join(outDir, `look-${look}-motion.png`)]);
  console.log(`look ${look}: grid + covers + clip + motion written`);
}
