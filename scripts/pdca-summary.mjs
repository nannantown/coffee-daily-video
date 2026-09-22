/**
 * PDCA numbers for the morning routine — primary metric: Instagram saves.
 *
 * Reads data/performance-history.json (IG values come from fetch-stats.mjs →
 * instagram-insights.mjs: `instagram.saved` / `views` / `reach` / `shares`),
 * the previous docs/pdca report (for the carried-over mode), then prints
 * Markdown for docs/pdca/YYYY-MM-DD.md:
 *
 *   1. ジャンル試行の状態 — sns-hub docs/strategy/genre-experiment.md format:
 *      S / F, judgement days S + 14k, window, Day N / 14, n < 7 hold,
 *      thresholds applied top to bottom, mode carried over except on
 *      judgement (or delayed judgement) days
 *   2. ジャンル判定（下書き）— only on judgement / delayed-judgement days
 *   3. 直近 N 日の投稿 — per-video IG saves first, YT views last
 *   4. TOP 3 / WORST 3 by IG saves (type's first post F onward, provisional days excluded)
 *   5. 軸別 — IG saves by 抽出法 / 柱 / 型
 *   6. ローテーション — usage counts (for days when performance data must not decide)
 *
 * Usage:
 *   node scripts/pdca-summary.mjs                    # today (JST), 14 days
 *   node scripts/pdca-summary.mjs --today=2026-09-29 --days=14 --json
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { METHODS, PILLARS, TRIAL_ID, jstDateParts } from "./content-format.mjs";

export const ACCOUNTS = {
  ig: "IG @open_ground_coffee_roasters",
  yt: "YT OPEN GROUND coffee roasters",
};

export const TRIALS = {
  0: {
    label: "#0",
    genre: "平日コーヒーニュース + 週末エバーグリーン",
    S: "2026-09-14",
    F: "2026-04-20",
    // ledger "導入時（2026-09-14）の判定" — both accounts
    introMode: "配信死亡モード（2026-09-14〜）",
  },
  1: {
    label: "#1",
    genre: "「今日の一杯」レシピカード型（2026-09-22 オーナー決定により中止）",
    trialId: "coffee-trial-1-recipe-card",
    cancelled: true,
  },
  2: {
    label: "#2",
    genre: "汎用抽出知識「今日の抽出メモ」（集客フェーズ）",
    trialId: TRIAL_ID,
    plannedStart: "2026-09-23",
  },
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
    if (stats.ig.n < t.minN) return "判定保留";
    if (stats.ig.viewsMedian < t.ig.deadViewsMedian && stats.ig.savedSum < t.ig.savedSum) return "配信死亡";
    if (stats.ig.viewsMedian < t.ig.switchViewsMedian && stats.ig.savedSum < t.ig.savedSum) return "切替候補";
    return "続行";
  }
  if (stats.yt.n < t.minN) return "判定保留";
  if (stats.yt.viewsMedian < t.yt.deadViewsMedian) return "配信死亡";
  if (stats.yt.viewsMedian < t.yt.switchViewsMedian) return "切替候補";
  return "続行";
}

/**
 * Judgement cycle (genre-experiment.md): d = today − S.
 *   d < 0                      → 未開始
 *   d ≥ 14 and d % 14 === 0    → 判定日, window (today−14)..(today−1), next today+14
 *   otherwise                  → Day (d mod 14 + 1) / 14, window max(F, today−13)..today, next S + 14·(⌊d/14⌋+1)
 */
export function cycle({ S, F, today }) {
  const d = daysBetween(S, today);
  if (d < 0) return { d, status: "未開始", isJudgeDay: false, from: null, to: null, next: S, lastJudge: null };
  if (d >= 14 && d % 14 === 0) {
    return { d, status: "判定日", isJudgeDay: true, from: addDays(today, -14), to: addDays(today, -1), next: addDays(today, 14), lastJudge: today };
  }
  const from = [F, addDays(today, -13)].sort()[1];
  return {
    d,
    status: `Day ${(d % 14) + 1} / 14`,
    isJudgeDay: false,
    from,
    to: today,
    next: addDays(S, 14 * (Math.floor(d / 14) + 1)),
    lastJudge: d >= 14 ? addDays(S, 14 * Math.floor(d / 14)) : null,
  };
}

/**
 * Trial #2 starts at its first brewing-lesson post — the day the generic
 * brewing knowledge type first went out (owner decision 2026-09-22).
 */
export function trialStart(videos, trialId = TRIAL_ID) {
  const dates = videos
    .filter((v) => v.content?.trial === trialId && v.content?.format === "brew-lesson")
    .map((v) => v.date)
    .sort();
  return dates[0] || null;
}

