/**
 * 「今日の抽出メモ」 — one episode of the series 「味をコントロールする技術」 a day.
 *
 * One format only: `brew-lesson`. Every episode of data/curriculum.json is one
 * thing you change (お湯の温度を上げる), why it changes the cup, and how the
 * taste moves one way or the other (上げると苦味とコク / 下げると酸味とすっきり).
 *
 * No recipe numbers (owner decision 2026-09-26, 「具体的なレシピの何グラムでとか
 * 何ミリリットルのお湯を何秒で入れてとかそういうのはいらない」): no grams,
 * millilitres, seconds, minutes, temperatures, ratios or grinder clicks anywhere
 * a viewer can read or hear. recipeNumberReason enforces that over every text
 * the routine writes and every published text (slides, narration, title,
 * captions). The cover is one big word + one picture, so the profile grid
 * tells the episodes apart.
 *
 * Owner decision 2026-09-18 / 2026-09-22: the channel is in its audience-growth
 * phase, so no coffee of our own is named, shown or sold here — no bean name,
 * no origin, no product, no purchase call to action. scripts/brand-guard.mjs
 * enforces that mechanically over every rendered text; this module must never
 * read data/coffee-lineup.json.
 *
 * Pure functions shared by:
 *   - scripts/generate-data.mjs     (content JSON → slides / narration)
 *   - scripts/generate-caption.mjs  (captions with the save/follow CTA)
 *   - scripts/record-upload.mjs     (content summary for PDCA)
 *   - scripts/validate-content.mjs  (the morning routine's pre-commit check)
 *   - scripts/content-format.test.mjs
 *
 * The morning routine writes data/enriched-coffee-news.json after reading the
 * web and its PR is merged without a human review, so every text that reaches
 * a card, caption, title or narration is validated as untrusted input
 * (unsafeTextReason) and scanned by the brand guard.
 */

import { readFileSync } from "fs";
import { scanBannedTerms } from "./brand-guard.mjs";
import { YT_DESCRIPTION_MAX_BYTES, youtubeSafe, youtubeTitle } from "./youtube-limits.mjs";

// The YouTube limits live in youtube-limits.mjs.
export { youtubeSafe, youtubeTitle };

export const TRIAL_ID = "coffee-trial-2-brew-basics";
export const FORMATS = ["brew-lesson"];

export const METHODS = {
  v60: { label: "V60", hashtag: "V60" },
  "kalita-wave": { label: "カリタウェーブ", hashtag: "カリタウェーブ" },
  origami: { label: "ORIGAMI", hashtag: "オリガミドリッパー" },
  chemex: { label: "ケメックス", hashtag: "ケメックス" },
  clever: { label: "クレバー", hashtag: "クレバードリッパー" },
  "paper-drip": { label: "ペーパードリップ", hashtag: "ペーパードリップ" },
  "french-press": { label: "フレンチプレス", hashtag: "フレンチプレス" },
  aeropress: { label: "エアロプレス", hashtag: "エアロプレス" },
  "mug-steep": { label: "マグで浸漬", hashtag: "コーヒーの淹れ方" },
  "cold-brew": { label: "水出し", hashtag: "水出しコーヒー" },
  "moka-pot": { label: "マキネッタ", hashtag: "マキネッタ" },
};

export const SCENES = { hot: "ホット", iced: "アイス" };

/**
 * Content pillars — the knowledge the channel teaches. One per day; the PDCA
 * compares IG follows/saves per pillar, and the fallback pack rotates through
 * them so a routine outage still teaches something new.
 */
export const PILLARS = {
  temp: "湯温",
  grind: "挽き目",
  ratio: "粉と湯の比率",
  time: "抽出時間",
  pour: "注ぎ方",
  gear: "器具の違い",
  trouble: "味の直し方",
  nogear: "器具がなくてもできる",
  water: "水",
  terms: "用語", // one word explained in its own episode (TDS, 抽出収率, 過抽出 …)
};

/**
 * The series 「味をコントロールする技術」 (owner request 2026-09-25): every episode
 * in data/curriculum.json, in broadcast order, beginner → advanced. The same
 * file is the evergreen pack — each episode carries a complete lesson, so a
 * routine outage still airs the next episode instead of something off-series.
 */
export const CURRICULUM = JSON.parse(readFileSync(new URL("../data/curriculum.json", import.meta.url), "utf-8"));
export const LEVELS = { beginner: "初級", intermediate: "中級", advanced: "上級" };

/** The header pill of the diagram slide, per diagram type. */
export const VISUAL_TYPES = {
  compare: "比べてみる",
  graph: "味の動き",
  flow: "お湯の流れ",
  scale: "目盛りで見る",
};
export const FLOW_SHAPES = ["cone", "flat", "immersion"];
export const MOTION_TYPES = ["liquid", "meter", "compare", "dissolve"];

// Display limits. The cover carries one giant word and the short question that
// follows it (湯温 + を上げると？); everything else is one phrase per line.
// Body text never goes below 30pt, so long strings must be shortened, not shrunk.
export const LIMITS = {
  word: 5, // the giant word on the cover: 湯温 / 挽き目 / TDS
  ask: 9, // what follows it on the cover: を上げると？ / ってなに？
  hook: 16, // the one change, in words: お湯の温度を上げる
  topic: 14, // what it does to the taste, one line
  why: 24, // why it happens
  effectLabel: 6, // one side of the change: 上げる / 下げる / 細かくする
  effectTaste: 12, // how the cup tastes on that side
  core: 24, // the one change the episode is about, under the why scene's picture
  meterLabel: 4, // 苦味 / 酸味 / すっきり
  tipProblem: 10,
  tipFix: 16,
  narrationTotal: 260, // IG Reels rejects > 60s videos
  // diagram slide (src/cards/Diagrams.tsx)
  visualCaption: 18,
  visualLabel: 6,
  visualResult: 10,
  visualNote: 10,
  graphTick: 5,
  zoneLabel: 4, // scale / graph zone names: 4 × 64px + arrow + 4 × 96px fits the 824px gauge row
};

// Cold brew is a food-safety case: it steeps for hours, so a cold-brew lesson
// must say it steeps in the fridge (冷蔵庫) somewhere in its text.
// unsafeSteepReason rejects room-temperature and multi-day steeps in every lesson.
export const COLD_BREW = { fridgeWord: "冷蔵庫" };

