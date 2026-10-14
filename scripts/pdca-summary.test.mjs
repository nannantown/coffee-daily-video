import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addDays,
  cycle,
  decideMode,
  groupBySaved,
  hasJudgementOnOrAfter,
  igMetrics,
  median,
  metricObservation,
  parseStatusModes,
  previousModes,
  publicationState,
  rankBySaved,
  recentRows,
  rowTopic,
  renderMarkdown,
  rotation,
  summarize,
  trialStart,
  trialStatus,
  verdict,
  videoRow,
  windowStats,
  ytViews,
} from "./pdca-summary.mjs";
import { PILLARS } from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function video(date, { yt = 0, ig = { views: 10, reach: 8, saved: 0, shares: 0 }, content = null } = {}) {
  return {
    date,
    videoId: `yt-${date}`,
    title: `【今日の一杯】${date}`,
    stats: yt == null ? { views: 0, updatedAt: null } : { views: yt, updatedAt: `${addDays(date, 2)}T01:00:00Z` },
    instagram: ig == null ? null : { mediaId: "m", ...ig, updatedAt: `${addDays(date, 2)}T02:00:00Z` },
    content,
  };
}

const recipe = (topic, method, pillar = "temp") => ({
  format: "brew-lesson",
  trial: "coffee-trial-2-brew-basics",
  fallback: false,
  pillar,
  topic,
  method,
  scene: "hot",
  tipProblems: [],
});

const report = (date, igMode, ytMode, extra = "") => ({
  date,
  text: [
    `# PDCA レポート — ${date}`,
    "",
    "## ジャンル試行の状態",
    "",
    "| アカウント | 試行 # | 開始日 | 経過日 | 判定窓 (n) | 判定指標の現在値 | モード | 次の判定日 |",
    "|---|---|---|---|---|---|---|---|",
    `| IG @open_ground_coffee_roasters | #1 | 2026-09-15 | Day 2 / 14 | 09-15..09-16 (n=1) | views 中央値 3 / 保存合計 0 | ${igMode} | 2026-09-29 |`,
    `| YT OPEN GROUND coffee roasters | #1 | 2026-09-15 | Day 2 / 14 | 09-15..09-16 (n=1) | views 中央値 0 | ${ytMode} | 2026-09-29 |`,
    "",
    extra,
  ].join("\n"),
});

test("median and date helpers", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(addDays("2026-09-15", 14), "2026-09-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("metrics require publication evidence; missing values stay null and are excluded", () => {
  assert.equal(ytViews(video("2026-09-01", { yt: null })), null);
  assert.equal(ytViews(video("2026-09-01", { yt: 3 })), 3);
  assert.equal(igMetrics(video("2026-09-01", { ig: null })), null);
  assert.equal(igMetrics(video("2026-09-01", { ig: { views: null } })), null);
  assert.equal(igMetrics(video("2026-09-01", { ig: { views: 5, saved: null } })).saved, null);

  const videos = [
    video("2026-09-01", { yt: 1, ig: { views: 10, reach: 9, saved: 2 } }),
    video("2026-09-02", { yt: 3, ig: { views: 30, reach: 20, saved: null } }),
    video("2026-09-03", { yt: null, ig: null }),
    video("2026-09-04", { yt: 5, ig: { views: 20, reach: 15, saved: 4 } }),
  ];
  const s = windowStats(videos, "2026-09-01", "2026-09-04");
  assert.equal(s.posts, 4);
  assert.deepEqual(s.yt, { n: 3, viewsMedian: 3 });
  assert.deepEqual(s.ig, { n: 2, viewsMedian: 15, savedSum: 6 });
});

