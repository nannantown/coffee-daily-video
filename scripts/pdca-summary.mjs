/**
 * PDCA numbers for the morning routine — primary metric: Instagram saves.
 *
 * Reads data/performance-history.json (IG values come from fetch-stats.mjs →
 * instagram-insights.mjs: `instagram.saved` / `views` / `reach` / `shares`)
 * and prints Markdown the routine pastes into docs/pdca/YYYY-MM-DD.md:
 *
 *   1. ジャンル試行の状態 — the sns-hub genre-experiment common section
 *      (window / median / saved-sum definitions identical to its jq command)
 *   2. 直近 N 日の投稿 — per-video IG saves first, YT views last
 *   3. TOP 3 / WORST 3 by IG saves (provisional days excluded)
 *   4. 軸別 — IG saves by 抽出法 / 豆 / 切り口 / 型
 *
 * Usage:
 *   node scripts/pdca-summary.mjs                    # today (JST), 14 days
 *   node scripts/pdca-summary.mjs --today=2026-09-29 --days=14 --json
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { METHODS, ANGLES, TRIAL_ID, jstDateParts } from "./content-format.mjs";

export const ACCOUNTS = {
  ig: "IG @open_ground_coffee_roasters",
  yt: "YT @MindBrewLab",
};

export const TRIALS = {
  0: { label: "#0", genre: "平日コーヒーニュース + 週末エバーグリーン / テンプレタイトル", start: "2026-04-19", firstJudge: "2026-09-14" },
  1: { label: "#1", genre: "「今日の一杯」レシピカード型（豆×抽出法×数値×味×コツ）+ 日曜ニュース TOP5", trialId: TRIAL_ID, plannedStart: "2026-09-15" },
};

// sns-hub docs/strategy/genre-experiment.md (c) — initial values (2026-09-14)
export const THRESHOLDS = {
  minN: 7,
  ig: { deadViewsMedian: 10, switchViewsMedian: 50, savedSum: 5 },
  yt: { deadViewsMedian: 5, switchViewsMedian: 20 },
};

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** IG metrics or null when the video has no matched IG media / no insights yet. */
export function igMetrics(video) {
  const ig = video?.instagram;
  if (!ig || ig.views == null) return null;
  return {
    views: ig.views,
    reach: ig.reach ?? null,
    saved: ig.saved ?? 0,
    shares: ig.shares ?? null,
    likes: ig.likes ?? null,
  };
}

export function ytViews(video) {
  if (!video?.stats || video.stats.updatedAt == null) return null;
  return video.stats.views ?? 0;
}

export function windowStats(videos, from, to) {
  const v = videos.filter((x) => x.date >= from && x.date <= to);
  const yt = v.map(ytViews).filter((x) => x != null);
  const ig = v.map(igMetrics).filter(Boolean);
  return {
    from,
    to,
    posts: v.length,
    yt: { n: yt.length, viewsMedian: median(yt) },
    ig: {
      n: ig.length,
      viewsMedian: median(ig.map((m) => m.views)),
      savedSum: ig.reduce((sum, m) => sum + (m.saved || 0), 0),
    },
  };
}

/** Metric-only verdict, rows applied top to bottom (配信死亡 → 切替候補 → 続行). */
export function verdict(platform, stats) {
  const t = THRESHOLDS;
  if (platform === "ig") {
    if (stats.ig.n < t.minN) return "判定保留（データ不足）";
    if (stats.ig.viewsMedian < t.ig.deadViewsMedian && stats.ig.savedSum < t.ig.savedSum) return "配信死亡";
    if (stats.ig.viewsMedian < t.ig.switchViewsMedian && stats.ig.savedSum < t.ig.savedSum) return "切替候補";
    return "続行";
  }
  if (stats.yt.n < t.minN) return "判定保留（データ不足）";
  if (stats.yt.viewsMedian < t.yt.deadViewsMedian) return "配信死亡";
  if (stats.yt.viewsMedian < t.yt.switchViewsMedian) return "切替候補";
  return "続行";
}

export function trialStart(videos, trialId = TRIAL_ID) {
  const dates = videos.filter((v) => v.content?.trial === trialId).map((v) => v.date).sort();
  return dates[0] || null;
}

export function trialStatus(history, today) {
  const videos = history?.videos || [];
  const start = trialStart(videos);
  if (start) {
    const judgeDate = addDays(start, 14);
    const to = [today, addDays(start, 13)].sort()[0];
    const stats = windowStats(videos, start, to);
    const baseline = windowStats(videos, addDays(start, -14), addDays(start, -1));
    return {
      trial: 1,
      started: true,
      start,
      day: daysBetween(start, today) + 1,
      judgeDate,
      isJudgeDay: today >= judgeDate,
      stats,
      baseline,
    };
  }
  // Trial #1 not posted yet → trial #0 rolling window (today − 13 .. today)
  let judgeDate = TRIALS[0].firstJudge;
  while (judgeDate < today) judgeDate = addDays(judgeDate, 14);
  const stats = windowStats(videos, addDays(today, -13), today);
  return {
    trial: 0,
    started: false,
    start: TRIALS[0].start,
    day: 14 - daysBetween(today, judgeDate),
    judgeDate,
    isJudgeDay: today === judgeDate,
    stats,
    baseline: null,
  };
}

