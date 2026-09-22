/**
 * 「今日の抽出メモ」 — generic brewing-knowledge cards.
 *
 * One format only: `brew-lesson`. Every day teaches one adjustable variable of
 * home brewing (water temperature, grind, ratio, time, pouring, gear, fixing a
 * bad cup, brewing without gear) with numbers anyone can copy.
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
 *
 * Numeric guidance (temperature, ratio, extraction yield) follows the SCA
 * brewing standard — see docs/strategy.md 「数値の根拠」.
 */

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
};

// Display limits derived from the 1080x1920 layout (outer margin 80px, card
// padding 40px → 840px text width; CJK glyph ≈ 1em). Body text never goes
// below 30px, so long strings must be shortened, not shrunk.
export const LIMITS = {
  hook: 16, // 80px title, up to 2 lines — the question of the day
  topic: 18, // 52px accent line — the answer in one line
  why: 30, // 36px under the accent line — why it happens
  grind: 4, // 48px inside a 3-column number tile
  stepAction: 8, // 44px in a row with time + amount
  tasteNote: 10,
  tasteSummary: 24,
  tipProblem: 10, // pill, 36px
  tipFix: 24, // 46px, up to 2 lines
  narrationTotal: 260, // IG Reels rejects > 60s videos
};

// Cold brew is a food-safety case: it steeps for hours, so it must steep in
// the fridge (1-10℃) for 6-24 hours and the steps must say so. A room
// temperature steep over several days must never validate.
export const COLD_BREW = { minHours: 6, maxHours: 24, minTempC: 1, maxTempC: 10, fridgeWord: "冷蔵庫" };

// Sanity bounds per method — wider than the routine prompt's guideline ranges
// (docs/routine-prompt.md 2-4), so a creative but brewable lesson passes and a
// broken one does not. ratio = (water + ice) ÷ beans, time in seconds, water =
// what is poured into the brewer (hot water, or cold water for cold brew).
const POUR_OVER_BOUNDS = { ratio: [12, 18], time: [90, 360], water: [100, 600] };
export const METHOD_BOUNDS = {
  v60: POUR_OVER_BOUNDS,
  "kalita-wave": POUR_OVER_BOUNDS,
  origami: POUR_OVER_BOUNDS,
  "paper-drip": POUR_OVER_BOUNDS,
  chemex: { ratio: [12, 18], time: [180, 420], water: [250, 1200] },
  clever: { ratio: [12, 18], time: [120, 360], water: [150, 500] },
  "french-press": { ratio: [12, 18], time: [180, 900], water: [150, 1000] },
  aeropress: { ratio: [10, 20], time: [45, 300], water: [60, 600] }, // e.g. 11g / 200g = 1:18.2
  "mug-steep": { ratio: [12, 18], time: [180, 600], water: [150, 500] },
  "cold-brew": { ratio: [5, 15], time: [COLD_BREW.minHours * 3600, COLD_BREW.maxHours * 3600], water: [150, 1200] },
  "moka-pot": { ratio: [5, 12], time: [90, 480], water: [60, 500] },
};
// Iced (flash-brewed onto ice, not cold brew): the ice is part of the ratio.
export const ICED_BOUNDS = { ratio: [10, 16], iceShare: [0.25, 0.6] };

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

export function isValidTime(t) {
  return TIME_RE.test(String(t ?? "")) || HOURS_RE.test(String(t ?? ""));
}