test("proof is per platform: a draft, metrics or a successful dry run never establish publication", () => {
  const measured = video("2026-10-01", { content: recipe("公開済み", "v60") });
  const ytOnly = structuredClone(measured);
  delete ytOnly.instagram.mediaId;
  const igOnly = structuredClone(measured);
  delete igOnly.videoId;
  const unknown = { ...measured, videoId: null, instagram: { ...measured.instagram, mediaId: null } };
  const dryRun = { ...measured, dryRun: true };
  const notPosted = { ...measured, publication: { ig: { status: "not-posted" }, yt: { status: "not-posted" } } };
  assert.equal(publicationState(ytOnly, "ig"), "unknown");
  assert.equal(publicationState(igOnly, "yt"), "unknown");
  assert.equal(igMetrics(ytOnly), null);
  assert.equal(ytViews(igOnly), null);
  assert.equal(publicationState(dryRun, "ig"), "dry-run");
  assert.equal(publicationState(notPosted, "yt"), "not-posted");
  assert.equal(publicationState({ ...measured, publication: { ig: { status: "unrecognised" } } }, "ig"), "unknown");
  const stats = windowStats([ytOnly, igOnly, unknown, dryRun, notPosted], "2026-10-01", "2026-10-01");
  assert.equal(stats.posts, 2);
  assert.equal(stats.ig.n, 1);
  assert.equal(stats.yt.n, 1);
  assert.equal(trialStart([unknown, dryRun, notPosted]), null);
  const rows = [unknown, dryRun, notPosted].map((v) => videoRow(v, "2026-10-14"));
  assert.equal(rankBySaved(rows).n, 0);
  assert.deepEqual(groupBySaved(rows, (r) => r.method), []);
  assert.ok(rotation(rows).method.every((r) => r.n === 0));
});

test("unmeasured and partially measured values never become zero, a worst post or a failed genre", () => {
  const noMetrics = video("2026-10-01", { yt: null, ig: { views: 0, saved: 0, reach: 0 } });
  noMetrics.instagram.updatedAt = null; // upload placeholders are not measurements
  const partial = video("2026-10-02", { yt: 0, ig: { views: 0, saved: null, reach: null } });
  partial.stats.views = null;
  const empty = windowStats([noMetrics, partial], "2026-10-01", "2026-10-02");
  assert.deepEqual(empty.ig, { n: 0, viewsMedian: null, savedSum: null });
  assert.deepEqual(empty.yt, { n: 0, viewsMedian: null });
  assert.equal(verdict("ig", empty), "判定保留");
  assert.equal(verdict("yt", empty), "判定保留");
  assert.equal(videoRow(partial, "2026-10-14").saveRate, null);
  assert.equal(rankBySaved([noMetrics, partial].map((v) => videoRow(v, "2026-10-14"))).n, 0);
  const measuredZero = video("2026-10-03", { yt: 0, ig: { views: 0, saved: 0, reach: 0 } });
  const zero = windowStats([measuredZero], "2026-10-03", "2026-10-03");
  assert.deepEqual(zero.ig, { n: 1, viewsMedian: 0, savedSum: 0 });
  assert.deepEqual(zero.yt, { n: 1, viewsMedian: 0 });
  for (const badValue of [null, "0", NaN, Infinity, -1]) {
    const invalid = video("2026-10-01", { yt: badValue, ig: { views: 1, saved: badValue } });
    assert.equal(windowStats([invalid], "2026-10-01", "2026-10-01").ig.n, 0);
    assert.equal(ytViews(invalid), null);
  }
});

test("observation age is measured at collection time in JST; old posts with young snapshots stay provisional", () => {
  const stale = video("2026-10-01");
  stale.instagram.updatedAt = "2026-10-01T15:00:00Z"; // 10-02 JST, only one calendar day
  stale.stats.updatedAt = stale.instagram.updatedAt;
  assert.equal(metricObservation(stale, "ig").ageDays, 1);
  assert.equal(videoRow(stale, "2026-10-14").provisional, true);
  assert.equal(rankBySaved([videoRow(stale, "2026-10-14")]).n, 0);
  assert.equal(windowStats([stale], "2026-10-01", "2026-10-01").ig.n, 0);
  assert.equal(windowStats([stale], "2026-10-01", "2026-10-01").yt.n, 0);
  stale.instagram.updatedAt = "2026-10-02T15:00:00Z"; // 10-03 JST
  assert.equal(metricObservation(stale, "ig").ageDays, 2);
  assert.equal(rankBySaved([videoRow(stale, "2026-10-14")]).n, 1);
  for (const timestamp of [null, "invalid", "2026-10-03", "2026-09-30T01:00:00Z"]) {
    stale.instagram.updatedAt = timestamp;
    assert.equal(windowStats([stale], "2026-10-01", "2026-10-01").ig.n, 0);
  }
});