function suggestedMode(platform, status) {
  const v = verdict(platform, status.stats);
  if (v === "配信死亡") return "配信死亡モード（宣言条件を満たす）";
  if (v === "切替候補" && status.isJudgeDay) return "切替候補";
  if (v === "判定保留（データ不足）") return "通常（n<7）";
  return "通常";
}

const FORMAT_LABELS = { recipe: "レシピ", "news-top5": "ニュースTOP5" };

export function videoRow(video, today, provisionalDays = 2) {
  const ig = igMetrics(video);
  const c = video.content || null;
  const format = c?.format ? FORMAT_LABELS[c.format] || c.format : "ニュース（旧型）";
  return {
    date: video.date,
    format,
    bean: c?.beanName || "—",
    beanId: c?.beanId || null,
    method: c?.method ? METHODS[c.method]?.label || c.method : "—",
    angle: c?.angle ? ANGLES[c.angle] || c.angle : "—",
    fallback: Boolean(c?.fallback),
    ig,
    saveRate: ig && ig.reach ? (ig.saved / ig.reach) * 100 : null,
    yt: ytViews(video),
    provisional: video.date > addDays(today, -1 - provisionalDays),
    title: video.title || "",
  };
}

export function recentRows(history, today, days = 14, provisionalDays = 2) {
  const from = addDays(today, -(days - 1));
  return (history?.videos || [])
    .filter((v) => v.date >= from && v.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((v) => videoRow(v, today, provisionalDays));
}

function comparable(rows) {
  return rows.filter((r) => r.ig && !r.provisional);
}

export function rankBySaved(rows, n = 3) {
  const pool = comparable(rows);
  const top = [...pool]
    .sort((a, b) => b.ig.saved - a.ig.saved || (b.saveRate ?? 0) - (a.saveRate ?? 0) || b.ig.views - a.ig.views)
    .slice(0, n);
  const worst = [...pool]
    .sort((a, b) => a.ig.saved - b.ig.saved || (a.saveRate ?? 0) - (b.saveRate ?? 0) || a.ig.views - b.ig.views)
    .slice(0, n);
  return { top, worst, n: pool.length };
}

export function groupBySaved(rows, keyFn) {
  const groups = new Map();
  for (const r of comparable(rows)) {
    const key = keyFn(r);
    if (!key || key === "—") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const reach = list.reduce((s, r) => s + (r.ig.reach || 0), 0);
      const saved = list.reduce((s, r) => s + r.ig.saved, 0);
      return {
        key,
        n: list.length,
        savedSum: saved,
        savedAvg: saved / list.length,
        saveRate: reach ? (saved / reach) * 100 : null,
        viewsMedian: median(list.map((r) => r.ig.views)),
      };
    })
    .sort((a, b) => b.savedAvg - a.savedAvg || b.n - a.n);
}

export function summarize(history, { today, days = 14, provisionalDays = 2 } = {}) {
  const rows = recentRows(history, today, days, provisionalDays);
  return {
    today,
    days,
    provisionalDays,
    status: trialStatus(history, today),
    rows,
    ranking: rankBySaved(rows),
    byMethod: groupBySaved(rows, (r) => r.method),
    byBean: groupBySaved(rows, (r) => r.bean),
    byAngle: groupBySaved(rows, (r) => r.angle),
    byFormat: groupBySaved(rows, (r) => r.format),
  };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const fmt = (v, digits = 1) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(digits));
const md = (s) => String(s).replace(/\|/g, "／");
const mmdd = (iso) => iso.slice(5);

