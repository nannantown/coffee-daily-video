import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addDays,
  groupBySaved,
  igMetrics,
  median,
  rankBySaved,
  recentRows,
  renderMarkdown,
  summarize,
  trialStatus,
  verdict,
  windowStats,
  ytViews,
} from "./pdca-summary.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function video(date, { yt = 0, ig = { views: 10, reach: 8, saved: 0, shares: 0 }, content = null } = {}) {
  return {
    date,
    title: `【今日の一杯】${date}`,
    stats: yt == null ? { views: 0, updatedAt: null } : { views: yt, updatedAt: `${date}T01:00:00Z` },
    instagram: ig == null ? null : { mediaId: "m", ...ig, updatedAt: `${date}T02:00:00Z` },
    content,
  };
}

const recipe = (beanId, method, angle = "trouble") => ({
  format: "recipe",
  trial: "coffee-trial-1-recipe-card",
  fallback: false,
  beanId,
  beanName: beanId,
  method,
  scene: "hot",
  angle,
  tipProblems: [],
});

test("median and date helpers", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(addDays("2026-09-15", 14), "2026-09-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("metrics follow the genre-experiment aggregation (missing values excluded, saved null → 0)", () => {
  assert.equal(ytViews(video("2026-09-01", { yt: null })), null);
  assert.equal(ytViews(video("2026-09-01", { yt: 3 })), 3);
  assert.equal(igMetrics(video("2026-09-01", { ig: null })), null);
  assert.equal(igMetrics(video("2026-09-01", { ig: { views: null } })), null);
  assert.equal(igMetrics(video("2026-09-01", { ig: { views: 5, saved: null } })).saved, 0);

  const videos = [
    video("2026-09-01", { yt: 1, ig: { views: 10, reach: 9, saved: 2 } }),
    video("2026-09-02", { yt: 3, ig: { views: 30, reach: 20, saved: null } }),
    video("2026-09-03", { yt: null, ig: null }),
    video("2026-09-04", { yt: 5, ig: { views: 20, reach: 15, saved: 4 } }),
  ];
  const s = windowStats(videos, "2026-09-01", "2026-09-04");
  assert.equal(s.posts, 4);
  assert.deepEqual(s.yt, { n: 3, viewsMedian: 3 });
  assert.deepEqual(s.ig, { n: 3, viewsMedian: 20, savedSum: 6 });
});

test("verdict thresholds are applied top to bottom and need n ≥ 7", () => {
  const stats = (igMedian, saved, ytMedian, n = 7) => ({
    ig: { n, viewsMedian: igMedian, savedSum: saved },
    yt: { n, viewsMedian: ytMedian },
  });
  assert.equal(verdict("ig", stats(5, 0, 0, 6)), "判定保留（データ不足）");
  assert.equal(verdict("ig", stats(9, 4, 0)), "配信死亡");
  assert.equal(verdict("ig", stats(9, 5, 0)), "続行");
  assert.equal(verdict("ig", stats(49, 0, 0)), "切替候補");
  assert.equal(verdict("ig", stats(50, 0, 0)), "続行");
  assert.equal(verdict("yt", stats(0, 0, 4)), "配信死亡");
  assert.equal(verdict("yt", stats(0, 0, 19)), "切替候補");
  assert.equal(verdict("yt", stats(0, 0, 20)), "続行");
});

test("before the first recipe post the report shows trial #0 on its 14-day cycle", () => {
  const history = { videos: [video("2026-09-10"), video("2026-09-11")] };
  const s = trialStatus(history, "2026-09-20");
  assert.equal(s.trial, 0);
  assert.equal(s.judgeDate, "2026-09-28");
  assert.equal(s.day, 6);
  assert.equal(s.stats.from, "2026-09-07");
  assert.equal(trialStatus(history, "2026-09-14").isJudgeDay, true);
});

test("trial #1 starts at the first recipe-card post: window start..start+13, judged on start+14", () => {
  const videos = [video("2026-09-14")];
  for (let i = 0; i < 16; i++) {
    videos.push(video(addDays("2026-09-15", i), { ig: { views: 20, reach: 10, saved: 1 }, content: recipe("b", "v60") }));
  }
  const history = { videos };
  const mid = trialStatus(history, "2026-09-21");
  assert.equal(mid.trial, 1);
  assert.equal(mid.start, "2026-09-15");
  assert.equal(mid.day, 7);
  assert.equal(mid.judgeDate, "2026-09-29");
  assert.equal(mid.isJudgeDay, false);
  assert.equal(mid.stats.to, "2026-09-21");
  assert.equal(mid.baseline.to, "2026-09-14");

  const judge = trialStatus(history, "2026-09-29");
  assert.equal(judge.isJudgeDay, true);
  assert.equal(judge.stats.to, "2026-09-28");
  assert.equal(judge.stats.ig.n, 14);
  assert.equal(judge.stats.ig.savedSum, 14);
  assert.equal(verdict("ig", judge.stats), "続行");
});

test("rankings use IG saves, skip provisional days and videos without IG values", () => {
  const history = {
    videos: [
      video("2026-09-10", { ig: { views: 50, reach: 40, saved: 1 }, content: recipe("a", "v60") }),
      video("2026-09-11", { ig: { views: 5, reach: 5, saved: 3 }, content: recipe("b", "aeropress") }),
      video("2026-09-12", { ig: { views: 90, reach: 80, saved: 0 }, content: recipe("a", "v60") }),
      video("2026-09-13", { ig: null, content: recipe("c", "v60") }),
      video("2026-09-14", { ig: { views: 99, reach: 90, saved: 9 }, content: recipe("c", "v60") }), // provisional
    ],
  };
  const rows = recentRows(history, "2026-09-15", 14, 2);
  assert.equal(rows[0].date, "2026-09-14");
  assert.equal(rows[0].provisional, true);
  assert.equal(rows.find((r) => r.date === "2026-09-12").provisional, false);
  const { top, worst, n } = rankBySaved(rows);
  assert.equal(n, 3);
  assert.deepEqual(top.map((r) => r.date), ["2026-09-11", "2026-09-10", "2026-09-12"]);
  assert.equal(worst[0].date, "2026-09-12");

  const byMethod = groupBySaved(rows, (r) => r.method);
  assert.deepEqual(byMethod.map((g) => [g.key, g.n, g.savedSum]), [
    ["エアロプレス", 1, 3],
    ["V60", 2, 1],
  ]);
});

test("markdown: status section first, IG saves as the primary column", () => {
  const history = { videos: [video("2026-09-10", { ig: { views: 7, reach: 6, saved: 2 }, content: recipe("a", "v60") })] };
  const md = renderMarkdown(summarize(history, { today: "2026-09-15" }));
  assert.ok(md.startsWith("## ジャンル試行の状態"));
  assert.match(md, /\| \*\*IG 保存\*\* \|/);
  assert.match(md, /TOP 3 \/ WORST 3（IG 保存数/);
  assert.match(md, /### 抽出法/);
});

test("real history file: summary renders without throwing (values change daily, so nothing is pinned)", () => {
  const history = JSON.parse(readFileSync(join(rootDir, "data", "performance-history.json"), "utf-8"));
  const md = renderMarkdown(summarize(history, { today: "2026-09-14" }));
  assert.match(md, /\| IG @open_ground_coffee_roasters \|/);
  assert.match(md, /\| YT @MindBrewLab \|/);
});