// Recipe numbers (owner decision 2026-09-26). Checked after NFKC, so full-width
// digits and ℃ (→ °C) count too. Counting words that are not a recipe setting
// stay allowed: 第4回 / 1つ / 1回 / 2つの味.
const RECIPE_NUMBER_RULES = [
  [
    // 15g / 240グラム / 200ml / 92°C / 30秒 / 3分 / 1.3% / 2倍 / 3投 / 1段 … (not 3分の1, 1ミリも, 1投目, 数十秒)
    /\d+(?:\.\d+)?\s*(?:g(?![a-z])|grams?|グラム|kg|mg|ml|ミリ(?![もの])|cc|l(?![a-z])|oz|リットル|°|秒|分(?!の)|min(?:ute)?s?(?![a-z])|sec(?:ond)?s?(?![a-z])|s(?![a-z])|m(?![a-z])|%|パーセント|倍|ppm|投(?!目)|段(?!階)|クリック|clicks?|番(?!目)|メモリ|cups?|deg|[CF](?![a-z]))/iu,
    "an amount, a temperature, a time, a ratio or a grinder setting",
  ],
  // 3度下げる / 92度 (but もう1度 / 1度だけ / 2度目 / 1度に are counting words)
  [/\d{2,}\s*度|(?<!もう)\d\s*度(?!目|だけ|に|きり|も)/u, "a temperature (92度 / 3度下げる)"],
  [/\d+\s*[:/]\s*\d+|\d+\s*[対比]\s*\d+/u, "a time or a ratio (2:30 / 1:15 / 1対15 / 1/15)"],
  [/(?:ダイヤル|目盛り?|メモリ)\s*\d/u, "a grinder setting (ダイヤル3)"],
  // a bare number of two digits or more (湯温は92くらい), except 第28回 / 36回 / V60 and other names
  [/(?<![A-Za-z第\d.])\d{2,}(?![\d.]|\s*(?:回|つ|人|本|種|代|年|日|月))/u, "a bare number (92くらい)"],
  [
    /(?<!数)[〇一二三四五六七八九十百千]+\s*(?:グラム|g(?![a-z])|ミリ(?![もの])|ml|cc|リットル|秒|パーセント|°|クリック|段(?!階))|[二三四五六七八九百]十[一二三四五六七八九]?\s*度|百\s*度|[一二三四五六七八九][〇一二三四五六七八九]\s*度|(?<![十数])[一二三四五六七八九]分(?!の|け|か|野|類|解|量)|[一二三四五六七八九十]+分半|[一二三四五六七八九十]+\s*対\s*[一二三四五六七八九十]+/u,
    "a number in kanji (十五グラム / 九十度 / 三分 / 一対十五)",
  ],
];

/** Why a text carries a recipe number (null = fine). */
export function recipeNumberReason(value) {
  const s = String(value ?? "").normalize("NFKC");
  for (const [re, what] of RECIPE_NUMBER_RULES) {
    const m = s.match(re);
    if (m) return `${what}: ${JSON.stringify(m[0])}`;
  }
  return null;
}

