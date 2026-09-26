/**
 * Motion samples of the explanation scene (湯温の回) in the looks lab and photo:
 * an mp4 each and a strip of five key frames (the Canvas cannot play video).
 * Writes docs/previews/explain-<look>.mp4 and explain-<look>-frames.png.
 *
 * Usage: node scripts/render-explain.mjs [--only=lab]
 */
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const outDir = join(rootDir, "docs", "previews");
const tmp = join(rootDir, "output", "explain");
mkdirSync(tmp, { recursive: true });
const ffmpeg = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
export const KEYFRAMES = [20, 60, 100, 140, 185];

const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });
for (const look of ["lab", "photo"].filter((l) => !only || l === only)) {
  const inputProps = { look };
  const composition = await selectComposition({ serveUrl, id: "ExplainPreview", inputProps });
  const raw = join(tmp, `${look}.mp4`);
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: raw, inputProps, muted: true });
  ffmpeg(["-i", raw, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", join(outDir, `explain-${look}.mp4`)]);
  const select = KEYFRAMES.map((f) => `eq(n\\,${f})`).join("+");
  ffmpeg(["-i", raw, "-vf", `select='${select}',scale=432:768,pad=440:768:4:0:0x111111,tile=${KEYFRAMES.length}x1`, "-frames:v", "1", "-vsync", "vfr", join(outDir, `explain-${look}-frames.png`)]);
  console.log(`explain ${look}: mp4 + frames written`);
}
