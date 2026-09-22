/**
 * Full pipeline: stats → content → audio → render → post → record
 *
 * Usage:
 *   node scripts/pipeline.mjs                                   # production (daily-video.yml)
 *   DRY_RUN=true node scripts/pipeline.mjs                      # verification: no stats fetch, no posting, no history write
 *   DRY_RUN=true node scripts/pipeline.mjs --content=data/samples/brew-lesson.sample.json
 *   DRY_RUN=true node scripts/pipeline.mjs --fallback           # render the house-recipe fallback
 *
 * Content formats (see scripts/content-format.mjs): 「今日の一杯」recipe cards
 * and the Sunday news TOP5 render with the CoffeeCardsVideo composition; a
 * legacy content JSON without `format` still renders the CoffeeVideo news
 * explainer.
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { computeCardTimeline, jstDateParts, TIMELINE } from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");

const contentArg = process.argv.find((a) => a.startsWith("--content="));
const fallbackArg = process.argv.includes("--fallback") ? "--fallback" : "";
// Samples and forced fallbacks are for verification only — never posted.
const dryRun =
  process.env.DRY_RUN === "true" || process.argv.includes("--dry-run") || Boolean(contentArg || fallbackArg);
// Beans still "candidate" in data/coffee-lineup.json may be rendered in a dry
// run, never posted.
const generateDataArgs = [contentArg ? `"${contentArg}"` : "", fallbackArg]
  .filter(Boolean)
  .join(" ");

// Instagram rejects Reels over 60s; re-synthesize faster before giving up.
const FASTER_RATES = ["+25%", "+35%"];
const HARD_LIMIT_SECONDS = 59.5;
const SILENCE_DB = -50;

function run(cmd) {
  console.log(`\n>>> ${cmd}\n`);
  execSync(cmd, { cwd: rootDir, stdio: "inherit" });
}

function runSafe(cmd, label) {
  try {
    run(cmd);
  } catch (err) {
    console.error(`${label} failed (non-blocking): ${err.message}`);
  }
}

/**
 * Refuse to post a video without narration: no audio stream, or a mean volume
 * that is effectively silence (narration + BGM measures around -20 dB).
 */
function assertAudible(file) {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
    { cwd: rootDir, encoding: "utf-8" }
  );
  if (!String(probe.stdout || "").includes("audio")) {
    throw new Error(`${file} has no audio stream`);
  }
  const detect = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"],
    { cwd: rootDir, encoding: "utf-8" }
  );
  const match = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(String(detect.stderr || ""));
  if (!match) {
    console.log("  audio check: mean volume not measurable (continuing)");
    return;
  }
  const meanDb = match[1] === "-inf" ? -Infinity : Number(match[1]);
  console.log(`  audio check: mean_volume ${meanDb} dB`);
  if (meanDb < SILENCE_DB) {
    throw new Error(`${file} is silent (mean_volume ${meanDb} dB < ${SILENCE_DB} dB) — narration/BGM missing`);
  }
}

function readOutput(name) {
  return JSON.parse(readFileSync(join(outputDir, name), "utf-8"));
}

function cardTimeline(data) {
  return computeCardTimeline(readOutput("audio-durations.json"), data.slides.length);
}