// Untrusted text checks, applied after NFKC so full-width look-alikes
// (＠ ＃ ｗｗｗ． ｈｔｔｐｓ：／／) count too. Written with escapes and property
// classes only — never paste raw invisible characters into this file.
// Default_Ignorable_Code_Point covers zero-width / bidi / variation selectors /
// tag characters / Hangul fillers (Unicode DerivedCoreProperties).
const INVISIBLE_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;
const MENTION_RE = /[@#]/u;
const URL_SCHEME_RE = /[a-z][a-z0-9+.-]*:\/\/|www\./iu;
// "label.tld" in any case (evil.coffee / EXAMPLE.COM / shop.de / .onion). Checked
// on a copy where the ideographic full stop counts as a dot (example。com; NFKC
// already maps the half-width and full-width stops). Abbreviations such as
// "Mr.Brown" are rejected too — the routine rewrites them; a missed link is worse.
const ANY_DOMAIN_RE = /[a-z0-9][a-z0-9-]*\.[a-z]{2,}(?![a-z0-9])/iu;
// spaced dots ("bit . ly/abc") — well-known TLDs only, so "coffee. Then" stays text
const SPACED_DOMAIN_RE =
  /[a-z0-9-]+(?:\s+\.\s*|\s*\.\s+)(?:com|net|org|info|biz|io|co|jp|me|ly|gl|gg|to|tv|cc|xyz|app|dev|link|shop|store|site|online|ai|us|uk|de|fr|cn|kr|ru|onion|coffee|cafe)(?![a-z0-9])/iu;
// internationalized names (例え.テスト / 東京.jp) — ASCII dot only, since the
// ideographic full stop ends every Japanese sentence
const IDN_DOMAIN_RE = /[\p{L}\p{N}-]+\.[\p{L}\p{M}]{2,}/u;
const IDEOGRAPHIC_STOP_RE = /\u{3002}/gu;

/** Why a text may not be published (null = fine): invisible/control characters, @ / #, URLs or domains. */
export function unsafeTextReason(value) {
  const s = String(value ?? "").normalize("NFKC");
  if (INVISIBLE_RE.test(s)) return "a line break, control, zero-width, emoji variation selector or other invisible character";
  if (MENTION_RE.test(s)) return '"@" or "#" (mentions and hashtags become links)';
  const dotted = s.replace(IDEOGRAPHIC_STOP_RE, ".");
  if (URL_SCHEME_RE.test(dotted) || ANY_DOMAIN_RE.test(dotted) || SPACED_DOMAIN_RE.test(dotted) || IDN_DOMAIN_RE.test(s)) {
    return "a URL or domain name";
  }
  return null;
}

// Own properties only: "constructor" / "__proto__" must not pass a table lookup.
const own = (table, key) => (typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined);

// Steeping safety wording, checked in every text of every recipe after NFKC
// (a non-cold-brew tip can still say "常温で一晩置いて水出し").
//   always unsafe : 常温で / 室温のまま / 常温に置く (not 常温に置かず), a negated fridge
//   unless the same sentence says the fridge (冷蔵): 常温 / 室温 / キッチン / 置いたまま / 一晩 …
//   never         : durations in days (2日 / 一日半 / 3 days) or over 24 hours (30時間 / 48h)
// Allowed on purpose (not a steep): storing beans / grounds and pouring water at room temperature.
const STEEP_ALLOWED_RE = /(?:常温|室温)(?:で|に|の)?(?:保存|保管)|(?:常温|室温)の(?:水|お湯|湯)を?注/gu;
const STEEP_ALWAYS_UNSAFE_RE =
  /(?:常温|室温)(?:で|のまま|に置(?!か[ずな]))|(?:no|without|not in|out of)\s+(?:the\s+)?(?:fridge|refrigerat)/iu;
const FRIDGE_WORD_RE = /冷蔵|fridge|refrigerat/iu;
// A negation anywhere after the fridge word in the same sentence cancels it:
// 冷蔵庫には入れず / 入れません / 入れなくてOK / 冷蔵庫NG / 冷蔵庫の外で / 冷蔵庫から出して.
// (必ず / まず are not negations; 抽出する / 引き出す are not "taking out".)
const FRIDGE_NEGATED_RE =
  /(?:冷蔵|fridge|refrigerat).*?(?:(?<![必ま])ず(?!っ)|ません|ない|なく|NG|ダメ|だめ|禁止|外|(?:から|を)(?:取り)?出(?:して|す|し)|不要|いら|無し|なし|抜き|以外|使わ|避け|\bnot\b|\bnever\b)/iu;
// Steeping words that need the fridge in the same sentence (every recipe, not only cold brew).
const STEEP_OUTSIDE_RE =
  /常温|室温|キッチン|台所|テーブル|机|棚|置いたまま|置きっぱなし|出しっぱなし|放置|一晩|ひと晩|一夜|一昼夜|夜通し|翌朝|オーバーナイト|水出し|overnight|room\s*temp|cold\s*brew/iu;
const STEEP_WORD_RE = /浸け|浸す|漬け|漬ける|つけ|置|寝か|ねか|抽出|水出し|冷蔵|放置|steep|soak/iu;
// Durations in days are never a recipe (per sentence): 2日 / 1.5日 / 3 days, 一日半 / 一昼夜 /
// 二日 at the end, 半日浸ける; a kanji day count next to a steeping word (一日冷蔵庫で).
// Dates (9月20日) and 一日の始まり are not durations.
const DAYS_ARABIC_RE = /(?<![\d\u{6708}])\d+(?:\.\d+)?\s*日|\d\s*days?\b|\bdays?\b/iu;
const DAYS_KANJI_CONTEXT_RE = /[〇零一二三四五六七八九十百数何半丸]+日(?:間|半|以上|ほど|くらい|程度|かけ|置|浸|寝|漬|中|$)|一昼夜|昼夜/u;
const DAYS_KANJI_RE = /[〇零一二三四五六七八九十百数何半丸]+日/u;
// Hours, Arabic or kanji (30時間 / 三十時間 / 48h), and "at least 24" (24時間以上 / 超 / を超え / オーバー).
const STEEP_HOURS_RE =
  /(\d+(?:\.\d+)?|[〇零一二三四五六七八九十百]+)\s*(?:時間|hours?|hrs?|h)(?![a-z])(\s*(?:以上|超|を?超え|オーバー|over|より長|\+))?/giu;
// sentence ends: 。 ! ? line breaks, and "." before a space / the end (not decimals)
const SENTENCE_END_RE = /[\u{3002}!?\n]|\.(?=\s|$)/u;

const KANJI_DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 三十 → 30, 二十四 → 24, 十二 → 12, 百二十 → 120, 二四 → 24; null if it is not a kanji number. */
export function kanjiNumber(text) {
  let total = 0;
  let current = 0;
  for (const c of String(text ?? "")) {
    if (Object.hasOwn(KANJI_DIGITS, c)) current = current * 10 + KANJI_DIGITS[c];
    else if (c === "十") [total, current] = [total + (current || 1) * 10, 0];
    else if (c === "百") [total, current] = [total + (current || 1) * 100, 0];
    else return null;
  }
  return total + current;
}

/** Why a recipe text describes an unsafe steep (null = fine). */
export function unsafeSteepReason(value) {
  const s = String(value ?? "").normalize("NFKC").replace(STEEP_ALLOWED_RE, "\u{25A1}");
  if (STEEP_ALWAYS_UNSAFE_RE.test(s)) return "room temperature or no fridge";
  for (const m of s.matchAll(STEEP_HOURS_RE)) {
    const hours = /^\d/u.test(m[1]) ? Number(m[1]) : kanjiNumber(m[1]);
    if (hours != null && (hours > 24 || (hours >= 24 && m[2]))) return "24 hours or more";
  }
  for (const sentence of s.split(SENTENCE_END_RE)) {
    const fridge = FRIDGE_WORD_RE.test(sentence);
    if (fridge && FRIDGE_NEGATED_RE.test(sentence)) return "a negated fridge (冷蔵庫に入れない / 冷蔵庫の外 …)";
    if (DAYS_ARABIC_RE.test(sentence) || DAYS_KANJI_CONTEXT_RE.test(sentence) || (DAYS_KANJI_RE.test(sentence) && STEEP_WORD_RE.test(sentence))) {
      return "a duration in days";
    }
    if (STEEP_OUTSIDE_RE.test(sentence) && !fridge) return "outside the fridge (say 冷蔵庫 in the same sentence)";
  }
  return null;
}

export function isSafeHttpsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\//.test(value)) return false;
  if (INVISIBLE_RE.test(value.normalize("NFKC")) || /[\s<>"'`\\]/u.test(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const TIME_RE = /^(\d{1,2}):([0-5]\d)$/;
const HOURS_RE = /^(\d{1,2}(?:\.\d)?)h$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function charLen(s) {
  return Array.from(String(s ?? "")).length;
}

/** "2:30" → "2分30秒", "0:45" → "45秒", "3:00" → "3分", "8h" → "8時間" (TTS reads "2:30" as a clock time). */
export function speakTime(t) {
  const s = String(t ?? "");
  const h = s.match(HOURS_RE);
  if (h) return `${h[1]}時間`;
  const m = s.match(TIME_RE);
  if (!m) return s;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (min === 0) return `${sec}秒`;
  if (sec === 0) return `${min}分`;
  return `${min}分${sec}秒`;
}

/**
 * Normalize narration for Edge TTS: "2:30" → "2分30秒", "92℃" → "92度",
 * "15g" → "15グラム", "10h" → "10時間". Ratios must be written as "1対15"
 * (a bare "1:15" is indistinguishable from a time).
 */
export function toSpokenJa(text) {
  return String(text ?? "")
    .replace(/(\d{1,2}):([0-5]\d)(?!\d)/g, (m) => speakTime(m))
    .replace(/(\d+(?:\.\d+)?)\s?℃/g, "$1度")
    .replace(/(\d+(?:\.\d+)?)\s?g(?![A-Za-z])/g, "$1グラム")
    .replace(/(\d+(?:\.\d)?)h(?![A-Za-z])/g, "$1時間");
}
export function jstDateParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    display: `${parts.year}.${parts.month}.${parts.day}`,
    slash: `${parts.year}/${parts.month}/${parts.day}`,
    compact: `${parts.year}${parts.month}${parts.day}`,
    weekday: parts.weekday, // "日" .. "土"
  };
}


/** Every day is a brewing lesson — there is no second format. */
export function expectedFormatFor(_isoDate) {
  return "brew-lesson";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Values are echoed with JSON.stringify so a line break inside an untrusted
// value cannot start a new log line (GitHub Actions reads "::command::" lines).
const quote = (v) => JSON.stringify(String(v ?? ""));

function checkText(errors, label, value) {
  if (typeof value !== "string") return;
  const reason = unsafeTextReason(value);
  if (reason) errors.push(`${label} contains ${reason}: ${quote(value)}`);
}

function checkLen(errors, label, value, max) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} is required`);
  } else if (charLen(value) > max) {
    errors.push(`${label} is ${charLen(value)} chars (max ${max}): ${quote(value)}`);
  }
  checkText(errors, label, value);
}

/** Every text of a lesson that reaches the cards, captions or narration: [label, value]. */
function lessonTexts(lesson, prefix) {
  const out = [];
  const add = (label, v) => typeof v === "string" && out.push([label, v]);
  for (const k of ["word", "ask", "hook", "topic", "why", "core"]) add(`${prefix}.${k}`, lesson[k]);
  (Array.isArray(lesson.motion?.meters) ? lesson.motion.meters : []).forEach((x, i) => add(`${prefix}.motion.meters[${i}].label`, x?.label));
  (Array.isArray(lesson.effect) ? lesson.effect : []).forEach((e, i) => {
    add(`${prefix}.effect[${i}].label`, e?.label);
    add(`${prefix}.effect[${i}].taste`, e?.taste);
  });
  (Array.isArray(lesson.tips) ? lesson.tips : []).forEach((t, i) => {
    add(`${prefix}.tips[${i}].problem`, t?.problem);
    add(`${prefix}.tips[${i}].fix`, t?.fix);
  });
  for (const [label, v] of visualTexts(lesson.visual, `${prefix}.visual`)) add(label, v);
  const nar = lesson.narration && typeof lesson.narration === "object" ? lesson.narration : {};
  // keys are untrusted too: quoted, so a key cannot carry a line break into the log
  for (const [k, v] of Object.entries(nar)) add(`${prefix}.narration[${quote(k)}]`, v);
  return out;
}

/** Every string of the diagram block: [label, value] (all of them reach the screen). */
function visualTexts(visual, prefix) {
  const out = [];
  const walk = (label, value) => {
    if (typeof value === "string") out.push([label, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(`${label}[${i}]`, v));
    // keys are untrusted: anything but a plain name is quoted, so it cannot carry a line break into the log
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(`${label}.${/^\w+$/.test(k) ? k : quote(k)}`, v);
  };
  if (visual && typeof visual === "object") walk(prefix, visual);
  return out;
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * The diagram of the day (src/cards/Diagrams.tsx). Every string is capped by
 * the space its drawing gives it — at 40px+ there is no room to shrink.
 */
export function validateVisual(v, errors, prefix = "lesson.visual") {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    errors.push(`${prefix} is required: pick one of ${Object.keys(VISUAL_TYPES).join(", ")} (docs/curriculum.md 「図解の型」)`);
    return;
  }
  if (!own(VISUAL_TYPES, v.type)) {
    errors.push(`${prefix}.type must be one of ${Object.keys(VISUAL_TYPES).join(", ")} (got ${quote(v.type)})`);
    return;
  }
  checkLen(errors, `${prefix}.caption`, v.caption, LIMITS.visualCaption);
  if (v.type === "compare") {
    for (const side of ["left", "right"]) {
      const s = v[side] || {};
      checkLen(errors, `${prefix}.${side}.label`, s.label, LIMITS.visualLabel);
      checkLen(errors, `${prefix}.${side}.result`, s.result, LIMITS.visualResult);
      if (!isInt(s.strength, 1, 5)) errors.push(`${prefix}.${side}.strength must be an integer 1-5 (how dark the cup is)`);
    }
    if (v.pick != null && v.pick !== "left" && v.pick !== "right") errors.push(`${prefix}.pick must be "left" or "right"`);
  } else if (v.type === "graph") {
    checkLen(errors, `${prefix}.xLabel`, v.xLabel, LIMITS.visualLabel);
    checkLen(errors, `${prefix}.yLabel`, v.yLabel, LIMITS.visualLabel);
    const pts = v.points;
    if (!Array.isArray(pts) || pts.length < 2 || pts.length > 5) {
      errors.push(`${prefix}.points must have 2-5 items`);
    } else {
      pts.forEach((p, i) => {
        checkLen(errors, `${prefix}.points[${i}].label`, p?.label, LIMITS.graphTick);
        if (!isInt(p?.value, 1, 5)) errors.push(`${prefix}.points[${i}].value must be an integer 1-5`);
      });
      if (v.mark != null && !isInt(v.mark, 0, pts.length - 1)) errors.push(`${prefix}.mark must be the index of one of the points`);
    }
    if (v.zones != null) {
      if (!Array.isArray(v.zones) || v.zones.length < 2 || v.zones.length > 3) errors.push(`${prefix}.zones must have 2-3 labels`);
      else v.zones.forEach((z, i) => checkLen(errors, `${prefix}.zones[${i}]`, z, LIMITS.zoneLabel));
    }
  } else if (v.type === "flow") {
    const b = v.brewers;
    if (!Array.isArray(b) || b.length < 1 || b.length > 2) {
      errors.push(`${prefix}.brewers must have 1-2 items`);
    } else {
      b.forEach((x, i) => {
        const p = `${prefix}.brewers[${i}]`;
        if (!FLOW_SHAPES.includes(x?.shape)) errors.push(`${p}.shape must be one of ${FLOW_SHAPES.join(", ")}`);
        checkLen(errors, `${p}.label`, x?.label, LIMITS.visualLabel);
        checkLen(errors, `${p}.note`, x?.note, LIMITS.visualNote);
        if (x?.speed != null && x.speed !== "fast" && x.speed !== "slow") errors.push(`${p}.speed must be "fast" or "slow"`);
        if (x?.pour != null && x.pour !== "center" && x.pour !== "wide") errors.push(`${p}.pour must be "center" or "wide"`);
        if (x?.height != null && x.height !== "high" && x.height !== "low") errors.push(`${p}.height must be "high" or "low"`);
        if (x?.bed != null && x.bed !== "even" && x.bed !== "uneven") errors.push(`${p}.bed must be "even" or "uneven"`);
      });
    }
  } else if (v.type === "scale") {
    // A gauge without numbers (owner decision 2026-09-26): 2-3 named zones of
    // equal width, and where the needle starts / ends, 0-100 along the gauge.
    checkLen(errors, `${prefix}.label`, v.label, LIMITS.visualLabel);
    for (const k of ["unit", "format", "min", "max"]) {
      if (v[k] != null) errors.push(`${prefix}.${k} is not used any more — the gauge shows no numbers: name the zones and give from / to as 0-100 along the gauge`);
    }
    if (!isInt(v.to, 0, 100)) errors.push(`${prefix}.to must be an integer 0-100 (where the needle ends, along the gauge)`);
    if (v.from != null && !isInt(v.from, 0, 100)) errors.push(`${prefix}.from must be an integer 0-100 when set`);
    const z = v.zones;
    if (!Array.isArray(z) || z.length < 2 || z.length > 3) errors.push(`${prefix}.zones must have 2-3 names, left to right`);
    else z.forEach((name, i) => checkLen(errors, `${prefix}.zones[${i}]`, name, LIMITS.zoneLabel));
  }
}


/**
 * How the why scene shows the change (owner 2026-09-26: 「実際の苦味が出る表現が
 * イラストの中で表現されてない」): the liquid gets darker or lighter, taste
 * meters move, two cups drift apart, or particles dissolve out of the grounds.
 * Every value is a position 0-100 — nothing is printed as a number.
 */
export function validateMotion(v, errors, prefix = "lesson.motion") {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    errors.push(`${prefix} is required: { type: ${MOTION_TYPES.join(" | ")}, shade: { from, to }, meters: [{ label, from, to }] } (copy it from today's draft)`);
    return;
  }
  if (!MOTION_TYPES.includes(v.type)) errors.push(`${prefix}.type must be one of ${MOTION_TYPES.join(", ")}`);
  const pos = (x) => Number.isInteger(x) && x >= 0 && x <= 100;
  if (!v.shade || !pos(v.shade.from) || !pos(v.shade.to)) errors.push(`${prefix}.shade.from / to must be integers 0-100 (how dark the coffee is before / after)`);
  const m = v.meters;
  if (!Array.isArray(m) || m.length < 1 || m.length > 3) {
    errors.push(`${prefix}.meters must have 1-3 items`);
  } else {
    m.forEach((x, i) => {
      checkLen(errors, `${prefix}.meters[${i}].label`, x?.label, LIMITS.meterLabel);
      if (!pos(x?.from) || !pos(x?.to)) errors.push(`${prefix}.meters[${i}].from / to must be integers 0-100`);
    });
  }
}

