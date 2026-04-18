/**
 * Full pipeline: scrape → generate data → generate audio → render video
 * Usage: node scripts/pipeline.mjs
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");

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

function main() {
  mkdirSync(outputDir, { recursive: true });

  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  // Step 0: Fetch past video stats & generate optimization hints
  console.log("=== Step 0: Fetch Stats & Optimize ===");
  runSafe("node scripts/fetch-stats.mjs", "fetch-stats");

  // Step 1: Scrape Coffee News
  console.log("=== Step 1: Scrape Coffee News ===");
  run("node scripts/scrape-coffee-news.mjs");

  // Step 2: Generate Japanese data
  console.log("\n=== Step 2: Generate Data ===");
  run("node scripts/generate-data.mjs");

  // Step 3: Generate TTS audio + BGM
  console.log("\n=== Step 3: Generate Audio ===");
  run("node scripts/generate-audio.mjs --data=output/trending-data.json");
  run("node scripts/generate-bgm.mjs");

  // Step 4: Build input props for Remotion
  console.log("\n=== Step 4: Build Input Props ===");
  const trendingData = JSON.parse(
    readFileSync(join(outputDir, "trending-data.json"), "utf-8")
  );
  const audioDurations = JSON.parse(
    readFileSync(join(outputDir, "audio-durations.json"), "utf-8")
  );
  const subtitles = JSON.parse(
    readFileSync(join(outputDir, "subtitles.json"), "utf-8")
  );

  const inputProps = {
    projects: trendingData.projects,
    audioDurations,
    subtitles,
  };

  const propsPath = join(outputDir, "input-props.json");
  writeFileSync(propsPath, JSON.stringify(inputProps));
  console.log(`Input props → ${propsPath}`);

  // Step 5: Render video (to intermediate file — Remotion emits yuvj420p
  //         despite Config.setPixelFormat("yuv420p"); Instagram Reels rejects
  //         yuvj420p with ProcessingFailedError during media processing.
  //         Step 5b re-encodes to yuv420p as a guaranteed normalization pass.)
  const rawFile = `output/coffee-${dateStr}.raw.mp4`;
  const outputFile = `output/coffee-${dateStr}.mp4`;
  console.log(`\n=== Step 5: Render Video → ${rawFile} ===`);
  run(`npx remotion render CoffeeVideo "${rawFile}" --props="${propsPath}"`);

  console.log(`\n=== Step 5b: Normalize to yuv420p → ${outputFile} ===`);
  run(
    `ffmpeg -y -i "${rawFile}" -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.0 -crf 20 -preset fast -c:a copy -movflags +faststart "${outputFile}"`
  );
  run(`rm -f "${rawFile}"`);

  // Step 5c: Render cover image (frame 60 = ~2s into opening, all fade-ins
  //          complete: date + brand title + divider + subtitle all visible).
  //          Uploaded to GitHub Release and passed as cover_url to IG so the
  //          profile-grid thumbnail shows branded content, not a black frame.
  const coverFile = `output/coffee-${dateStr}-cover.jpg`;
  console.log(`\n=== Step 5c: Render Cover Image → ${coverFile} ===`);
  run(
    `npx remotion still CoffeeVideo "${coverFile}" --frame=60 --props="${propsPath}"`
  );

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