/** Keep the card video under Instagram's 60-second limit. Returns the final data + timeline. */
function enforceDurationLimit(data) {
  let timeline = cardTimeline(data);
  for (const rate of FASTER_RATES) {
    if (timeline.seconds <= TIMELINE.maxSeconds) return { data, timeline };
    console.log(`\n  ${timeline.seconds.toFixed(1)}s > ${TIMELINE.maxSeconds}s → re-synthesize narration at ${rate}`);
    run(`node scripts/generate-audio.mjs --data=output/trending-data.json --rate=${rate}`);
    timeline = cardTimeline(data);
  }
  if (timeline.seconds > TIMELINE.maxSeconds) {
    console.log(`\n  still ${timeline.seconds.toFixed(1)}s → short template narration`);
    run(`node scripts/generate-data.mjs ${generateDataArgs} --template-narration`);
    data = readOutput("trending-data.json");
    run(`node scripts/generate-audio.mjs --data=output/trending-data.json --rate=${FASTER_RATES[0]}`);
    timeline = cardTimeline(data);
  }
  if (timeline.seconds > HARD_LIMIT_SECONDS) {
    throw new Error(`Card video is ${timeline.seconds.toFixed(1)}s (> ${HARD_LIMIT_SECONDS}s) even with template narration`);
  }
  return { data, timeline };
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  const dateStr = jstDateParts().compact;

  if (dryRun) {
    console.log("=== DRY RUN: no stats fetch, no SNS posting, no performance-history write ===");
    if (process.env.DRY_RUN !== "true" && (contentArg || fallbackArg)) {
      console.log("    (--content / --fallback always run as a dry run)");
    }
  } else {
    // Step 0: Fetch past video stats & generate optimization hints
    console.log("=== Step 0: Fetch Stats & Optimize ===");
    runSafe("node scripts/fetch-stats.mjs", "fetch-stats");
  }

  // Step 1: Content → narration + slides
  console.log("\n=== Step 1: Generate Data ===");
  run(`node scripts/generate-data.mjs ${generateDataArgs}`);

  // Step 3: Generate TTS audio + BGM
  console.log("\n=== Step 3: Generate Audio ===");
  run("node scripts/generate-audio.mjs --data=output/trending-data.json");
  run("node scripts/generate-bgm.mjs");

  // Step 4: Build input props for Remotion
  console.log("\n=== Step 4: Build Input Props ===");
  let data = readOutput("trending-data.json");
  const limited = enforceDurationLimit(data);
  data = limited.data;
  const inputProps = {
    format: data.format,
    withAudio: true,
    slides: data.slides,
    ending: data.ending,
    timeline: {
      slides: limited.timeline.slides,
      ending: limited.timeline.ending,
      total: limited.timeline.total,
    },
  };
  console.log(`  ${data.format}: ${data.slides.length} slides + ending, ${limited.timeline.seconds.toFixed(1)}s`);
  const compositionId = "CoffeeCardsVideo";

  const propsPath = join(outputDir, "input-props.json");
  writeFileSync(propsPath, JSON.stringify(inputProps));
  console.log(`Input props → ${propsPath} (${compositionId})`);

  // Step 5: Render video (to intermediate file — Remotion emits yuvj420p
  //         despite Config.setPixelFormat("yuv420p"); Instagram Reels rejects
  //         yuvj420p with ProcessingFailedError during media processing.
  //         Step 5b re-encodes to yuv420p as a guaranteed normalization pass.)
  const rawFile = `output/coffee-${dateStr}.raw.mp4`;
  const outputFile = `output/coffee-${dateStr}.mp4`;
  console.log(`\n=== Step 5: Render Video → ${rawFile} ===`);
  run(`npx remotion render ${compositionId} "${rawFile}" --props="${propsPath}"`);

  console.log(`\n=== Step 5b: Normalize to yuv420p → ${outputFile} ===`);
  run(
    `ffmpeg -y -i "${rawFile}" -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.0 -crf 20 -preset fast -c:a copy -movflags +faststart "${outputFile}"`
  );
  run(`rm -f "${rawFile}"`);
  assertAudible(outputFile);

  // Step 5c: Render cover image. Frame 45 = the first card with its hook,
  //          answer and all numbers faded in. Uploaded to the GitHub Release
  //          and passed as cover_url to IG so the grid thumbnail is not a
  //          black frame. Non-blocking: IG falls back to thumb_offset=7000ms.
  const coverFile = `output/coffee-${dateStr}-cover.jpg`;
  const coverFrame = 45;
  console.log(`\n=== Step 5c: Render Cover Image → ${coverFile} ===`);
  runSafe(
    `npx remotion still ${compositionId} "${coverFile}" --frame=${coverFrame} --props="${propsPath}"`,
    "render-cover"
  );

  if (dryRun) {
    console.log(`\n=== Dry run: captions + slide previews (nothing is posted) ===`);
    run("node scripts/generate-caption.mjs");
    runSafe(`node scripts/render-previews.mjs --props="${propsPath}" --out=output/previews`, "render-previews");
    console.log(`\n=== Done (dry run)! ${outputFile} ===`);
    return;
  }

  // Step 6: Post to SNS (optional - skips if credentials not configured)
  const snsEnabled = process.env.SNS_POST_ENABLED === "true";
  if (snsEnabled) {
    console.log(`\n=== Step 6: Post to SNS ===`);
    run(`node scripts/post-sns.mjs --video="${outputFile}"`);
  } else {
    console.log(`\n=== Step 6: SNS posting skipped (set SNS_POST_ENABLED=true to enable) ===`);
  }

  // Step 7: Record upload for analytics tracking
  if (snsEnabled) {
    console.log(`\n=== Step 7: Record Upload ===`);
    runSafe("node scripts/record-upload.mjs", "record-upload");
  }

  console.log(`\n=== Done! ${outputFile} ===`);
}

main();
