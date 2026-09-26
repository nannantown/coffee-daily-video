/**
 * Previews for the 2026-09-26 redesign: for each candidate direction (A/B/C),
 * the covers of three episodes as the Instagram profile grid shows them (the
 * centre 3:4 of the 9:16 frame, side by side), the full 9:16 covers, and an
 * 8-second clip of the first episode. Writes docs/previews/direction-*.
 *
 * Usage: node scripts/render-directions.mjs [--only=A]
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
const tmp = join(rootDir, "output", "directions");
mkdirSync(tmp, { recursive: true });

const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });

for (const direction of ["A", "B", "C"].filter((d) => !only || d === only)) {
  const covers = [];
  for (const episodeIndex of [0, 1, 2]) {
    const inputProps = { direction, episodeIndex };
    const composition = await selectComposition({ serveUrl, id: "DirectionPreview", inputProps });
    const output = join(tmp, `${direction}-${episodeIndex}.png`);
    // frame 45 = 1.5s, the offset IG takes the grid thumbnail from (upload-instagram.mjs)
    await renderStill({ composition, serveUrl, output, frame: 45, inputProps, imageFormat: "png" });
    covers.push(output);
  }
  const inputs = covers.flatMap((f) => ["-i", f]);
  // Profile grid: centre 3:4 (1080x1440 of 1080x1920), three tiles, white gutters like the app.
  const crops = covers.map((_, i) => `[${i}:v]crop=1080:1440:0:240,scale=540:720,pad=544:720:2:0:white[c${i}]`).join(";");
  ffmpeg([...inputs, "-filter_complex", `${crops};[c0][c1][c2]hstack=3`, "-frames:v", "1", join(outDir, `direction-${direction}-grid.png`)]);
  // Full 9:16 covers, for what the Reel itself opens on.
  const full = covers.map((_, i) => `[${i}:v]scale=432:768,pad=444:768:6:0:0x111111[f${i}]`).join(";");
  ffmpeg([...inputs, "-filter_complex", `${full};[f0][f1][f2]hstack=3`, "-frames:v", "1", join(outDir, `direction-${direction}-covers.png`)]);

  const inputProps = { direction, episodeIndex: 0 };
  const composition = await selectComposition({ serveUrl, id: "DirectionPreview", inputProps });
  const clip = join(tmp, `${direction}-clip.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: clip, inputProps, muted: true });
  ffmpeg(["-i", clip, "-vf", "scale=540:960", "-c:v", "libx264", "-crf", "26", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", join(outDir, `direction-${direction}-clip.mp4`)]);
  console.log(`direction ${direction}: grid + covers + clip written`);
}