function statusSection(s) {
  const t = TRIALS[s.trial];
  const window = `${mmdd(s.stats.from)}..${mmdd(s.stats.to)}`;
  const startLabel = s.trial === 1 ? s.start : `${s.start}（運用開始）`;
  const dayLabel = s.trial === 1 ? `Day ${s.day} / 14` : `Day ${s.day} / 14（ローリング）`;
  const lines = [
    "## ジャンル試行の状態",
    "",
    "| アカウント | 試行 # | ジャンル / 型 | 開始日 | 経過日 | 判定窓 | IG views 中央値 | IG 保存合計 | YT views 中央値 | モード | 次の判定日 |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    `| ${ACCOUNTS.ig} | ${t.label} | ${t.genre} | ${startLabel} | ${dayLabel} | ${window} (n=${s.stats.ig.n}) | ${fmt(s.stats.ig.viewsMedian)} | ${s.stats.ig.savedSum} | — | ${suggestedMode("ig", s)} | ${s.judgeDate} |`,
    `| ${ACCOUNTS.yt} | ${t.label} | ${t.genre} | ${startLabel} | ${dayLabel} | ${window} (n=${s.stats.yt.n}) | — | — | ${fmt(s.stats.yt.viewsMedian)} | ${suggestedMode("yt", s)} | ${s.judgeDate} |`,
    "",
    `- 指標判定（${THRESHOLDS.minN} 本未満は判定保留）: IG = ${verdict("ig", s.stats)} / YT = ${verdict("yt", s.stats)}${s.isJudgeDay ? "（**今日は判定日** →「ジャンル判定」節を書く）" : "（判定日ではない）"}`,
  ];
  if (s.trial === 0) {
    lines.push(`- 試行 #1（レシピカード型）はまだ初回投稿がない（予定開始日 ${TRIALS[1].plannedStart}）。初回投稿の翌朝から #1 の窓で集計する`);
  }
  if (s.baseline) {
    lines.push(
      `- 比較用ベースライン（試行 #0 の最後の 14 日 ${mmdd(s.baseline.from)}..${mmdd(s.baseline.to)}）: IG views 中央値 ${fmt(s.baseline.ig.viewsMedian)} / IG 保存合計 ${s.baseline.ig.savedSum} (n=${s.baseline.ig.n}) / YT views 中央値 ${fmt(s.baseline.yt.viewsMedian)} (n=${s.baseline.yt.n})`
    );
  }
  return lines;
}

export function rowTopic(r) {
  if (r.format === "レシピ") return `レシピ ${r.bean}×${r.method}（${r.angle}）${r.fallback ? "［代替］" : ""}`;
  if (r.format === "ニュース（旧型）") {
    const t = r.title.replace(/^【[^】]*】/, "").replace(/｜.*$/, "");
    return `旧型ニュース「${Array.from(t).slice(0, 28).join("")}」`;
  }
  return r.format;
}

function rowLine(r) {
  const ig = r.ig;
  const mark = r.provisional ? "（暫定）" : "";
  return `| ${r.date}${mark} | ${r.format}${r.fallback ? "（代替）" : ""} | ${md(r.bean)} | ${md(r.method)} | ${md(r.angle)} | ${ig ? ig.saved : "—"} | ${fmt(r.saveRate)} | ${ig ? ig.views : "—"} | ${ig?.reach ?? "—"} | ${ig?.shares ?? "—"} | ${r.yt ?? "—"} |`;
}

function groupTable(title, groups) {
  if (!groups.length) return [`### ${title}`, "", "（比較できるデータなし）", ""];
  return [
    `### ${title}`,
    "",
    "| 値 | 本数 | IG 保存 平均 | IG 保存 合計 | 保存率(%) | IG views 中央値 |",
    "|---|---|---|---|---|---|",
    ...groups.map((g) => `| ${md(g.key)} | ${g.n} | ${fmt(g.savedAvg, 2)} | ${g.savedSum} | ${fmt(g.saveRate, 2)} | ${fmt(g.viewsMedian)} |`),
    "",
  ];
}

export function renderMarkdown(summary) {
  const s = summary;
  const lines = [
    ...statusSection(s.status),
    "",
    `## 直近 ${s.days} 日の投稿（主指標: IG 保存数）`,
    "",
    "| 日付 | 型 | 豆 | 抽出法 | 切り口 | **IG 保存** | 保存率(%) | IG views | IG reach | IG shares | YT views |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...s.rows.map(rowLine),
    "",
    `- 保存率 = IG 保存 ÷ IG reach。「（暫定）」は ${mmdd(addDays(s.today, -s.provisionalDays))} 以降の回（IG insights は最大 48h 遅れ、朝の時点では未確定。TOP/WORST と軸別から除外）。「—」は未取得`,
    "",
    `## TOP 3 / WORST 3（IG 保存数。同数は保存率 → views の順）`,
    "",
  ];
  if (s.ranking.n === 0) {
    lines.push("（比較できる確定値がまだない）", "");
  } else {
    const rankLine = (r, i) =>
      `${i + 1}. ${r.date} ${rowTopic(r)} — 保存 ${r.ig.saved} / 保存率 ${fmt(r.saveRate)}% / views ${r.ig.views}`;
    lines.push("**TOP 3**", ...s.ranking.top.map(rankLine), "", "**WORST 3**", ...s.ranking.worst.map(rankLine), "");
  }
  lines.push(
    "## 軸別の IG 保存数",
    "",
    ...groupTable("抽出法", s.byMethod),
    ...groupTable("豆", s.byBean),
    ...groupTable("切り口", s.byAngle),
    ...groupTable("型", s.byFormat)
  );
  return lines.join("\n");
}

function main() {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const today = arg("today") || jstDateParts().iso;
  const days = Number(arg("days") || 14);
  const historyPath = arg("history") || join(rootDir, "data", "performance-history.json");
  const history = JSON.parse(readFileSync(historyPath, "utf-8"));
  const summary = summarize(history, { today, days });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(renderMarkdown(summary));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
