/**
 * Render one PNG per card segment (+ a contact sheet) for review — used by
 * dry runs and PR previews. Bundles once, then renderStill per segment.
 *
 * Usage:
 *   node scripts/render-previews.mjs                                  # output/input-props.json if present, else composition defaults
 *   node scripts/render-previews.mjs --props=output/input-props.json --out=output/previews
 *   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell node scripts/render-previews.mjs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const propsPath = resolve(arg("props") || join(rootDir, "output", "input-props.json"));
  const outDir = resolve(arg("out") || join(rootDir, "output", "previews"));
  const browserExecutable = arg("browser") || process.env.REMOTION_BROWSER_EXECUTABLE || null;
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (/^slide-\d+\.png$|^contact-sheet\.png$/.test(f)) rmSync(join(outDir, f));
  }

  const inputProps = existsSync(propsPath) ? JSON.parse(readFileSync(propsPath, "utf-8")) : undefined;
  if (inputProps && !inputProps.timeline) {
    throw new Error(`${propsPath} is not a card-format props file (no timeline)`);
  }
  const previewProps = inputProps ? { ...inputProps, withAudio: false } : undefined;

  console.log("Bundling...");
  const serveUrl = await bundle({ entryPoint: join(rootDir, "src", "index.ts") });
  const composition = await selectComposition({
    serveUrl,
    id: "CoffeeCardsVideo",
    inputProps: previewProps,
    browserExecutable,
  });
  const props = previewProps || composition.defaultProps;
  const segments = [...props.timeline.slides, props.timeline.ending];

  let start = 0;
  const files = [];
  for (let i = 0; i < segments.length; i++) {
    // late enough that every Reveal has finished, early enough to stay in the segment
    const frame = start + Math.min(segments[i] - 1, 48);
    const output = join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await renderStill({ composition, serveUrl, output, frame, inputProps: props, imageFormat: "png", browserExecutable });
    console.log(`  segment ${i + 1}/${segments.length} (frame ${frame}) → ${output}`);
    files.push(output);
    start += segments[i];
  }

  const sheet = join(outDir, "contact-sheet.png");
  execSync(
    `ffmpeg -y -loglevel error -framerate 1 -i "${join(outDir, "slide-%02d.png")}" -vf "scale=360:640,tile=${files.length}x1:padding=12:color=0x111111" -frames:v 1 "${sheet}"`,
    { stdio: "inherit" }
  );
  console.log(`Contact sheet → ${sheet}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