// ---------------------------------------------------------------------------
// Mode carry-over from the previous report
// ---------------------------------------------------------------------------

const cleanCell = (s) => String(s ?? "").replace(/\*\*/g, "").trim();

/** Mode column of the IG / YT rows in a report's 「ジャンル試行の状態」 table. */
export function parseStatusModes(markdown) {
  const text = String(markdown ?? "");
  const start = text.indexOf("## ジャンル試行の状態");
  if (start === -1) return null;
  const section = text.slice(start).split(/\n## /)[0];
  const modes = {};
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map(cleanCell);
    // ["", アカウント, 試行 #, 開始日, 経過日, 判定窓 (n), 判定指標の現在値, モード, 次の判定日, ""]
    if (cells.length < 9) continue;
    const mode = cells[7];
    if (!/通常|切替候補|配信死亡モード/.test(mode)) continue;
    if (cells[1].startsWith("IG")) modes.ig = mode;
    if (cells[1].startsWith("YT")) modes.yt = mode;
  }
  return modes.ig || modes.yt ? modes : null;
}

/**
 * reports: [{ date: "YYYY-MM-DD", text }]
 * Genre rule §d-1: the previous mode comes from the latest report before today
 * whose status table has a readable mode for that account. Reports without it
 * (routine failures, "未導入" stubs, a missing row) are skipped, and only when
 * none is left does the ledger's intro verdict apply.
 */
export function previousModes(reports, today) {
  const intro = TRIALS[0].introMode;
  const parsed = reports
    .filter((r) => r.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => ({ date: r.date, modes: parseStatusModes(r.text) || {} }));
  const latest = (platform) => parsed.find((r) => r.modes[platform]) || null;
  const ig = latest("ig");
  const yt = latest("yt");
  const src = (r) => (r ? `docs/pdca/${r.date}.md` : "台帳の導入時の判定");
  return {
    source: src(ig) === src(yt) ? src(ig) : `IG = ${src(ig)} / YT = ${src(yt)}`,
    ig: ig ? ig.modes.ig : intro,
    yt: yt ? yt.modes.yt : intro,
  };
}

