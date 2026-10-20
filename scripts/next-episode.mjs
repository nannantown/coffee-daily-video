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
  const premise = ep.lesson.premise;
  const script = ep.lesson.script;
  if (script) {
    // an approved script (docs/curriculum.md 「台本の回」): its scenes are the video; the premise is one of them
    console.log(`  台本の回 (script, 一字も変えずに写す): 表紙（問いだけ）→ ${script.scenes.map((s) => s.heading).join(" → ")} → 締め`);
    console.log("  前提 (premise): 書かない（台本の場面が言う）");
  } else {
    console.log(`  前提 (premise.term, 外さない・変えない): ${premise ? `${premise.term} — ${premise.say}${premise.ref ? `（くわしくは ${premise.ref}）` : ""}` : "なし（手順 2 の 0.5 で点検）"}`);
  }
  console.log(`  次回: ${next.lesson.word}${next.lesson.ask}${next.lesson.premise ? `（前提: ${next.lesson.premise.term}）` : ""}`);
  console.log("  下書き: node scripts/next-episode.mjs --json");
}