/** The curriculum entry of an episode id (own ids only), or undefined. */
export function episodeById(id, curriculum = CURRICULUM) {
  return typeof id === "string" ? curriculum.episodes.find((e) => e.id === id) : undefined;
}

/**
 * Episodes in the order the channel should air them next, starting with "the
 * next episode": the one after the most recently aired episode (curriculum
 * order, wrapping to episode 1 after the last — season two). Nothing aired yet
 * → episode 1. The rest of the list is the curriculum from there on, which the
 * fallback walks only when an episode's own lesson fails validation.
 *
 * "Aired" = the `content.episode` of the latest performance-history video
 * dated before `today` (a re-run of today's job must not count today's own
 * post). Only the latest one matters, so the 90-day history window never
 * confuses the count, and a day that failed to post (no record) simply airs the
 * same episode again the next day — which the viewers never saw.
 */
export function episodeQueue(history, today, curriculum = CURRICULUM) {
  const videos = Array.isArray(history?.videos) ? history.videos : [];
  let latest = null;
  for (const v of videos) {
    const id = v?.content?.episode;
    if (typeof v?.date !== "string" || (today && v.date >= today) || !episodeById(id, curriculum)) continue;
    if (!latest || v.date >= latest.date) latest = { date: v.date, id };
  }
  const eps = curriculum.episodes;
  const start = latest ? (eps.findIndex((e) => e.id === latest.id) + 1) % eps.length : 0;
  return eps.map((_, i) => eps[(start + i) % eps.length]);
}