test("missing reach does not inflate grouped save rates or sort as a measured zero rate", () => {
  const rows = [
    video("2026-10-01", { ig: { views: 10, saved: 1, reach: null }, content: recipe("a", "v60") }),
    video("2026-10-02", { ig: { views: 10, saved: 1, reach: 100 }, content: recipe("b", "v60") }),
  ].map((v) => videoRow(v, "2026-10-14"));
  assert.equal(groupBySaved(rows, (r) => r.method)[0].saveRate, null);
  assert.equal(groupBySaved(rows, (r) => r.method)[0].savedSum, 2);
  assert.equal(rankBySaved(rows).worst[0].date, "2026-10-02");
});

test("October 13/14 regression: missing failed-day ledger is unknown; the next published episode is unmeasured", () => {
  const oct14 = video("2026-10-14", { yt: null, ig: { views: null, saved: null }, content: recipe("雑味が減る", "origami", "pour") });
  oct14.videoId = "Gsze2fFKMfU";
  oct14.instagram.mediaId = "18117213236118268";
  oct14.instagram.updatedAt = null;
  const summary = summarize({ videos: [video("2026-10-12"), oct14] }, { today: "2026-10-14", days: 2 });
  assert.deepEqual(summary.missingDates, ["2026-10-13"]);
  assert.equal(summary.rows.some((r) => r.date === "2026-10-13"), false);
  assert.equal(summary.evidenceRows.find((r) => r.date === "2026-10-14").observation.ig.status, "unmeasured");
  const out = renderMarkdown(summary);
  assert.match(out, /2026-10-14 \| 公開済み \/ 18117213236118268 \| 計測未取得 \| 公開済み \/ Gsze2fFKMfU \| 計測未取得/);
  assert.match(out, /台帳にない日（投稿状態不明。未投稿と断定せず実行証跡を照合）: 2026-10-13/);
  assert.match(out, /正確な公開後時間ではない/);
  assert.match(out, /同条件の観測値が揃うまで保留/);
  const unknown = { ...oct14, date: "2026-10-11", videoId: null, instagram: null };
  const dry = { ...unknown, date: "2026-10-10", dryRun: true };
  const unpublished = { ...unknown, date: "2026-10-09", publication: { ig: { status: "not-posted" }, yt: { status: "not-posted" } } };
  const states = renderMarkdown(summarize({ videos: [unknown, dry, unpublished] }, { today: "2026-10-14" }));
  assert.match(states, /投稿状態不明 \| 対象外/);
  assert.match(states, /dry run（未投稿） \| 対象外/);
  assert.match(states, /未投稿（証跡確認済み） \| 対象外/);
  assert.match(states, /保存合計 —/);
  assert.doesNotMatch(states, /\| null \|/);
});

test("verdict thresholds are applied top to bottom and need n ≥ 7", () => {
  const stats = (igMedian, saved, ytMedian, n = 7) => ({
    ig: { n, viewsMedian: igMedian, savedSum: saved },
    yt: { n, viewsMedian: ytMedian },
  });
  assert.equal(verdict("ig", stats(5, 0, 0, 6)), "判定保留");
  assert.equal(verdict("ig", stats(9, 4, 0)), "配信死亡");
  assert.equal(verdict("ig", stats(9, 5, 0)), "続行");
  assert.equal(verdict("ig", stats(49, 0, 0)), "切替候補");
  assert.equal(verdict("ig", stats(50, 0, 0)), "続行");
  assert.equal(verdict("yt", stats(0, 0, 4)), "配信死亡");
  assert.equal(verdict("yt", stats(0, 0, 19)), "切替候補");
  assert.equal(verdict("yt", stats(0, 0, 20)), "続行");
});

