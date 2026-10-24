/**
 * Record upload metadata to performance history.
 * Reads upload-result.json + trending-data.json + captions.json
 * and appends a new entry to data/performance-history.json.
 *
 * Non-blocking: failures here don't affect the pipeline.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { contentRecord } from "./content-format.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const historyPath = join(rootDir, "data", "performance-history.json");

function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function main() {
  // Read upload result
  const uploadResult = readJSON(join(outputDir, "upload-result.json"));
  if (!uploadResult || !uploadResult.videoId) {
    console.log("record-upload: no upload-result.json found, skipping.");
    return;
  }

  // Read trending data for project info
  const trendingData = readJSON(join(outputDir, "trending-data.json"));

  // Read captions for hashtags/title info
  const captions = readJSON(join(outputDir, "captions.json"));

  // Read audio durations for video length
  const audioDurations = readJSON(join(outputDir, "audio-durations.json"));

  // Instagram Media ID written by upload-instagram.mjs (absent if IG skipped/failed;
  // fetch-stats.mjs then restores it by date-matching)
  // A corrupt file must not cost the day's whole entry (incl. YouTube videoId).
  let igResult = null;
  try {
    igResult = readJSON(join(outputDir, "instagram-result.json"));
  } catch (err) {
    console.error("record-upload: unreadable Instagram result; preserve existing publication record.");
  }

  // Calculate total duration
  let durationSeconds = 0;
  if (audioDurations) {
    durationSeconds = Object.values(audioDurations).reduce(
      (sum, d) => sum + d,
      0
    );
  }

  // Build video entry
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const history = readJSON(historyPath) || { schemaVersion: 1, videos: [], optimizationLog: [] };
  const previousInstagram = history.videos.find((v) => v.date === dateStr)?.instagram;
  const validMediaId = (id) => typeof id === "string" && /^[0-9]{5,25}$/.test(id);
  const verifiedResult = igResult?.date === dateStr && validMediaId(igResult.mediaId);
  const hasPrevious = validMediaId(previousInstagram?.mediaId);
  if (hasPrevious && verifiedResult && previousInstagram.mediaId !== igResult.mediaId) {
    console.error("record-upload: conflicting Instagram result; preserve existing publication record.");
  }

  const entry = {
    videoId: uploadResult.videoId,
    videoUrl: uploadResult.videoUrl,
    date: dateStr,
    title: captions?.youtube?.title || "",
    titleTemplate: captions?.youtube?.titleTemplate || "standard",
    hashtags: captions?.youtube?.tags || [],
    languages: trendingData?.projects
      ? [...new Set(trendingData.projects.map((p) => p.language).filter(Boolean))]
      : [],
    projects: trendingData?.projects
      ? trendingData.projects.map((p) => p.fullName)
      : [],
    durationSeconds: Math.round(durationSeconds),
    // 「今日の抽出メモ」summary (format, trial, fallback, pillar, topic, method,
    // scene, tipProblems) — scripts/pdca-summary.mjs groups IG saves by these.
    // null = a post from before the card formats existed.
    content: contentRecord(trendingData),
    stats: {
      views: 0,
      likes: 0,
      comments: 0,
      updatedAt: null,
    },
    // Metrics are filled by fetch-stats.mjs (IG insights lag up to 48h)
    instagram: hasPrevious ? previousInstagram : verifiedResult
      ? {
          mediaId: igResult.mediaId,
          permalink: null,
          views: null,
          reach: null,
          likes: null,
          comments: null,
          shares: null,
          saved: null,
          updatedAt: null,
        }
      : null,
  };

  // Avoid duplicates (same date)
  history.videos = history.videos.filter((v) => v.date !== dateStr);

  // Append
  history.videos.push(entry);

  // Keep last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  history.videos = history.videos.filter((v) => v.date >= cutoffStr);

  // Write
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`record-upload: recorded ${entry.videoId} (${dateStr})`);
  console.log(`  Title: ${entry.title}`);
  console.log(`  Languages: ${entry.languages.join(", ")}`);
  console.log(`  Instagram: ${entry.instagram ? entry.instagram.mediaId : "no media id (restored later by fetch-stats)"}`);
  console.log(`  History: ${history.videos.length} videos tracked`);
}

try { main(); } catch { console.error("record-upload: failed; raw exception suppressed."); process.exitCode = 1; }