/** "2:30" → 150, "10h" → 36000, anything else → null. */
export function timeSeconds(t) {
  const s = String(t ?? "");
  const h = s.match(HOURS_RE);
  if (h) return Math.round(Number(h[1]) * 3600);
  const m = s.match(TIME_RE);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
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

export function ratioLabel(numbers) {
  const dose = numbers?.dose_g;
  const total = (numbers?.water_g || 0) + (numbers?.ice_g || 0);
  if (!isNum(dose) || dose <= 0 || total <= 0) return "";
  const r = Math.round((total / dose) * 10) / 10;
  return `1:${Number.isInteger(r) ? r : r.toFixed(1)}`;
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

const fmtSec = (sec) => (sec >= 3600 ? `${sec / 3600}h` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);


/** Every text of a lesson that reaches the cards, captions or narration: [label, value]. */
function lessonTexts(lesson, prefix) {
  const out = [];
  const add = (label, v) => typeof v === "string" && out.push([label, v]);
  add(`${prefix}.hook`, lesson.hook);
  add(`${prefix}.topic`, lesson.topic);
  add(`${prefix}.why`, lesson.why);
  add(`${prefix}.numbers.grind`, lesson.numbers?.grind);
  (Array.isArray(lesson.steps) ? lesson.steps : []).forEach((s, i) => add(`${prefix}.steps[${i}].action`, s?.action));
  (Array.isArray(lesson.taste?.notes) ? lesson.taste.notes : []).forEach((v, i) => add(`${prefix}.taste.notes[${i}]`, v));
  add(`${prefix}.taste.summary`, lesson.taste?.summary);
  (Array.isArray(lesson.tips) ? lesson.tips : []).forEach((t, i) => {
    add(`${prefix}.tips[${i}].problem`, t?.problem);
    add(`${prefix}.tips[${i}].fix`, t?.fix);
  });
  const nar = lesson.narration && typeof lesson.narration === "object" ? lesson.narration : {};
  // keys are untrusted too: quoted, so a key cannot carry a line break into the log
  for (const [k, v] of Object.entries(nar)) add(`${prefix}.narration[${quote(k)}]`, v);
  return out;
}

// Kept under the old name inside this module so the numeric block below reads
// the same as before; `recipe` here is the lesson's brewing block.
const recipeTexts = lessonTexts;

export function validateLesson(recipe, errors, prefix = "lesson") {
  if (!recipe || typeof recipe !== "object") {
    errors.push(`${prefix} block is required`);
    return;
  }
  if (recipe.beanId != null) {
    errors.push(`${prefix}.beanId is not allowed — this channel never names a coffee of its own (owner decision 2026-09-22)`);
  }
  if (!own(PILLARS, recipe.pillar)) {
    errors.push(`${prefix}.pillar must be one of ${Object.keys(PILLARS).join(", ")}`);
  }
  if (!own(METHODS, recipe.method)) {
    errors.push(`${prefix}.method ${quote(recipe.method)} must be one of ${Object.keys(METHODS).join(", ")}`);
  }
  if (!own(SCENES, recipe.scene)) errors.push(`${prefix}.scene must be "hot" or "iced"`);
  if (recipe.method === "cold-brew" && recipe.scene !== "iced") errors.push(`${prefix}.scene must be "iced" for cold-brew`);
  if (recipe.sources != null && !Array.isArray(recipe.sources)) errors.push(`${prefix}.sources must be an array of URLs`);
  const sources = Array.isArray(recipe.sources) ? recipe.sources : [];
  sources.forEach((u, i) => {
    if (!isSafeHttpsUrl(u)) errors.push(`${prefix}.sources[${i}] must be an https URL`);
  });
  checkLen(errors, `${prefix}.hook`, recipe.hook, LIMITS.hook);
  checkLen(errors, `${prefix}.topic`, recipe.topic, LIMITS.topic);
  checkLen(errors, `${prefix}.why`, recipe.why, LIMITS.why);

  const n = recipe.numbers || {};
  const coldBrew = recipe.method === "cold-brew";
  const iced = recipe.scene === "iced" && !coldBrew;
  const bounds = own(METHOD_BOUNDS, recipe.method);
  const methodName = own(METHODS, recipe.method)?.label || String(recipe.method);
  if (!isNum(n.dose_g) || n.dose_g < 5 || n.dose_g > 80) errors.push(`${prefix}.numbers.dose_g must be 5-80`);
  if (!isNum(n.water_g) || n.water_g < 20 || n.water_g > 1200) {
    errors.push(`${prefix}.numbers.water_g must be 20-1200`);
  } else if (bounds && (n.water_g < bounds.water[0] || n.water_g > bounds.water[1])) {
    errors.push(`${prefix}.numbers.water_g ${n.water_g}g is outside ${bounds.water[0]}-${bounds.water[1]}g for ${methodName}`);
  }
  if (coldBrew) {
    if (!isNum(n.temp_c) || n.temp_c < COLD_BREW.minTempC || n.temp_c > COLD_BREW.maxTempC) {
      errors.push(
        `${prefix}.numbers.temp_c must be ${COLD_BREW.minTempC}-${COLD_BREW.maxTempC} for cold-brew (the fridge temperature — never steep at room temperature)`
      );
    }
  } else if (!isNum(n.temp_c) || n.temp_c < 60 || n.temp_c > 100) {
    errors.push(`${prefix}.numbers.temp_c must be 60-100`);
  }
  if (iced && (!isNum(n.ice_g) || n.ice_g <= 0)) {
    errors.push(`${prefix}.numbers.ice_g is required for iced recipes`);
  }
  if (coldBrew && n.ice_g != null) errors.push(`${prefix}.numbers.ice_g must be omitted for cold-brew (the ratio is water ÷ beans)`);
  if (recipe.scene === "hot" && n.ice_g != null && n.ice_g !== 0) errors.push(`${prefix}.numbers.ice_g is only for iced recipes`);
  if (n.ice_g != null && (!isNum(n.ice_g) || n.ice_g < 0 || n.ice_g > 600)) errors.push(`${prefix}.numbers.ice_g must be 0-600`);
  // Cold brew steeps for hours ("10h"); every other method is "m:ss" — a cold
  // brew "8:00" would be printed and read aloud as 8 minutes.
  const totalSec = timeSeconds(n.time);
  if (coldBrew ? !HOURS_RE.test(String(n.time ?? "")) : !TIME_RE.test(String(n.time ?? ""))) {
    errors.push(`${prefix}.numbers.time must be ${coldBrew ? '"<hours>h" for cold-brew' : '"m:ss"'} (got ${quote(n.time)})`);
  } else if (coldBrew && (totalSec < COLD_BREW.minHours * 3600 || totalSec > COLD_BREW.maxHours * 3600)) {
    errors.push(`${prefix}.numbers.time must be ${COLD_BREW.minHours}h-${COLD_BREW.maxHours}h for cold-brew (steep in the fridge)`);
  } else if (bounds && !coldBrew && (totalSec < bounds.time[0] || totalSec > bounds.time[1])) {
    errors.push(`${prefix}.numbers.time ${n.time} is outside ${fmtSec(bounds.time[0])}-${fmtSec(bounds.time[1])} for ${methodName}`);
  }
  checkLen(errors, `${prefix}.numbers.grind`, n.grind, LIMITS.grind);
  if (isNum(n.dose_g) && isNum(n.water_g) && n.dose_g > 0 && bounds) {
    const total = n.water_g + (iced && isNum(n.ice_g) ? n.ice_g : 0);
    const ratio = total / n.dose_g;
    const [lo, hi] = iced ? ICED_BOUNDS.ratio : bounds.ratio;
    if (ratio < lo || ratio > hi) {
      errors.push(`${prefix}.numbers ratio 1:${ratio.toFixed(1)} is outside 1:${lo}-1:${hi} for ${iced ? `iced ${methodName}` : methodName}`);
    }
    if (iced && isNum(n.ice_g) && n.ice_g > 0) {
      const share = n.ice_g / total;
      const [slo, shi] = ICED_BOUNDS.iceShare;
      if (share < slo || share > shi) {
        errors.push(`${prefix}.numbers.ice_g is ${Math.round(share * 100)}% of water + ice (keep it ${slo * 100}-${shi * 100}%)`);
      }
    }
  }

  const steps = recipe.steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 5) {
    errors.push(`${prefix}.steps must have 1-5 items`);
  } else {
    let prevSec = null;
    let lastPour = null;
    steps.forEach((s, i) => {
      const sec = timeSeconds(s?.time);
      if (sec == null) {
        errors.push(`${prefix}.steps[${i}].time must be "m:ss" or "<hours>h"`);
      } else {
        if (prevSec != null && sec < prevSec) errors.push(`${prefix}.steps[${i}].time ${s.time} is earlier than the step before it`);
        if (totalSec != null && sec > totalSec) errors.push(`${prefix}.steps[${i}].time ${s.time} is after numbers.time ${n.time}`);
        prevSec = sec;
      }
      checkLen(errors, `${prefix}.steps[${i}].action`, s?.action, LIMITS.stepAction);
      if (s?.pour_to_g != null) {
        if (!isNum(s.pour_to_g) || s.pour_to_g <= 0) {
          errors.push(`${prefix}.steps[${i}].pour_to_g must be a positive number`);
        } else {
          if (lastPour != null && s.pour_to_g <= lastPour) {
            errors.push(`${prefix}.steps[${i}].pour_to_g ${s.pour_to_g}g must be more than the pour before it (${lastPour}g) — it is the scale total`);
          }
          lastPour = s.pour_to_g;
        }
      }
    });
    if (lastPour == null) {
      errors.push(`${prefix}.steps need at least one pour_to_g (the scale total after pouring)`);
    } else if (isNum(n.water_g) && Math.abs(lastPour - n.water_g) > 2) {
      errors.push(`${prefix}.steps: last pour_to_g (${lastPour}g) must equal numbers.water_g (${n.water_g}g)`);
    }
    if (coldBrew && !steps.some((s) => String(s?.action ?? "").includes(COLD_BREW.fridgeWord))) {
      errors.push(`${prefix}.steps must say "${COLD_BREW.fridgeWord}" for cold-brew (e.g. "冷蔵庫で寝かせる") — it steeps in the fridge`);
    }
  }
  // every recipe, not only cold-brew: a hot recipe's tip can describe a cold brew too
  for (const [label, value] of recipeTexts(recipe, prefix)) {
    const reason = unsafeSteepReason(value);
    if (reason) errors.push(`${label} describes an unsafe steep (${reason}): ${quote(value)}`);
  }
  const nar = recipe.narration;
  if (nar != null && (typeof nar !== "object" || Array.isArray(nar))) errors.push(`${prefix}.narration must be an object`);
  for (const [label, value] of recipeTexts(recipe, prefix)) {
    if (label.startsWith(`${prefix}.narration[`)) checkText(errors, label, value);
  }

  const t = recipe.taste || {};
  if (!Array.isArray(t.notes) || t.notes.length < 1 || t.notes.length > 4) {
    errors.push(`${prefix}.taste.notes must have 1-4 items`);
  } else {
    t.notes.forEach((note, i) => checkLen(errors, `${prefix}.taste.notes[${i}]`, note, LIMITS.tasteNote));
  }
  checkLen(errors, `${prefix}.taste.summary`, t.summary, LIMITS.tasteSummary);
  for (const k of ["acidity", "sweetness", "body"]) {
    if (!Number.isInteger(t[k]) || t[k] < 1 || t[k] > 5) errors.push(`${prefix}.taste.${k} must be an integer 1-5`);
  }

  const tips = recipe.tips;
  if (!Array.isArray(tips) || tips.length < 2 || tips.length > 3) {
    errors.push(`${prefix}.tips must have 2-3 items`);
  } else {
    tips.forEach((tip, i) => {
      checkLen(errors, `${prefix}.tips[${i}].problem`, tip?.problem, LIMITS.tipProblem);
      checkLen(errors, `${prefix}.tips[${i}].fix`, tip?.fix, LIMITS.tipFix);
    });
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

export function validateDailyContent(content, { today } = {}) {
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

  if (errors.length === 0) {
    const data = buildCardsData(content, { dateDisplay: "" });
    const total = narrationLength(data);
    if (total > LIMITS.narrationTotal) {
      errors.push(`narration is ${total} chars in total (max ${LIMITS.narrationTotal}); shorten the narration fields`);
    }
    const captions = buildCardCaptions(data, String(content.date).replace(/-/g, "/"));
    for (const hit of scanBannedTerms(collectPublishedTexts(data, captions))) {
      errors.push(`${hit.label} must not say ${JSON.stringify(hit.term)} — ${hit.why}: ${quote(hit.text)}`);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Fallback (routine missing / invalid): the evergreen lesson pack
// ---------------------------------------------------------------------------

export function dayIndex(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Math.floor(d.getTime() / 86_400_000);
}


export class NoLessonError extends Error {}

/**
 * The evergreen lesson of the day from data/brew-lessons.json, rotated by date.
 * `previous` is the last posted lesson ({ pillar, method }): a lesson that
 * would repeat its pillar or method on consecutive days is skipped when
 * another one is available. The pack is a plain data file with no beans in it,
 * so a routine outage still posts generic knowledge (owner decision 2026-09-22).
 */
export function fallbackLessonContent(pack, isoDate, previous = null) {
  const lessons = Array.isArray(pack?.lessons) ? pack.lessons : [];
  if (lessons.length === 0) throw new NoLessonError("data/brew-lessons.json has no lessons");
  const start = ((dayIndex(isoDate) % lessons.length) + lessons.length) % lessons.length;
  const rotated = lessons.map((_, i) => lessons[(start + i) % lessons.length]);
  const lesson =
    rotated.find((l) => l.pillar !== previous?.pillar && l.method !== previous?.method) ||
    rotated.find((l) => l.pillar !== previous?.pillar) ||
    rotated[0];
  return { date: isoDate, format: "brew-lesson", trial: TRIAL_ID, fallback: true, lesson };
}

// ---------------------------------------------------------------------------
// Slides + narration
// ---------------------------------------------------------------------------

function pick(custom, fallback) {
  return typeof custom === "string" && custom.trim() ? custom.trim() : fallback;
}

/**
 * Six number tiles for the first card (3x2 grid). Iced pour-over shows the
 * ice amount instead of the ratio (the ratio stays in the caption).
 */
export function lessonNumberTiles(recipe) {
  const n = recipe.numbers;
  const coldBrew = recipe.method === "cold-brew";
  const tiles = [
    { label: "粉", value: String(n.dose_g), unit: "g" },
    { label: coldBrew ? "水" : "お湯", value: String(n.water_g), unit: "g" },
  ];
  if (recipe.scene === "iced" && !coldBrew && isNum(n.ice_g) && n.ice_g > 0) {
    tiles.push({ label: "氷", value: String(n.ice_g), unit: "g" });
  }
  // Cold brew shows where it steeps (the fridge) — its temperature is the fridge's.
  tiles.push({ label: coldBrew ? "冷蔵庫" : "湯温", value: isNum(n.temp_c) ? String(n.temp_c) : "—", unit: isNum(n.temp_c) ? "℃" : "" });
  const hours = String(n.time).match(HOURS_RE);
  tiles.push({ label: coldBrew ? "抽出" : "時間", value: hours ? hours[1] : String(n.time), unit: hours ? "時間" : "" });
  tiles.push({ label: "挽き目", value: n.grind, unit: "" });
  const ratio = ratioLabel(n);
  // "1対15", never "1:15" — next to a "2:30" time tile a colon ratio reads as a time.
  if (tiles.length < 6 && ratio) tiles.push({ label: "比率", value: ratio.replace(":", "対"), unit: "" });
  return tiles;
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
  const n = r.numbers;
  const nar = r.narration || {};
  const iced = r.scene === "iced";
  const coldBrew = r.method === "cold-brew";

  // Card 1 = the question + the answer + all key numbers, so the first frame is
  // already the "save this" card (numbers first, like AI Trend Daily's TOP5).
  const titleNarration = pick(nar.title, `${r.hook}。${r.topic}。${r.why}。`);
  const numbersNarration = pick(
    nar.numbers,
    `${method.label}で、粉${n.dose_g}グラムに、${coldBrew ? "水" : "お湯"}${n.water_g}グラム` +
      (iced && isNum(n.ice_g) && !coldBrew ? `、氷${n.ice_g}グラム` : "") +
      "。" +
      (coldBrew ? `冷蔵庫で${speakTime(n.time)}です。` : `${n.temp_c}度で、${speakTime(n.time)}です。`)
  );

  const slides = [
    {
      kind: "lesson-title",
      heading: pillarLabel,
      date: dateDisplay,
      topic: r.topic,
      why: r.why,
      methodLabel: method.label,
      sceneLabel: SCENES[r.scene],
      hook: r.hook,
      tiles: lessonNumberTiles(r),
      narration: `${titleNarration}${numbersNarration}`,
    },
    {
      kind: "lesson-steps",
      heading: "手順",
      steps: r.steps.map((s) => ({
        time: s.time,
        action: s.action,
        amount: isNum(s.pour_to_g) ? `${s.pour_to_g}g` : "",
      })),
      narration: pick(nar.steps, `手順は${r.steps.length}ステップ。画面を保存しておくと便利です。`),
    },
    {
      kind: "lesson-taste",
      heading: "こう変わる",
      notes: r.taste.notes,
      summary: r.taste.summary,
      meters: [
        { label: "酸味", value: r.taste.acidity },
        { label: "甘み", value: r.taste.sweetness },
        { label: "コク", value: r.taste.body },
      ],
      narration: pick(nar.taste, `味は、${r.taste.notes.join("、")}。${r.taste.summary}。`),
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
    lead: "毎朝ひとつ、今日から試せる抽出のコツ",
    lines: growthCtaSlideLines(),
    narration: pick(nar.cta, "保存して、次に淹れる時に試してみてください。フォローすると、明日もひとつ持ち帰れます。"),
  };

  return { slides, ending, topicTitle: `${pillarLabel}｜${r.hook}` };
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
  minFirstSlideSec: 6, // hook + answer + six numbers
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
  const r = data.lesson;
  const title = data.slides.find((s) => s.kind === "lesson-title");
  const steps = data.slides.find((s) => s.kind === "lesson-steps");
  const taste = data.slides.find((s) => s.kind === "lesson-taste");
  const tips = data.slides.find((s) => s.kind === "lesson-tips");
  const tileText = title.tiles.map((t) => `${t.label} ${t.value}${t.unit}`).join(" / ");
  const ratio = ratioLabel(r.numbers);
  const hasRatio = title.tiles.some((t) => t.label === "比率");
  return [
    `【${title.heading}】${title.hook}`,
    `${title.topic}｜${title.why}`,
    "",
    `■ 今日の数字（${title.methodLabel}・${title.sceneLabel}）`,
    tileText + (!hasRatio && ratio ? ` / 比率 ${ratio}` : ""),
    "",
    "■ 手順",
    ...steps.steps.map((s) => `${s.time} ${s.action}${s.amount ? ` ${s.amount}まで` : ""}`),
    "",
    "■ こう変わる",
    `${taste.notes.join("、")}｜${taste.summary}`,
    "",
    "■ うまくいかない時",
    ...tips.tips.map((t) => `・${t.problem} → ${t.fix}`),
    "",
    "使う豆は手持ちのもので大丈夫です。数字だけ真似してみてください。",
  ];
}

export function buildCardCaptions(data, dateSlash) {
  const hashtags = hashtagsFor(data);
  const body = lessonBodyLines(data);
  const cta = growthCtaCaptionLines();

  const t = data.slides[0];
  const n = data.lesson.numbers;
  const nums = (
    data.lesson.method === "cold-brew"
      ? [`粉${n.dose_g}g`, `冷蔵庫${n.time}`]
      : [`粉${n.dose_g}g`, Number.isFinite(n.temp_c) ? `${n.temp_c}℃` : null, n.time]
  )
    .filter(Boolean)
    .join("・");
  const title = youtubeTitle(`【${t.heading}】`, t.hook, `｜${nums} #Shorts`);

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
    pillar: r.pillar || null,
    topic: r.topic || null,
    method: r.method || null,
    scene: r.scene || null,
    tipProblems: (r.tips || []).map((t) => t.problem),
  };
}