test("cycle matches the genre-experiment worked example (S = 2026-09-14)", () => {
  const S = "2026-09-14";
  const F = "2026-04-20";
  assert.equal(cycle({ S, F, today: "2026-09-13" }).status, "未開始");
  const d0 = cycle({ S, F, today: "2026-09-14" });
  assert.deepEqual([d0.status, d0.from, d0.to, d0.next], ["Day 1 / 14", "2026-09-01", "2026-09-14", "2026-09-28"]);
  const d1 = cycle({ S, F, today: "2026-09-15" });
  assert.deepEqual([d1.status, d1.from, d1.to, d1.next], ["Day 2 / 14", "2026-09-02", "2026-09-15", "2026-09-28"]);
  const j = cycle({ S, F, today: "2026-09-28" });
  assert.deepEqual([j.status, j.isJudgeDay, j.from, j.to, j.next], ["判定日", true, "2026-09-14", "2026-09-27", "2026-10-12"]);
  const after = cycle({ S, F, today: "2026-09-29" });
  assert.deepEqual([after.status, after.next, after.lastJudge], ["Day 2 / 14", "2026-10-12", "2026-09-28"]);
  // a new type: F = S caps the window at the first post
  const t1 = cycle({ S: "2026-09-15", F: "2026-09-15", today: "2026-09-17" });
  assert.deepEqual([t1.status, t1.from, t1.to, t1.next], ["Day 3 / 14", "2026-09-15", "2026-09-17", "2026-09-29"]);
});

test("mode: parsed from the previous report, carried over, changed only on judgement days", () => {
  const md = report("2026-09-16", "**配信死亡モード**（2026-09-14〜）", "通常").text;
  assert.deepEqual(parseStatusModes(md), { ig: "配信死亡モード（2026-09-14〜）", yt: "通常" });
  assert.equal(parseStatusModes("# old report without the section"), null);

  const prev = previousModes([report("2026-09-10", "通常", "通常"), report("2026-09-16", "切替候補", "通常")], "2026-09-17");
  assert.deepEqual([prev.source, prev.ig, prev.yt], ["docs/pdca/2026-09-16.md", "切替候補", "通常"]);
  const intro = previousModes([{ date: "2026-09-14", text: "# no table" }], "2026-09-15");
  assert.deepEqual([intro.ig, intro.yt], ["配信死亡モード（2026-09-14〜）", "配信死亡モード（2026-09-14〜）"]);

  assert.equal(decideMode("配信死亡", "配信死亡モード（2026-09-14〜）", "2026-09-29"), "配信死亡モード（2026-09-14〜）");
  assert.equal(decideMode("配信死亡", "通常", "2026-09-29"), "配信死亡モード（2026-09-29〜）");
  assert.equal(decideMode("切替候補", "通常", "2026-09-29"), "切替候補");
  assert.equal(decideMode("続行", "配信死亡モード（2026-09-14〜）", "2026-09-29"), "通常");
  assert.equal(decideMode("判定保留", "切替候補", "2026-09-29"), "切替候補");
});