export function hasJudgementOnOrAfter(reports, date) {
  return reports.some((r) => r.date >= date && /^## ジャンル判定/m.test(r.text));
}

export function decideMode(verdictValue, prevMode, judgeDate) {
  if (verdictValue === "配信死亡") return prevMode.startsWith("配信死亡モード") ? prevMode : `配信死亡モード（${judgeDate}〜）`;
  if (verdictValue === "切替候補") return "切替候補";
  if (verdictValue === "続行") return "通常";
  return prevMode; // 判定保留
}

export function trialStatus(history, today, { reports = [] } = {}) {
  const videos = history?.videos || [];
  const start = trialStart(videos);
  const trial = start && start <= today ? 2 : 0;
  const S = trial === 2 ? start : TRIALS[0].S;
  const F = trial === 2 ? start : TRIALS[0].F;
  const c = cycle({ S, F, today });
  const stats = c.from ? windowStats(videos, c.from, c.to) : null;
  const prev = previousModes(reports, today);

  let judge = null;
  if (c.isJudgeDay) {
    judge = { date: today, delayed: false, stats };
  } else if (c.lastJudge && !hasJudgementOnOrAfter(reports, c.lastJudge)) {
    judge = { date: c.lastJudge, delayed: true, stats: windowStats(videos, addDays(c.lastJudge, -14), addDays(c.lastJudge, -1)) };
  }

  const accounts = {};
  for (const platform of ["ig", "yt"]) {
    const today_ = stats ? verdict(platform, stats) : "判定保留";
    const judged = judge ? verdict(platform, judge.stats) : null;
    const mode = judge ? decideMode(judged, prev[platform], judge.date) : prev[platform];
    accounts[platform] = {
      label: ACCOUNTS[platform],
      todayVerdict: today_,
      judgeVerdict: judged,
      prevMode: prev[platform],
      mode,
      caution: !judge && today_ === "配信死亡" && !mode.startsWith("配信死亡モード"),
    };
  }

  return {
    trial,
    S,
    F,
    cycle: c,
    stats,
    judge,
    prevSource: prev.source,
    accounts,
    baseline: trial === 2 ? windowStats(videos, addDays(S, -14), addDays(S, -1)) : null,
  };
}

// ---------------------------------------------------------------------------
// Per-video rows, rankings, axes, rotation
// ---------------------------------------------------------------------------

const FORMAT_LABELS = { "brew-lesson": "抽出メモ", recipe: "レシピ（旧）", "news-top5": "ニュースTOP5（旧）" };

export function videoRow(video, today, provisionalDays = 2) {
  const ig = igMetrics(video);
  const c = video.content || null;
  const format = c?.format ? FORMAT_LABELS[c.format] || c.format : "ニュース（旧型）";
  return {
    date: video.date,
    format,
    topic: c?.topic ?? "—",
    pillar: c?.pillar ? PILLARS[c.pillar] || c.pillar : "—",
    method: c?.method ? METHODS[c.method]?.label || c.method : "—",
    fallback: Boolean(c?.fallback),
    ig,
    saveRate: ig && ig.reach ? (ig.saved / ig.reach) * 100 : null,
    yt: ytViews(video),
    provisional: video.date > addDays(today, -1 - provisionalDays),
    title: video.title || "",
  };
}

/**
 * "直近 14 日" = the 14 days before today (today − 14..today − 1) — the genre
 * rule's comparison window, separate from the judgement window (and today's
 * video is not posted yet when the morning routine runs).
 */
export function recentRows(history, today, days = 14, provisionalDays = 2) {
  const from = addDays(today, -days);
  const to = addDays(today, -1);
  return (history?.videos || [])
    .filter((v) => v.date >= from && v.date <= to)
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

/** Usage counts in rows (all of them, provisional included) — least-used first. */
export function rotation(rows) {
  const count = (keyFn, universe) => {
    const m = new Map(universe.map((k) => [k, 0]));
    for (const r of rows) {
      const k = keyFn(r);
      if (k && k !== "—") m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => a.n - b.n);
  };
  return {
    pillar: count((r) => r.pillar, Object.values(PILLARS)),
    method: count((r) => r.method, Object.values(METHODS).map((m) => m.label)),
  };
}

export function summarize(history, { today, days = 14, provisionalDays = 2, reports = [] } = {}) {
  const status = trialStatus(history, today, { reports });
  const rows = recentRows(history, today, days, provisionalDays);
  const typeRows = rows.filter((r) => r.date >= status.F);
  return {
    today,
    days,
    provisionalDays,
    status,
    rows,
    ranking: rankBySaved(typeRows),
    byMethod: groupBySaved(typeRows, (r) => r.method),
    byPillar: groupBySaved(typeRows, (r) => r.pillar),
    byFormat: groupBySaved(typeRows, (r) => r.format),
    rotation: rotation(typeRows),
  };
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const fmt = (v, digits = 1) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(digits));
const md = (s) => String(s).replace(/\|/g, "／");
const mmdd = (iso) => iso.slice(5);

function metricCell(platform, stats) {
  if (!stats) return "—";
  return platform === "ig"
    ? `views 中央値 ${fmt(stats.ig.viewsMedian)} / 保存合計 ${stats.ig.savedSum}`
    : `views 中央値 ${fmt(stats.yt.viewsMedian)}`;
}

const ROTATION_RULE =
  "柱（知識のテーマ）と抽出法は下の「ローテーション」で使用回数が少ないものから、「同じ柱・抽出法を 2 日連続にしない」を守って選ぶ";

export function methodPolicy(s) {
  const { accounts, stats } = s;
  const dead = ["ig", "yt"].filter((p) => accounts[p].mode.startsWith("配信死亡モード"));
  if (dead.length === 2) {
    return `性能データで選ばない（2 アカウントとも配信死亡モード）— ${ROTATION_RULE}`;
  }
  if (dead.length === 1) {
    const alive = dead[0] === "ig" ? "yt" : "ig";
    const n = stats ? stats[alive].n : 0;
    if (n < THRESHOLDS.minN) {
      // The alive account cannot be compared either → same as both dead.
      return `性能データで選ばない（${accounts[dead[0]].label} は配信死亡モード、${accounts[alive].label} は判定窓の n=${n} < ${THRESHOLDS.minN}）— ${ROTATION_RULE}`;
    }
    return `${accounts[alive].label} の指標だけで選ぶ（${accounts[dead[0]].label} は配信死亡モード）`;
  }
  return "通常 — 柱・抽出法は IG のフォロワー増加数と保存数で比べて決める（YT は別に参考）";
}

function statusSection(s) {
  const t = TRIALS[s.trial];
  const c = s.cycle;
  const window = s.stats ? `${mmdd(s.stats.from)}..${mmdd(s.stats.to)}` : "—";
  const lines = [
    "## ジャンル試行の状態",
    "",
    "| アカウント | 試行 # | 開始日 | 経過日 | 判定窓 (n) | 判定指標の現在値 | モード | 次の判定日 |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const p of ["ig", "yt"]) {
    const a = s.accounts[p];
    const n = s.stats ? (p === "ig" ? s.stats.ig.n : s.stats.yt.n) : 0;
    lines.push(`| ${a.label} | ${t.label} | ${s.S} | ${c.status} | ${window} (n=${n}) | ${metricCell(p, s.stats)} | ${a.mode} | ${c.next} |`);
  }
  lines.push("");
  if (c.isJudgeDay) lines.push("- 今日の判定: **判定日** →「ジャンル判定」節（下書きは下）");
  else if (s.judge?.delayed) lines.push(`- 今日の判定: **遅延判定**（${s.judge.date} の判定が未記録）→「ジャンル判定」節（下書きは下）`);
  else lines.push("- 今日の判定: なし（判定日ではない）");
  lines.push(`- 判定値（参考・毎日）: IG = ${s.accounts.ig.todayVerdict} / YT = ${s.accounts.yt.todayVerdict}（モードが変わるのは判定日と遅延判定だけ）`);
  for (const p of ["ig", "yt"]) {
    if (s.accounts[p].caution) lines.push(`- 注意: ${s.accounts[p].label} は判定窓で配信死亡の域（モードの変更は次の判定日）`);
  }
  lines.push(`- 今日の柱・抽出法の方針: ${methodPolicy(s)}`);
  lines.push(`- 前回モードの出どころ: ${s.prevSource}`);
  if (s.trial !== 2) {
    lines.push(
      `- 試行 #1（レシピカード型）は 2026-09-22 のオーナー決定で中止。試行 #2（${TRIALS[2].genre}）はまだ初回投稿がない（予定 ${TRIALS[2].plannedStart}）。初回投稿の翌朝から S = F = 初回投稿日で集計する`
    );
  }
  if (s.baseline) {
    lines.push(
      `- 比較用ベースライン（試行 #0 の最後の 14 日 ${mmdd(s.baseline.from)}..${mmdd(s.baseline.to)}）: IG views 中央値 ${fmt(s.baseline.ig.viewsMedian)} / 保存合計 ${s.baseline.ig.savedSum} (n=${s.baseline.ig.n})、YT views 中央値 ${fmt(s.baseline.yt.viewsMedian)} (n=${s.baseline.yt.n})`
    );
  }
  return lines;
}

function judgementSection(s) {
  if (!s.judge) return [];
  const j = s.judge;
  const lines = [
    `## ジャンル判定（下書き: ${j.date}${j.delayed ? "・遅延判定" : ""}、判定窓 ${mmdd(j.stats.from)}..${mmdd(j.stats.to)}）`,
    "",
  ];
  const th = THRESHOLDS;
  for (const p of ["ig", "yt"]) {
    const a = s.accounts[p];
    const basis =
      p === "ig"
        ? `views 中央値 ${fmt(j.stats.ig.viewsMedian)}（配信死亡 < ${th.ig.deadViewsMedian} / 切替候補 < ${th.ig.switchViewsMedian}）・保存合計 ${j.stats.ig.savedSum}（< ${th.ig.savedSum}）・n=${j.stats.ig.n}`
        : `views 中央値 ${fmt(j.stats.yt.viewsMedian)}（配信死亡 < ${th.yt.deadViewsMedian} / 切替候補 < ${th.yt.switchViewsMedian}）・n=${j.stats.yt.n}`;
    const change = a.prevMode === a.mode ? `モード: ${a.mode}（変化なし）` : `モード: ${a.prevMode} → ${a.mode}`;
    const next = a.judgeVerdict === "切替候補" || a.judgeVerdict === "配信死亡" ? " — 次ジャンル候補 2〜3 案（集客フェーズなので販促の型は出さない）をルーチンが書く" : "";
    lines.push(`- ${a.label}: ${a.judgeVerdict} — ${basis} — ${change}${next}`);
  }
  lines.push("");
  return lines;
}

function experimentSection(s) {
  const deadAccounts = ["ig", "yt"].filter((p) => s.accounts[p].mode.startsWith("配信死亡モード"));
  if (!deadAccounts.length) return [];
  if (s.trial >= 2 && s.cycle.d < 14) {
    return ["## 構造実験の提案", "", `- IG / YT 共通: 実行中: 試行 #2（${TRIALS[2].genre}）${s.cycle.status}`, ""];
  }
  if (s.trial === 0) {
    // Trial #2 is merged and waiting for its first post: no new proposals until
    // it runs (genre rule (d)5, 準備中).
    return ["## 構造実験の提案", "", `- IG / YT 共通: 準備中: 試行 #2（${TRIALS[2].genre}）`, ""];
  }
  return ["## 構造実験の提案", "", "- （配信死亡モードのアカウントについて、何を変えるか / 何で測るか / 14 日後の合格ライン をルーチンが書く）", ""];
}

/** The title with its 【…】 prefix and ｜… suffix stripped, capped for the table. */
function titleTopic(title) {
  const t = String(title ?? "").replace(/^【[^】]*】/, "").replace(/｜.*$/, "");
  return Array.from(t).slice(0, 28).join("");
}

export function rowTopic(r) {
  if (r.format === "抽出メモ") return `${r.pillar}「${r.topic}」×${r.method}${r.fallback ? "［常備ネタ］" : ""}`;
  // Retired formats keep their own labels: a recipe-card post is not a news
  // post, and its fallback was the house recipe, not the evergreen pack.
  if (r.format === "レシピ（旧）") return `旧レシピ「${titleTopic(r.title)}」${r.fallback ? "［標準レシピ］" : ""}`;
  if (r.format === "ニュースTOP5（旧）") return `旧ニュースTOP5「${titleTopic(r.title)}」`;
  if (r.format === "ニュース（旧型）") return `旧型ニュース「${titleTopic(r.title)}」`;
  return r.format;
}

/** The fallback marker depends on what that format fell back to. */
function fallbackMark(r) {
  if (!r.fallback) return "";
  return r.format === "抽出メモ" ? "（常備）" : "（代替）";
}

function rowLine(r) {
  const ig = r.ig;
  const mark = r.provisional ? "（暫定）" : "";
  return `| ${r.date}${mark} | ${r.format}${fallbackMark(r)} | ${md(r.pillar)} | ${md(r.method)} | ${md(r.topic)} | ${ig ? ig.saved : "—"} | ${fmt(r.saveRate)} | ${ig ? ig.views : "—"} | ${ig?.reach ?? "—"} | ${ig?.shares ?? "—"} | ${r.yt ?? "—"} |`;
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
  const typeFrom = s.status.F;
  const lines = [
    ...statusSection(s.status),
    "",
    ...judgementSection(s.status),
    ...experimentSection(s.status),
    `## 直近 ${s.days} 日の投稿（主指標: IG 保存数）`,
    "",
    "| 日付 | 型 | 柱 | 抽出法 | トピック | **IG 保存** | 保存率(%) | IG views | IG reach | IG shares | YT views |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...s.rows.map(rowLine),
    "",
    `- 保存率 = IG 保存 ÷ IG reach。「（暫定）」は ${mmdd(addDays(s.today, -s.provisionalDays))} 以降の回（IG insights は最大 48h 遅れ、朝の時点では未確定）。「—」は未取得`,
    `- TOP / WORST・軸別・ローテーションは型の初回投稿日 F（${typeFrom}）以降の回だけで数える`,
    "",
    "## TOP 3 / WORST 3（IG 保存数。同数は保存率 → views の順、暫定を除く）",
    "",
  ];
  if (s.ranking.n === 0) {
    lines.push("（比較できる確定値がまだない）", "");
  } else {
    const rankLine = (r, i) =>
      `${i + 1}. ${r.date} ${rowTopic(r)} — 保存 ${r.ig.saved} / 保存率 ${fmt(r.saveRate)}% / views ${r.ig.views}`;
    lines.push("**TOP 3**", ...s.ranking.top.map(rankLine), "", "**WORST 3**", ...s.ranking.worst.map(rankLine), "");
  }
  const rot = (list) => list.map((x) => `${x.key} ${x.n}`).join(" / ");
  lines.push(
    "## 軸別の IG 保存数",
    "",
    ...groupTable("抽出法", s.byMethod),
    ...groupTable("柱", s.byPillar),
    ...groupTable("型", s.byFormat),
    `## ローテーション（直近 ${s.days} 日の使用回数・少ない順）`,
    "",
    `- 柱: ${rot(s.rotation.pillar) || "—"}`,
    `- 抽出法: ${rot(s.rotation.method)}`,
  );
  return lines.join("\n");
}

export function loadReports(pdcaDir) {
  if (!existsSync(pdcaDir)) return [];
  return readdirSync(pdcaDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.slice(0, 10), text: readFileSync(join(pdcaDir, f), "utf-8") }));
}

function main() {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const today = arg("today") || jstDateParts().iso;
  const days = Number(arg("days") || 14);
  const historyPath = arg("history") || join(rootDir, "data", "performance-history.json");
  const history = JSON.parse(readFileSync(historyPath, "utf-8"));
  const reports = loadReports(join(rootDir, "docs", "pdca"));


  const summary = summarize(history, { today, days, reports });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(renderMarkdown(summary));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
