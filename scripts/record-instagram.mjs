/**
 * Add an Instagram-only retry's post to the day's performance-history entry.
 *   node scripts/record-instagram.mjs --date=YYYY-MM-DD   # reads output/instagram-result.json
 * record-upload.mjs builds a whole entry from the daily run's output (it needs
 * upload-result.json); a retry has only the Instagram result, so this fills in
 * just `instagram` on the entry the daily run left (same shape as record-upload).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

export function addInstagram(history, date, mediaId) {
  const entry = (history.videos || []).find((v) => v.date === date);
  if (!entry) throw new Error(`${date} has no entry in performance-history.json`);
  const known = entry.instagram?.mediaId;
  if (known && known !== mediaId) throw new Error(`${date} already records Instagram ${known}, not ${mediaId}`);
  if (!known) {
    entry.instagram = { mediaId, permalink: null, views: null, reach: null, likes: null, comments: null, shares: null, saved: null, updatedAt: null };
  }
  return history;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const date = process.argv.find((a) => a.startsWith("--date="))?.slice(7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("--date=YYYY-MM-DD required");
  const { mediaId } = JSON.parse(readFileSync(join(rootDir, "output/instagram-result.json"), "utf-8"));
  if (!mediaId) throw new Error("output/instagram-result.json has no mediaId");
  const path = join(rootDir, "data/performance-history.json");
  writeFileSync(path, JSON.stringify(addInstagram(JSON.parse(readFileSync(path, "utf-8")), date, mediaId), null, 2));
  console.log(`record-instagram: ${date} → Instagram ${mediaId}`);
}