test("mode §d-1: reports without a readable status table are skipped, per account", () => {
  const stub = { date: "2026-09-12", text: "# PDCA レポート — 2026-09-12\n\n- ジャンル試行: 未導入\n- ルーチン失敗" };
  const prev = previousModes([report("2026-09-10", "切替候補", "通常"), stub], "2026-09-13");
  assert.deepEqual([prev.source, prev.ig, prev.yt], ["docs/pdca/2026-09-10.md", "切替候補", "通常"]);

  const ytUnreadable = report("2026-09-11", "通常", "判読不能");
  const mixed = previousModes([report("2026-09-10", "切替候補", "切替候補"), ytUnreadable, stub], "2026-09-13");
  assert.deepEqual([mixed.ig, mixed.yt], ["通常", "切替候補"]);
  assert.equal(mixed.source, "IG = docs/pdca/2026-09-11.md / YT = docs/pdca/2026-09-10.md");

  // The carried-over mode survives a failed day instead of resetting to the intro verdict.
  const s = trialStatus({ videos: [] }, "2026-09-16", {
    reports: [report("2026-09-14", "通常", "通常"), { date: "2026-09-15", text: "# no table" }],
  });
  assert.deepEqual([s.accounts.ig.mode, s.accounts.yt.mode, s.prevSource], ["通常", "通常", "docs/pdca/2026-09-14.md"]);
});

