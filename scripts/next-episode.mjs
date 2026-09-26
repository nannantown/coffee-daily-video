/**
 * Print today's episode of the series 「味をコントロールする技術」 — the episode
 * of data/curriculum.json after the last one aired (the latest `content.episode`
 * of data/performance-history.json dated before today; episode 1 if none, and
 * after the last episode). The morning routine writes this episode;
 * generate-data.mjs falls back to its evergreen lesson when the routine does not.
 *
 * Usage:
 *   node scripts/next-episode.mjs            # today (JST)
 *   node scripts/next-episode.mjs --date=2026-09-26
 *   node scripts/next-episode.mjs --json     # the episode's evergreen lesson as the starting draft
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PILLARS, VISUAL_TYPES, episodeNumber, followingEpisode, jstDateParts, nextEpisode } from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const historyPath = join(rootDir, "data", "performance-history.json");
const date = process.argv.find((a) => a.startsWith("--date="))?.slice(7) || jstDateParts().iso;
const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, "utf-8")) : { videos: [] };

const ep = nextEpisode(history, date);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ date, format: "brew-lesson", lesson: { episode: ep.id, ...ep.lesson } }, null, 2));
} else {
  const { no, level } = episodeNumber(ep.id);
  const next = followingEpisode(ep.id);
  console.log(`今日の回 (${date}): ${level} 第${no}回  episode = ${ep.id}`);
  console.log(`  柱: ${ep.lesson.pillar}（${PILLARS[ep.lesson.pillar]}）${ep.term ? ` / 用語回: ${ep.term}` : ""}`);
  console.log(`  表紙 (word + ask, 変えない): ${ep.lesson.word}${ep.lesson.ask}`);
  console.log(`  変えること (hook, 変えない): ${ep.lesson.hook}`);
  console.log(`  こう変わる (topic): ${ep.lesson.topic}`);
  console.log(`  理屈 (why): ${ep.lesson.why}`);
  console.log(`  抽出法: ${ep.lesson.method}${ep.fixedMethod ? "（固定。変えない）" : "（変えてよい）"}`);
  console.log(`  図解の型（案）: ${ep.lesson.visual.type}（${VISUAL_TYPES[ep.lesson.visual.type]}）`);
  console.log(`  次回: ${next.lesson.word}${next.lesson.ask}`);
  console.log("  下書き: node scripts/next-episode.mjs --json");
}