export function nextEpisode(history, today, curriculum = CURRICULUM) {
  return episodeQueue(history, today, curriculum)[0];
}

/** 1-based broadcast number and the level label: { no: 4, level: "初級" }. */
export function episodeNumber(id, curriculum = CURRICULUM) {
  const i = curriculum.episodes.findIndex((e) => e.id === id);
  return i < 0 ? null : { no: i + 1, level: LEVELS[curriculum.episodes[i].level] };
}

/** The episode after `id` in curriculum order (wraps to episode 1) — the CTA's "次回". */
export function followingEpisode(id, curriculum = CURRICULUM) {
  const i = curriculum.episodes.findIndex((e) => e.id === id);
  return i < 0 ? undefined : curriculum.episodes[(i + 1) % curriculum.episodes.length];
}

export function validateLesson(lesson, errors, prefix = "lesson") {
  if (!lesson || typeof lesson !== "object") {
    errors.push(`${prefix} block is required`);
    return;
  }
  if (lesson.beanId != null) {
    errors.push(`${prefix}.beanId is not allowed — this channel never names a coffee of its own (owner decision 2026-09-22)`);
  }
  for (const k of ["numbers", "steps", "taste"]) {
    if (lesson[k] != null) {
      errors.push(`${prefix}.${k} is not allowed — no recipe numbers, steps or taste scores (owner decision 2026-09-26); write why / effect / tips instead (docs/routine-prompt.md)`);
    }
  }
  if (!own(PILLARS, lesson.pillar)) {
    errors.push(`${prefix}.pillar must be one of ${Object.keys(PILLARS).join(", ")}`);
  }
  if (!own(METHODS, lesson.method)) {
    errors.push(`${prefix}.method ${quote(lesson.method)} must be one of ${Object.keys(METHODS).join(", ")}`);
  }
  // The series: every lesson is one episode of data/curriculum.json and keeps
  // what that episode is — its pillar, its cover (word + ask, which the day
  // before already announced as 次回), its one change (hook) and, for gear
  // episodes, the brewer.
  const episode = episodeById(lesson.episode);
  if (!episode) {
    errors.push(`${prefix}.episode ${quote(lesson.episode)} must be an episode id of data/curriculum.json (node scripts/next-episode.mjs prints today's)`);
  } else {
    for (const k of ["pillar", "word", "ask", "hook"]) {
      if (lesson[k] !== episode.lesson[k]) errors.push(`${prefix}.${k} must stay ${quote(episode.lesson[k])} for episode ${episode.id} (the series map fixes it)`);
    }
    if (episode.fixedMethod && lesson.method !== episode.lesson.method) {
      errors.push(`${prefix}.method must be ${quote(episode.lesson.method)} for episode ${episode.id} (the brewer is the lesson)`);
    }
  }
  validateVisual(lesson.visual, errors, `${prefix}.visual`);
  if (!own(SCENES, lesson.scene)) errors.push(`${prefix}.scene must be "hot" or "iced"`);
  if (lesson.method === "cold-brew" && lesson.scene !== "iced") errors.push(`${prefix}.scene must be "iced" for cold-brew`);
  if (lesson.sources != null && !Array.isArray(lesson.sources)) errors.push(`${prefix}.sources must be an array of URLs`);
  (Array.isArray(lesson.sources) ? lesson.sources : []).forEach((u, i) => {
    if (!isSafeHttpsUrl(u)) errors.push(`${prefix}.sources[${i}] must be an https URL`);
  });
  checkLen(errors, `${prefix}.word`, lesson.word, LIMITS.word);
  checkLen(errors, `${prefix}.ask`, lesson.ask, LIMITS.ask);
  checkLen(errors, `${prefix}.hook`, lesson.hook, LIMITS.hook);
  checkLen(errors, `${prefix}.topic`, lesson.topic, LIMITS.topic);
  checkLen(errors, `${prefix}.why`, lesson.why, LIMITS.why);
  checkLen(errors, `${prefix}.core`, lesson.core, LIMITS.core);
  validateMotion(lesson.motion, errors, `${prefix}.motion`);

  // The two sides of the change: today's move first, then the other way.
  const eff = lesson.effect;
  if (!Array.isArray(eff) || eff.length !== 2) {
    errors.push(`${prefix}.effect must have exactly 2 items: [today's move, the other way], each { label, taste }`);
  } else {
    eff.forEach((e, i) => {
      checkLen(errors, `${prefix}.effect[${i}].label`, e?.label, LIMITS.effectLabel);
      checkLen(errors, `${prefix}.effect[${i}].taste`, e?.taste, LIMITS.effectTaste);
    });
    if (eff[0]?.label && eff[0].label === eff[1]?.label) errors.push(`${prefix}.effect: the two labels must differ`);
  }

  const tips = lesson.tips;
  if (!Array.isArray(tips) || tips.length < 2 || tips.length > 3) {
    errors.push(`${prefix}.tips must have 2-3 items`);
  } else {
    tips.forEach((tip, i) => {
      checkLen(errors, `${prefix}.tips[${i}].problem`, tip?.problem, LIMITS.tipProblem);
      checkLen(errors, `${prefix}.tips[${i}].fix`, tip?.fix, LIMITS.tipFix);
    });
  }

  const nar = lesson.narration;
  if (nar != null && (typeof nar !== "object" || Array.isArray(nar))) errors.push(`${prefix}.narration must be an object`);
  const texts = lessonTexts(lesson, prefix);
  for (const [label, value] of texts) {
    if (label.startsWith(`${prefix}.narration[`)) checkText(errors, label, value);
    // every lesson, not only cold-brew: a hot lesson's tip can describe a cold brew too
    const steep = unsafeSteepReason(value);
    if (steep) errors.push(`${label} describes an unsafe steep (${steep}): ${quote(value)}`);
    const num = recipeNumberReason(value);
    if (num) errors.push(`${label} must not carry a recipe number — ${num} (say it in words: 高め / 細かく / 長く): ${quote(value)}`);
  }
  if (lesson.method === "cold-brew" && !texts.some(([, v]) => v.includes(COLD_BREW.fridgeWord))) {
    errors.push(`${prefix} must say "${COLD_BREW.fridgeWord}" for cold-brew (e.g. why: "冷蔵庫でゆっくり溶かす") — it steeps in the fridge`);
  }
}