test("policy: the alive account with n < 7 falls back to rotation; trial #2 before its first post is 準備中", () => {
  const reports = [report("2026-09-17", "配信死亡モード（2026-09-14〜）", "通常")];
  const few = ["2026-09-15", "2026-09-16", "2026-09-17"].map((d) => video(d, { yt: 30 }));
  const out = renderMarkdown(summarize({ videos: few }, { today: "2026-09-18", reports }));
  assert.match(out, /性能データで選ばない（IG @open_ground_coffee_roasters は配信死亡モード、YT OPEN GROUND coffee roasters は判定窓の n=3 < 7）/);
  assert.match(out, /- IG \/ YT 共通: 準備中: 試行 #2/);

  const enough = Array.from({ length: 8 }, (_, i) => video(addDays("2026-09-10", i), { yt: 30 }));
  const out2 = renderMarkdown(summarize({ videos: enough }, { today: "2026-09-18", reports }));
  assert.match(out2, /今日の柱・抽出法の方針: YT OPEN GROUND coffee roasters の指標だけで選ぶ/);
});

test("trial #2 starts at the first brewing-lesson post and is judged on S + 14 with the carried-over mode", () => {
  const videos = [video("2026-09-14")];
  for (let i = 0; i < 16; i++) {
    videos.push(video(addDays("2026-09-15", i), { ig: { views: 60, reach: 40, saved: 1 }, yt: 3, content: recipe("b", "v60") }));
  }
  const history = { videos };

  const before = trialStatus(history, "2026-09-14", { reports: [] });
  assert.equal(before.trial, 0);

  const mid = trialStatus(history, "2026-09-21", { reports: [] });
  assert.deepEqual([mid.trial, mid.S, mid.F, mid.cycle.status, mid.cycle.next], [2, "2026-09-15", "2026-09-15", "Day 7 / 14", "2026-09-29"]);
  assert.equal(mid.accounts.ig.mode, "配信死亡モード（2026-09-14〜）", "a new trial inherits the previous mode");
  assert.equal(mid.judge, null);
  assert.equal(mid.baseline.to, "2026-09-14");

  const judge = trialStatus(history, "2026-09-29", { reports: [] });
  assert.equal(judge.cycle.isJudgeDay, true);
  assert.deepEqual([judge.stats.from, judge.stats.to, judge.stats.ig.n, judge.stats.ig.savedSum], ["2026-09-15", "2026-09-28", 14, 14]);
  assert.equal(judge.accounts.ig.judgeVerdict, "続行");
  assert.equal(judge.accounts.ig.mode, "通常");
  assert.equal(judge.accounts.yt.judgeVerdict, "配信死亡");
  assert.equal(judge.accounts.yt.mode, "配信死亡モード（2026-09-14〜）");

  // the day after: no judgement recorded in reports → delayed judgement for 09-29
  const late = trialStatus(history, "2026-09-30", { reports: [report("2026-09-29", "通常", "通常")] });
  assert.equal(late.judge.delayed, true);
  assert.equal(late.judge.date, "2026-09-29");
  const recorded = trialStatus(history, "2026-09-30", {
    reports: [report("2026-09-29", "通常", "配信死亡モード（2026-09-14〜）", "## ジャンル判定\n- IG: 続行")],
  });
  assert.equal(recorded.judge, null);
  assert.equal(recorded.accounts.ig.mode, "通常");
  assert.equal(hasJudgementOnOrAfter([report("2026-09-29", "通常", "通常", "## ジャンル判定")], "2026-09-29"), true);
});

test("caution when today's numbers are in the dead zone but the mode is not", () => {
  const videos = [];
  for (let i = 0; i < 10; i++) {
    videos.push(video(addDays("2026-09-15", i), { ig: { views: 1, reach: 1, saved: 0 }, yt: 0, content: recipe("b", "v60") }));
  }
  const s = trialStatus({ videos }, "2026-09-26", { reports: [report("2026-09-25", "通常", "通常")] });
  assert.equal(s.accounts.ig.mode, "通常");
  assert.equal(s.accounts.ig.caution, true);
  assert.match(renderMarkdown(summarize({ videos }, { today: "2026-09-26", reports: [report("2026-09-25", "通常", "通常")] })), /注意: IG @open_ground_coffee_roasters は判定窓で配信死亡の域/);
});

test("rankings use IG saves from the type's first post on, skip provisional days and missing IG values", () => {
  const history = {
    videos: [
      video("2026-09-14", { ig: { views: 500, reach: 400, saved: 50 } }), // legacy news, before F
      video("2026-09-15", { ig: { views: 50, reach: 40, saved: 1 }, content: recipe("a", "v60") }),
      video("2026-09-16", { ig: { views: 5, reach: 5, saved: 3 }, content: recipe("b", "aeropress") }),
      video("2026-09-17", { ig: { views: 90, reach: 80, saved: 0 }, content: recipe("a", "v60") }),
      video("2026-09-18", { ig: null, content: recipe("c", "v60") }),
      video("2026-09-19", { ig: { views: 99, reach: 90, saved: 9 }, content: recipe("c", "v60") }), // provisional
    ],
  };
  const rows = recentRows(history, "2026-09-20", 14, 2);
  assert.equal(rows[0].date, "2026-09-19");
  assert.equal(rows[0].provisional, true);
  assert.equal(rows.find((r) => r.date === "2026-09-17").provisional, false);

  const s = summarize(history, { today: "2026-09-20" });
  assert.equal(s.status.F, "2026-09-15");
  assert.deepEqual(s.ranking.top.map((r) => r.date), ["2026-09-16", "2026-09-15", "2026-09-17"]);
  assert.equal(s.ranking.worst[0].date, "2026-09-17");
  assert.deepEqual(s.byMethod.map((g) => [g.key, g.n, g.savedSum]), [
    ["エアロプレス", 1, 3],
    ["V60", 2, 1],
  ]);
  assert.equal(rankBySaved(rows).n, 4, "without the F filter the legacy post would be compared too");
  assert.equal(groupBySaved(rows, (r) => r.format).length, 2);
});

test("rotation lists the unused pillars and methods first", () => {
  const rows = [
    { pillar: "湯温", method: "V60", publication: { yt: "published" } },
    { pillar: "湯温", method: "V60", publication: { yt: "published" } },
  ];
  const r = rotation(rows);
  assert.equal(r.pillar.at(-1).key, "湯温");
  assert.equal(r.pillar.at(-1).n, 2);
  assert.equal(r.pillar[0].n, 0);
  assert.equal(r.method.at(-1).key, "V60");
  assert.equal(r.pillar.length, Object.keys(PILLARS).length);
});

test("retired formats keep their own label — a recipe post is not a news post", () => {
  const legacyRecipe = video("2026-09-19", {
    content: { format: "recipe", trial: "coffee-trial-1-recipe-card", fallback: false, beanName: "b", method: "v60" },
  });
  legacyRecipe.title = "【今日の一杯】ブルンジ マバンザ×V60｜豆15g #Shorts";
  const r = videoRow(legacyRecipe, "2026-09-23");
  assert.equal(r.format, "レシピ（旧）");
  assert.match(rowTopic(r), /^旧レシピ「ブルンジ マバンザ×V60」$/);

  // ...and its fallback was the house recipe, not the evergreen pack
  const fellBack = videoRow({ ...legacyRecipe, content: { ...legacyRecipe.content, fallback: true } }, "2026-09-23");
  assert.match(rowTopic(fellBack), /［標準レシピ］$/);
  assert.ok(!rowTopic(fellBack).includes("常備"));

  const news = videoRow(
    { ...legacyRecipe, content: { format: "news-top5", trial: "x", fallback: false } },
    "2026-09-23"
  );
  assert.equal(news.format, "ニュースTOP5（旧）");
  assert.match(rowTopic(news), /^旧ニュースTOP5「/);

  // the current format still reads as itself
  const lesson = videoRow(video("2026-09-23", { content: recipe("苦味が引いて酸が立つ", "v60") }), "2026-09-23");
  assert.equal(lesson.format, "抽出メモ");
  assert.match(rowTopic(lesson), /^湯温「苦味が引いて酸が立つ」×V60$/);
  assert.match(
    rowTopic(videoRow(video("2026-09-23", { content: { ...recipe("x", "v60"), fallback: true } }), "2026-09-23")),
    /［常備ネタ］$/
  );
});

test("trial #2 starts at the first brewing lesson, not at a legacy recipe post; 直近 14 日 = today − 14..today − 1", () => {
  const legacy = { format: "recipe", trial: "coffee-trial-1-recipe-card", fallback: false, beanId: "x" };
  const videos = [
    video("2026-09-20", { content: legacy }),
    video("2026-09-21"),
    video("2026-09-22"),
  ];
  assert.equal(trialStart(videos), null, "the cancelled recipe-card type does not start trial #2");
  assert.equal(trialStatus({ videos }, "2026-09-23").trial, 0);
  videos.push(video("2026-09-23", { content: recipe("a", "v60") }));
  assert.equal(trialStart(videos), "2026-09-23");

  const rows = recentRows({ videos: [video("2026-09-09"), video("2026-09-10"), video("2026-09-23"), video("2026-09-24")] }, "2026-09-24", 14, 2);
  assert.deepEqual(rows.map((row) => row.date), ["2026-09-23", "2026-09-10"]);
});

test("markdown: status section first in the shared format, dead-mode policy, IG saves primary", () => {
  const history = { videos: [video("2026-09-15", { ig: { views: 7, reach: 6, saved: 2 }, content: recipe("a", "v60") })] };
  const out = renderMarkdown(summarize(history, { today: "2026-09-17", reports: [] }));
  assert.ok(out.startsWith("## ジャンル試行の状態"));
  assert.match(out, /\| アカウント \| 試行 # \| 開始日 \| 経過日 \| 判定窓 \(n\) \| 判定指標の現在値 \| モード \| 次の判定日 \|/);
  assert.match(out, /\| IG @open_ground_coffee_roasters \| #2 \| 2026-09-15 \| Day 3 \/ 14 \| 09-15\.\.09-17 \(n=1\) \| views 中央値 7 \/ 保存合計 2 \| 配信死亡モード（2026-09-14〜） \| 2026-09-29 \|/);
  assert.match(out, /性能データで選ばない（2 アカウントとも配信死亡モード）/);
  assert.match(out, /実行中: 試行 #2/);
  assert.match(out, /\| \*\*IG 保存\*\* \|/);
  assert.match(out, /## ローテーション/);
});

test("real history file: summary renders without throwing (values change daily, so nothing is pinned)", () => {
  const history = JSON.parse(readFileSync(join(rootDir, "data", "performance-history.json"), "utf-8"));
  const out = renderMarkdown(summarize(history, { today: "2026-09-14", reports: [] }));
  assert.match(out, /\| IG @open_ground_coffee_roasters \| #0 \| 2026-09-14 \| Day 1 \/ 14 \| 09-01\.\.09-14/);
  assert.match(out, /\| YT OPEN GROUND coffee roasters \|/);
});