/**
 * Everything the audience can read: slide text, narration, the YouTube title
 * and description, and the Instagram caption. The brand guard scans this list,
 * so a bean name can never reach a viewer through any of those channels.
 */
export function collectPublishedTexts(data, captions = null) {
  const out = [];
  const add = (label, v) => typeof v === "string" && v !== "" && out.push([label, v]);
  add("topicTitle", data.topicTitle);
  const walk = (label, value) => {
    if (typeof value === "string") add(label, value);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(`${label}[${i}]`, v));
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(`${label}.${k}`, v);
  };
  data.slides.forEach((s, i) => walk(`slides[${i}]`, s));
  walk("ending", data.ending);
  if (captions) {
    add("youtube.title", captions.youtube?.title);
    add("youtube.description", captions.youtube?.description);
    (captions.youtube?.tags || []).forEach((t, i) => add(`youtube.tags[${i}]`, t));
    add("instagram", captions.instagram);
  }
  return out;
}

/**
 * `expectedEpisode` (an episode id) makes "not today's episode" an error too:
 * validate-content.mjs and generate-data.mjs pass nextEpisode(history, today),
 * so a routine that picked the wrong episode falls back to the right one.
 */
export function validateDailyContent(content, { today, expectedEpisode } = {}) {
  const errors = [];
  const warnings = [];
  if (!content || typeof content !== "object") {
    return { errors: ["content is not an object"], warnings };
  }
  if (!DATE_RE.test(String(content.date ?? ""))) errors.push(`date must be YYYY-MM-DD (got ${quote(content.date)})`);
  if (today && content.date !== today) errors.push(`date ${quote(content.date)} is not today (${today})`);
  if (!FORMATS.includes(content.format)) {
    errors.push(`format must be one of ${FORMATS.join(", ")} (got ${quote(content.format)})`);
    return { errors, warnings };
  }
  validateLesson(content.lesson, errors, "lesson");
  if (expectedEpisode && content.lesson?.episode !== expectedEpisode) {
    errors.push(`lesson.episode ${quote(content.lesson?.episode)} is not today's episode ${quote(expectedEpisode)} (node scripts/next-episode.mjs)`);
  }

  if (errors.length === 0) {
    const data = buildCardsData(content, { dateDisplay: "" });
    const total = narrationLength(data);
    if (total > LIMITS.narrationTotal) {
      errors.push(`narration is ${total} chars in total (max ${LIMITS.narrationTotal}); shorten the narration fields`);
    }
    const captions = buildCardCaptions(data, String(content.date).replace(/-/g, "/"));
    const published = collectPublishedTexts(data, captions);
    for (const [label, text] of published) {
      const num = recipeNumberReason(text);
      if (num) errors.push(`${label} must not carry a recipe number — ${num}: ${quote(text)}`);
    }
    for (const hit of scanBannedTerms(published)) {
      errors.push(`${hit.label} must not say ${JSON.stringify(hit.term)} — ${hit.why}: ${quote(hit.text)}`);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Fallback (routine missing / invalid): the curriculum's own lesson
// ---------------------------------------------------------------------------

export class NoLessonError extends Error {}

/**
 * The fallback content for one curriculum episode: its evergreen lesson,
 * tagged with the episode id. generate-data.mjs picks the episode with
 * episodeQueue (the one after the last aired), so a day the routine misses
 * still moves the series forward by exactly one episode instead of jumping
 * off-series (owner request 2026-09-25: 「1個1個見ていったら分かる」).
 */
export function fallbackLessonContent(episode, isoDate) {
  if (!episode?.lesson) throw new NoLessonError("data/curriculum.json has no episode to air");
  return {
    date: isoDate,
    format: "brew-lesson",
    trial: TRIAL_ID,
    fallback: true,
    lesson: { episode: episode.id, ...structuredClone(episode.lesson) },
  };
}

// ---------------------------------------------------------------------------
// Slides + narration
// ---------------------------------------------------------------------------

function pick(custom, fallback) {
  return typeof custom === "string" && custom.trim() ? custom.trim() : fallback;
}

// ---------------------------------------------------------------------------
// CTA — audience growth, not sales.
//
// Owner decision 2026-09-22: the shop's EC is not finished and naming a coffee
// nobody owns does not help, so the channel asks for a save and a follow and
// nothing else. No purchase / wholesale / DM line, no shop name, no handle.
// The sales CTA comes back (with the lineup) when the shop reopens the
// promotion phase — see docs/strategy.md 「販促フェーズに戻すとき」.
// ---------------------------------------------------------------------------

export function growthCtaSlideLines() {
  return ["保存して、淹れる前に見返す", "フォローで、明日もひとつ持ち帰る"];
}

export function growthCtaCaptionLines() {
  return [
    "――",
    "毎朝ひとつ、今日から試せる抽出のコツを出しています。",
    "保存しておくと、淹れる前にすぐ見返せます。",
    "フォローすると、明日もひとつ持ち帰れます。",
  ];
}

export function buildLessonSlides(content, { dateDisplay = "" } = {}) {
  const r = content.lesson;
  const method = METHODS[r.method];
  const pillarLabel = PILLARS[r.pillar];
  const nar = r.narration || {};

  const episode = episodeById(r.episode);
  const number = episode ? episodeNumber(episode.id) : null;
  const term = episode?.term;
  const next = episode ? followingEpisode(episode.id) : undefined;
  const heading = term ? `用語「${term}」` : pillarLabel;
  const question = `${r.word}${r.ask}`;
  const [one, other] = r.effect;

  const slides = [
    // Cover: one big word + the question, and what it does to the taste. It is
    // the grid thumbnail (IG takes frame 45), so it names the topic at a glance.
    {
      kind: "lesson-title",
      heading,
      episode: r.episode,
      pillar: r.pillar,
      series: number ? `${number.level} 第${number.no}回` : "",
      date: dateDisplay,
      word: r.word,
      ask: r.ask,
      topic: r.topic,
      methodLabel: method.label,
      sceneLabel: SCENES[r.scene],
      narration: pick(nar.title, `${term ? `今日の用語は、${term}。` : ""}${question}${r.topic}。`),
    },
    // Why: the one change and the reason behind it.
    {
      kind: "lesson-why",
      heading: "なぜ変わる？",
      hook: r.hook,
      why: r.why,
      core: r.core,
      motion: structuredClone(r.motion),
      sides: r.effect.map((e) => ({ label: e.label, taste: e.taste })),
      narration: pick(nar.why, `${r.hook}と、なぜ味が変わるのか。${r.why}。`),
    },
    // The diagram: the change, drawn (src/cards/Diagrams.tsx).
    {
      kind: "lesson-visual",
      heading: VISUAL_TYPES[r.visual.type],
      visual: structuredClone(r.visual),
      narration: pick(nar.visual, `${r.visual.caption}。`),
    },
    // Both ways: this is what lets a viewer steer the taste themselves.
    {
      kind: "lesson-effect",
      heading: "味はこう変わる",
      sides: [
        { label: one.label, taste: one.taste },
        { label: other.label, taste: other.taste },
      ],
      narration: pick(nar.effect, `${one.label}と、${one.taste}。${other.label}と、${other.taste}。`),
    },
    {
      kind: "lesson-tips",
      heading: "うまくいかない時",
      tips: r.tips.map((t) => ({ problem: t.problem, fix: t.fix })),
      narration: pick(nar.tips, r.tips.slice(0, 2).map((t) => `${t.problem}は、${t.fix}。`).join("")),
    },
  ];

  const ending = {
    kind: "lesson-cta",
    heading: "保存して、次に淹れる時に試そう",
    topic: r.topic,
    lead: "毎朝ひとつ、味を動かすコツ",
    lines: growthCtaSlideLines(),
    // The series teaser: tomorrow's cover question, so a follow has a reason.
    next: next ? `${next.lesson.word}${next.lesson.ask}` : "",
    narration: pick(
      nar.cta,
      next
        ? `保存して、次に淹れる時に試してください。次回は、${next.term ? `用語、${next.term}` : next.lesson.hook}。フォローで明日も届きます。`
        : "保存して、次に淹れる時に試してみてください。フォローすると、明日もひとつ持ち帰れます。"
    ),
  };

  return { slides, ending, topicTitle: `${pillarLabel}｜${question}` };
}

/**
 * Build output/trending-data.json. `projects` mirrors the slides so
 * scripts/generate-audio.mjs keeps producing project-N.mp3.
 */
export function buildCardsData(content, { dateDisplay = "" } = {}) {
  const built = buildLessonSlides(content, { dateDisplay });
  for (const s of [...built.slides, built.ending]) s.narration = toSpokenJa(s.narration);
  const projects = built.slides.map((s, i) => ({
    rank: i + 1,
    name: s.heading,
    fullName: s.kind,
    description: "",
    detail: "",
    narration: s.narration,
    category: s.kind,
    url: "",
  }));
  return {
    format: content.format,
    trial: content.trial || TRIAL_ID,
    fallback: Boolean(content.fallback),
    date: content.date,
    slides: built.slides,
    ending: built.ending,
    projects,
    endingNarration: built.ending.narration,
    topicTitle: built.topicTitle,
    lesson: content.lesson,
  };
}

export function narrationLength(data) {
  return data.slides.reduce((sum, s) => sum + charLen(s.narration), 0) + charLen(data.ending?.narration);
}

/** Template-only narration (used when the routine's narration makes the video too long). */
export function withTemplateNarration(content) {
  const copy = structuredClone(content);
  if (copy.lesson) delete copy.lesson.narration;
  return copy;
}

// ---------------------------------------------------------------------------
// Timeline (frames) — single source of truth, passed to Remotion as props
// ---------------------------------------------------------------------------
export const TIMELINE = {
  fps: 30,
  padFrames: 15, // 0.5s after narration
  minFirstSlideSec: 4.5, // the cover: one word, the question and the taste line
  minSlideSec: 4.5, // dense cards need reading time even if narration is short
  endingExtraFrames: 30,
  minEndingSec: 3.5,
  maxSeconds: 58, // IG Reels rejects > 60s (ProcessingFailedError)
};

export function computeCardTimeline(audioDurations, slideCount, opts = TIMELINE) {
  const { fps, padFrames, minFirstSlideSec, minSlideSec, endingExtraFrames, minEndingSec } = { ...TIMELINE, ...opts };
  const slides = [];
  for (let i = 1; i <= slideCount; i++) {
    const sec = audioDurations?.[`project-${i}`] || 0;
    const minSec = i === 1 ? minFirstSlideSec : minSlideSec;
    slides.push(Math.max(Math.ceil(sec * fps) + padFrames, Math.ceil(minSec * fps)));
  }
  const endingSec = audioDurations?.ending || 0;
  const ending = Math.max(Math.ceil(endingSec * fps) + endingExtraFrames, Math.ceil(minEndingSec * fps));
  const total = slides.reduce((a, b) => a + b, 0) + ending;
  return { fps, slides, ending, total, seconds: total / fps };
}

// ---------------------------------------------------------------------------
// Captions (the save / follow CTA is fixed at the end)
// ---------------------------------------------------------------------------

// Instagram IG User Media: caption ≤ 2200 characters, 30 hashtags, 20 @ tags.
// (YouTube title/description limits: youtube-limits.mjs.)
const IG_CAPTION_MAX_CHARS = 2200;

/** Join body + tail, dropping body lines from the end until it fits — the CTA tail always stays last. */
export function fitWithTail(bodyLines, tailLines, measure, max) {
  const body = [...bodyLines];
  const text = () => [...body, ...tailLines].join("\n");
  while (body.length > 0 && measure(text()) > max) body.pop();
  return text();
}

function hashtagsFor(data) {
  const method = METHODS[data.lesson?.method];
  const tags = ["#コーヒーの淹れ方", "#ハンドドリップ", method ? `#${method.hashtag}` : null];
  if (data.lesson?.scene === "iced") tags.push("#アイスコーヒー");
  tags.push("#おうちカフェ", "#コーヒーのある暮らし", "#抽出", "#コーヒー");
  return [...new Set(tags.filter(Boolean))];
}

function lessonBodyLines(data) {
  const find = (kind) => data.slides.find((s) => s.kind === kind);
  const title = find("lesson-title");
  const why = find("lesson-why");
  const visual = find("lesson-visual");
  const effect = find("lesson-effect");
  const tips = find("lesson-tips");
  const series = title.series ? [`シリーズ「${CURRICULUM.series}」${title.series}`] : [];
  const next = data.ending?.next ? ["", `次回：${data.ending.next}`] : [];
  return [
    ...series,
    `【${title.heading}】${title.word}${title.ask}`,
    `→ ${title.topic}`,
    "",
    "■ なぜ変わる？",
    `${why.hook}と、${why.why}`,
    "",
    "■ 味はこう変わる",
    ...effect.sides.map((s) => `・${s.label} → ${s.taste}`),
    `（${visual.visual.caption}）`,
    "",
    "■ うまくいかない時",
    ...tips.tips.map((t) => `・${t.problem} → ${t.fix}`),
    "",
    "豆も道具も手持ちのもので大丈夫。1つだけ変えて、味の違いを比べてみてください。",
    ...next,
  ];
}

export function buildCardCaptions(data, dateSlash) {
  const hashtags = hashtagsFor(data);
  const body = lessonBodyLines(data);
  const cta = growthCtaCaptionLines();

  const t = data.slides[0];
  const title = youtubeTitle(`【${t.heading}】`, `${t.word}${t.ask}`, ` ${t.topic} #Shorts`);

  const bodyWithTags = [...body, "", hashtags.join(" ")];
  const tail = ["", ...cta];
  const ytDescription = fitWithTail(
    bodyWithTags.map(youtubeSafe),
    tail.map(youtubeSafe),
    (s) => Buffer.byteLength(s, "utf8"),
    YT_DESCRIPTION_MAX_BYTES
  );
  const instagram = fitWithTail(bodyWithTags, tail, charLen, IG_CAPTION_MAX_CHARS);

  return {
    youtube: {
      title,
      titleTemplate: data.format,
      description: ytDescription,
      tags: [...hashtags, "#Shorts"].map((h) => h.replace(/^#/, "")),
      categoryId: "26", // Howto & Style
    },
    instagram,
    dateSlash,
  };
}

// ---------------------------------------------------------------------------
// performance-history entry summary
// ---------------------------------------------------------------------------

export function contentRecord(data) {
  if (!data?.format) return null;
  const r = data.lesson || {};
  return {
    format: "brew-lesson",
    trial: data.trial || TRIAL_ID,
    fallback: Boolean(data.fallback),
    episode: r.episode || null,
    pillar: r.pillar || null,
    topic: r.topic || null,
    method: r.method || null,
    scene: r.scene || null,
    tipProblems: (r.tips || []).map((t) => t.problem),
  };
}
