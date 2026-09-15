/**
 * "今日の一杯" recipe cards + weekly "世界のコーヒーニュース TOP5".
 *
 * Pure functions shared by:
 *   - scripts/generate-data.mjs     (content JSON → slides / narration)
 *   - scripts/generate-caption.mjs  (captions with the fixed sales CTA)
 *   - scripts/record-upload.mjs     (content summary for PDCA)
 *   - scripts/validate-content.mjs  (the morning routine's pre-commit check)
 *   - scripts/content-format.test.mjs
 *
 * data/enriched-coffee-news.json keeps its file name (the cross-account PDCA
 * routine and record-upload read it), but a `format` field now selects the
 * content type. A file without `format` (and without `recipe` / `newsTop5`)
 * is the legacy news explainer only when it has the legacy keys
 * (validateLegacyContent); anything else is rejected like invalid cards.
 *
 * The morning routine writes this JSON after reading the web and its PR is
 * merged without a human review, so every text that reaches a card, caption,
 * title or narration is validated as untrusted input (unsafeTextReason).
 */

import { YT_DESCRIPTION_MAX_BYTES, youtubeSafe, youtubeTitle } from "./youtube-limits.mjs";

// The YouTube limits live in youtube-limits.mjs (shared with the legacy captions).
export { youtubeSafe, youtubeTitle };

export const TRIAL_ID = "coffee-trial-1-recipe-card";
export const FORMATS = ["recipe", "news-top5"];

export const METHODS = {
  v60: { label: "V60", hashtag: "V60" },
  "kalita-wave": { label: "カリタウェーブ", hashtag: "カリタウェーブ" },
  origami: { label: "ORIGAMI", hashtag: "オリガミドリッパー" },
  chemex: { label: "ケメックス", hashtag: "ケメックス" },
  clever: { label: "クレバー", hashtag: "クレバードリッパー" },
  "french-press": { label: "フレンチプレス", hashtag: "フレンチプレス" },
  aeropress: { label: "エアロプレス", hashtag: "エアロプレス" },
  "cold-brew": { label: "水出し", hashtag: "水出しコーヒー" },
  "moka-pot": { label: "マキネッタ", hashtag: "マキネッタ" },
};

export const SCENES = { hot: "ホット", iced: "アイス" };

// Why this recipe today — the PDCA compares IG saves per angle.
export const ANGLES = {
  trouble: "悩み起点",
  season: "季節",
  bean: "豆の個性",
  method: "器具",
  expert: "名レシピ応用",
};

// Display limits derived from the 1080x1920 layout (outer margin 80px, card
// padding 40px → 840px text width; CJK glyph ≈ 1em). Body text never goes
// below 30px, so long strings must be shortened, not shrunk.
export const LIMITS = {
  hook: 16, // 80px title, up to 2 lines
  grind: 4, // 48px inside a 3-column number tile
  stepAction: 8, // 44px in a row with time + amount
  tasteNote: 10,
  tasteSummary: 24,
  tipProblem: 10, // pill, 36px
  tipFix: 24, // 46px, up to 2 lines
  headline: 26, // 48px, up to 2 lines
  newsNumber: 8,
  newsNumberLabel: 10,
  newsSummary: 40, // 34px, up to 2 lines
  newsSource: 30,
  narrationTotal: 260, // IG Reels rejects > 60s videos
};

// Cold brew is a food-safety case: it steeps for hours, so it must steep in
// the fridge (1-10℃) for 6-24 hours and the steps must say so. A room
// temperature steep over several days must never validate.
export const COLD_BREW = { minHours: 6, maxHours: 24, minTempC: 1, maxTempC: 10, fridgeWord: "冷蔵庫" };

// Sanity bounds per method — wider than the routine prompt's guideline ranges
// (docs/routine-prompt.md 2a-4), so a creative but brewable recipe passes and
// a broken one does not. ratio = (water + ice) ÷ beans, time in seconds,
// water = what is poured into the brewer (hot water, or cold water for cold brew).
const POUR_OVER_BOUNDS = { ratio: [12, 18], time: [90, 360], water: [100, 600] };
export const METHOD_BOUNDS = {
  v60: POUR_OVER_BOUNDS,
  "kalita-wave": POUR_OVER_BOUNDS,
  origami: POUR_OVER_BOUNDS,
  chemex: { ratio: [12, 18], time: [180, 420], water: [250, 1200] },
  clever: { ratio: [12, 18], time: [120, 360], water: [150, 500] },
  "french-press": { ratio: [12, 18], time: [180, 900], water: [150, 1000] },
  aeropress: { ratio: [10, 20], time: [45, 300], water: [60, 600] }, // e.g. 11g / 200g = 1:18.2
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
const STEEP_ALWAYS_UNSAFE_RE =
  /(?:常温|室温)(?:で|のまま|に置(?!か[ずな]))|冷蔵庫?(?:に|へ|で|は|を)?(?:入れ(?:ない|ず)|でなく|ではなく|じゃなく|不要|いらず|いらない|使わ(?:ない|ず)|しない|せず|なし|無し|抜き)|(?:no|without)\s+(?:fridge|refrigerat)/iu;
const STEEP_OUTSIDE_RE =
  /常温|室温|キッチン|台所|置いたまま|置きっぱなし|出しっぱなし|放置|一晩|ひと晩|一夜|夜通し|オーバーナイト|overnight|room\s*temp/iu;
const FRIDGE_RE = /冷蔵|fridge|refrigerat/iu;
const STEEP_DAYS_RE =
  /(?<![\d\u{6708}])\d+(?:\.\d+)?\s*日|[一二三四五六七八九十数何半丸]+日(?:間|半|以上|ほど|くらい|程度|かけ|置|浸|寝|漬|中|$)|\d\s*days?\b|\bdays?\b/iu;
const STEEP_HOURS_RE = /(\d+(?:\.\d+)?)\s*(?:時間|hours?|hrs?|h)(?![a-z])/giu;
// sentence ends: 。 ! ? line breaks, and "." before a space / the end (not decimals)
const SENTENCE_END_RE = /[\u{3002}!?\n]|\.(?=\s|$)/u;

/** Why a recipe text describes an unsafe steep (null = fine). */
export function unsafeSteepReason(value) {
  const s = String(value ?? "").normalize("NFKC");
  if (STEEP_ALWAYS_UNSAFE_RE.test(s)) return "room temperature or no fridge";
  if (STEEP_DAYS_RE.test(s)) return "a duration in days";
  for (const m of s.matchAll(STEEP_HOURS_RE)) {
    if (Number(m[1]) > 24) return "more than 24 hours";
  }
  for (const sentence of s.split(SENTENCE_END_RE)) {
    if (STEEP_OUTSIDE_RE.test(sentence) && !FRIDGE_RE.test(sentence)) return "outside the fridge (say 冷蔵庫 in the same sentence)";
  }
  return null;
}

function allowedNewsHosts(newsSources) {
  const list = Array.isArray(newsSources) ? newsSources : newsSources?.hosts;
  return (Array.isArray(list) ? list : [])
    .map((h) => String(typeof h === "string" ? h : (h?.host ?? "")).toLowerCase())
    .filter((h) => /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/u.test(h));
}

/**
 * Why a news URL may not be published (null = fine). The routine writes both
 * the item URLs and discovery.sources, so neither is trusted: https only, no
 * user name / password, no port, no IP address, and the host (or a subdomain
 * of it) must be an allowed news site in data/news-sources.json.
 */
export function newsUrlProblem(value, newsSources) {
  if (!isSafeHttpsUrl(value)) return "must be an https URL";
  const authority = value.slice("https://".length).split(/[/?#]/u)[0];
  if (authority.includes("@")) return "must not carry a user name or password";
  if (authority.startsWith("[")) return "must not be an IP address";
  if (authority.includes(":")) return "must not set a port";
  const host = new URL(value).hostname.toLowerCase();
  if (/^\d+(?:\.\d+){3}$/u.test(host)) return "must not be an IP address";
  const hosts = allowedNewsHosts(newsSources);
  if (hosts.length === 0) return "cannot be checked (data/news-sources.json is not loaded)";
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `host ${JSON.stringify(host)} is not an allowed news site (data/news-sources.json)`;
  }
  return null;
}

/** An https URL without whitespace, invisible characters or quotes/brackets. */
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

/** Sunday is the weekly news TOP5; every other day is a recipe card. */
export function expectedFormatFor(isoDate) {
  const d = new Date(`${isoDate}T12:00:00+09:00`);
  return d.getUTCDay() === 0 ? "news-top5" : "recipe";
}

/** Any bean that is not retired (rendering and captions — validation decides what may be posted). */
export function findBean(lineup, beanId) {
  return (lineup?.beans || []).find((b) => b.id === beanId && b.status !== "retired") || null;
}

/**
 * Beans that may be posted: status "confirmed" (the owner confirmed it by PR).
 * "candidate" beans are allowed only in dry runs (allowCandidate), so an
 * unconfirmed bean is never advertised.
 */
export function isPostableBean(bean, { allowCandidate = false } = {}) {
  return Boolean(bean) && (bean.status === "confirmed" || (allowCandidate && bean.status === "candidate"));
}

export function postableBeans(lineup, opts = {}) {
  return (lineup?.beans || []).filter((b) => isPostableBean(b, opts));
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

/** Every text of a recipe that reaches the cards, captions or narration: [label, value]. */
function recipeTexts(recipe, prefix) {
  const out = [];
  const add = (label, v) => typeof v === "string" && out.push([label, v]);
  add(`${prefix}.hook`, recipe.hook);
  add(`${prefix}.numbers.grind`, recipe.numbers?.grind);
  (Array.isArray(recipe.steps) ? recipe.steps : []).forEach((s, i) => add(`${prefix}.steps[${i}].action`, s?.action));
  (Array.isArray(recipe.taste?.notes) ? recipe.taste.notes : []).forEach((v, i) => add(`${prefix}.taste.notes[${i}]`, v));
  add(`${prefix}.taste.summary`, recipe.taste?.summary);
  (Array.isArray(recipe.tips) ? recipe.tips : []).forEach((t, i) => {
    add(`${prefix}.tips[${i}].problem`, t?.problem);
    add(`${prefix}.tips[${i}].fix`, t?.fix);
  });
  const nar = recipe.narration && typeof recipe.narration === "object" ? recipe.narration : {};
  // keys are untrusted too: quoted, so a key cannot carry a line break into the log
  for (const [k, v] of Object.entries(nar)) add(`${prefix}.narration[${quote(k)}]`, v);
  return out;
}

export function validateRecipe(recipe, lineup, errors, prefix = "recipe", { allowCandidate = false } = {}) {
  if (!recipe || typeof recipe !== "object") {
    errors.push(`${prefix} block is required`);
    return;
  }
  const bean = findBean(lineup, recipe.beanId);
  if (!bean) {
    const ids = postableBeans(lineup, { allowCandidate }).map((b) => b.id);
    errors.push(`${prefix}.beanId ${quote(recipe.beanId)} is not in data/coffee-lineup.json (${ids.join(", ") || "no postable bean"})`);
  } else if (!isPostableBean(bean, { allowCandidate })) {
    errors.push(
      `${prefix}.beanId "${bean.id}" has status "${bean.status}" in data/coffee-lineup.json — only "confirmed" beans are posted (the owner confirms beans by PR)`
    );
  }
  if (!own(METHODS, recipe.method)) {
    errors.push(`${prefix}.method ${quote(recipe.method)} must be one of ${Object.keys(METHODS).join(", ")}`);
  }
  if (!own(SCENES, recipe.scene)) errors.push(`${prefix}.scene must be "hot" or "iced"`);
  if (recipe.method === "cold-brew" && recipe.scene !== "iced") errors.push(`${prefix}.scene must be "iced" for cold-brew`);
  if (!own(ANGLES, recipe.angle)) {
    errors.push(`${prefix}.angle must be one of ${Object.keys(ANGLES).join(", ")}`);
  }
  if (recipe.sources != null && !Array.isArray(recipe.sources)) errors.push(`${prefix}.sources must be an array of URLs`);
  const sources = Array.isArray(recipe.sources) ? recipe.sources : [];
  sources.forEach((u, i) => {
    if (!isSafeHttpsUrl(u)) errors.push(`${prefix}.sources[${i}] must be an https URL`);
  });
  if (recipe.angle === "expert" && sources.length === 0) {
    errors.push(`${prefix}.sources is required when angle is "expert" (link the recipe it adapts)`);
  }
  checkLen(errors, `${prefix}.hook`, recipe.hook, LIMITS.hook);

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

function validateNewsTop5(content, errors, newsSources) {
  const d = content.discovery;
  const sources = d && Array.isArray(d.sources) ? d.sources : [];
  if (sources.length === 0) {
    errors.push("discovery.sources is required for news-top5");
  }
  sources.forEach((u, i) => {
    const problem = newsUrlProblem(u, newsSources);
    if (problem) errors.push(`discovery.sources[${i}] ${problem}`);
  });
  if (d && isNum(d.freshness_hours) && d.freshness_hours > 168) {
    errors.push(`discovery.freshness_hours ${d.freshness_hours} > 168 (news older than a week)`);
  }

  const block = content.newsTop5;
  if (!block || !Array.isArray(block.items) || block.items.length !== 5) {
    errors.push("newsTop5.items must have exactly 5 items");
    return;
  }
  if (block.weekLabel != null) checkText(errors, "newsTop5.weekLabel", block.weekLabel);
  block.items.forEach((item, i) => {
    const p = `newsTop5.items[${i}]`;
    if (item?.rank !== i + 1) errors.push(`${p}.rank must be ${i + 1}`);
    checkLen(errors, `${p}.headline`, item?.headline, LIMITS.headline);
    checkLen(errors, `${p}.summary`, item?.summary, LIMITS.newsSummary);
    checkLen(errors, `${p}.source`, item?.source, LIMITS.newsSource);
    if (item?.number != null && item.number !== "") {
      checkLen(errors, `${p}.number`, item.number, LIMITS.newsNumber);
      if (item.numberLabel != null) checkLen(errors, `${p}.numberLabel`, item.numberLabel, LIMITS.newsNumberLabel);
    }
    // The URL is printed in the captions: only an allowed news site, and only
    // a link the routine also listed as a discovery source.
    const problem = newsUrlProblem(item?.url, newsSources);
    if (problem) errors.push(`${p}.url ${problem}`);
    else if (!sources.includes(item.url)) errors.push(`${p}.url must be one of discovery.sources`);
  });
  const nar = block.narration && typeof block.narration === "object" ? block.narration : {};
  checkText(errors, "newsTop5.narration.intro", nar.intro);
  checkText(errors, "newsTop5.narration.cta", nar.cta);
  (Array.isArray(nar.items) ? nar.items : []).forEach((v, i) => checkText(errors, `newsTop5.narration.items[${i}]`, v));
}

// Keys the legacy news explainer (the pre-trial routine, still bundled in the
// trigger as the rollback path) always writes.
const LEGACY_ARTICLE_KEYS = ["title", "description", "narration"];

/**
 * A JSON without `format` / `recipe` / `newsTop5` is rendered as the legacy
 * news explainer only if it has the legacy keys; otherwise it is rejected
 * (it would skip every card check). Every legacy text that reaches the YouTube
 * title / description or the IG caption (title, description, detail, section
 * titles and descriptions — scripts/generate-caption.mjs) gets the URL / @ / #
 * check; invisible characters are rejected in every string.
 */
export function validateLegacyContent(content) {
  const errors = [];
  if (!content || typeof content !== "object") return { errors: ["content is not an object"] };
  if (!DATE_RE.test(String(content.date ?? ""))) errors.push(`date must be YYYY-MM-DD (got ${quote(content.date)})`);
  if (typeof content.discovery?.method !== "string" || !content.discovery.method.trim()) {
    errors.push("discovery.method is required (legacy news explainer)");
  }
  if (!Array.isArray(content.articles) || content.articles.length === 0) {
    errors.push("articles[] is required (legacy news explainer) — or set format to recipe / news-top5");
    return { errors };
  }
  content.articles.forEach((a, i) => {
    const p = `articles[${i}]`;
    if (!Number.isInteger(a?.rank)) errors.push(`${p}.rank must be an integer`);
    for (const k of LEGACY_ARTICLE_KEYS) {
      if (typeof a?.[k] !== "string" || !a[k].trim()) errors.push(`${p}.${k} is required`);
    }
    for (const k of ["title", "description", "detail"]) checkText(errors, `${p}.${k}`, a?.[k]);
    // tags are printed as "キーワード: …" in the third section → captions
    if (Array.isArray(a?.tags)) a.tags.forEach((t, j) => checkText(errors, `${p}.tags[${j}]`, t));
    for (const group of ["section_titles", "section_descriptions"]) {
      const g = a?.[group];
      if (g && typeof g === "object") {
        for (const [k, v] of Object.entries(g)) checkText(errors, `${p}.${group}[${quote(k)}]`, v);
      }
    }
    const walk = (v, path) => {
      if (typeof v === "string") {
        if (INVISIBLE_RE.test(v.normalize("NFKC"))) errors.push(`${path} contains an invisible or control character`);
      } else if (v && typeof v === "object") {
        for (const [k, child] of Object.entries(v)) walk(child, `${path}[${quote(k)}]`);
      }
    };
    walk(a, p);
  });
  return { errors };
}

/**
 * @returns {{errors: string[], warnings: string[]}}
 * errors → the content cannot be rendered as-is (routine must fix; the
 * pipeline falls back to a house recipe). warnings → rendered anyway.
 */
/**
 * opts.newsSources: data/news-sources.json (allowed news hosts). Without it a
 * news-top5 is rejected (fail closed).
 */
export function validateDailyContent(content, lineup, { today, allowCandidate = false, newsSources = null } = {}) {
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
  if (DATE_RE.test(String(content.date ?? "")) && content.format !== expectedFormatFor(content.date)) {
    // Mon–Sat are always recipe cards; the news TOP5 is Sunday-only (a recipe
    // on a Sunday is allowed).
    if (content.format === "news-top5") errors.push(`news-top5 is Sunday only (${content.date} must be "recipe")`);
    else warnings.push(`${content.date} is normally "${expectedFormatFor(content.date)}" (got "${content.format}")`);
  }
  if (content.format === "recipe") validateRecipe(content.recipe, lineup, errors, "recipe", { allowCandidate });
  if (content.format === "news-top5") validateNewsTop5(content, errors, newsSources);

  if (errors.length === 0) {
    const data = buildCardsData(content, lineup, { dateDisplay: "" });
    const total = narrationLength(data);
    if (total > LIMITS.narrationTotal) {
      errors.push(`narration is ${total} chars in total (max ${LIMITS.narrationTotal}); shorten the narration fields`);
    }
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Fallback (routine missing / invalid): the bean of the day's house recipe
// ---------------------------------------------------------------------------

export function dayIndex(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Math.floor(d.getTime() / 86_400_000);
}

/**
 * The house recipe of the day's bean (rotates by date). `previous` is the last
 * posted recipe ({ beanId, method }): beans that would repeat its bean or
 * method on consecutive days are skipped when another bean is available.
 */
export class NoPostableBeanError extends Error {}

export function fallbackRecipeContent(lineup, isoDate, previous = null, { allowCandidate = false } = {}) {
  const beans = postableBeans(lineup, { allowCandidate }).filter((b) => b.houseRecipe);
  if (beans.length === 0) {
    throw new NoPostableBeanError(
      `data/coffee-lineup.json has no ${allowCandidate ? "confirmed or candidate" : "confirmed"} bean with a houseRecipe`
    );
  }
  const start = ((dayIndex(isoDate) % beans.length) + beans.length) % beans.length;
  const rotated = beans.map((_, i) => beans[(start + i) % beans.length]);
  const bean =
    rotated.find((b) => b.id !== previous?.beanId && b.houseRecipe.method !== previous?.method) ||
    rotated.find((b) => b.id !== previous?.beanId) ||
    rotated[0];
  return {
    date: isoDate,
    format: "recipe",
    trial: TRIAL_ID,
    fallback: true,
    recipe: { ...bean.houseRecipe, beanId: bean.id },
  };
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
export function recipeNumberTiles(recipe) {
  const n = recipe.numbers;
  const coldBrew = recipe.method === "cold-brew";
  const tiles = [
    { label: "豆", value: String(n.dose_g), unit: "g" },
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
// Sales CTA — one switch in data/coffee-lineup.json `shop.ctaMode`
//   "dm"           : purchase / wholesale by Instagram DM (EC not public yet)
//   "profile-link" : the bio carries a shop link
//   "ec-url"       : the EC is public → print the URL (only if shop.ecPublic)
// ---------------------------------------------------------------------------

export function resolveCtaMode(shop) {
  const mode = shop?.ctaMode || "dm";
  if (mode === "ec-url" && !(shop?.ecPublic && shop?.ecUrl)) return "dm";
  return ["dm", "profile-link", "ec-url"].includes(mode) ? mode : "dm";
}

function ecHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url);
  }
}

export function ctaSlideLines(shop) {
  const mode = resolveCtaMode(shop);
  if (mode === "ec-url") return [`ご購入は ${ecHost(shop.ecUrl)} から`];
  if (mode === "profile-link") return ["ご購入はプロフィールのリンクから"];
  return ["ご購入・卸のご相談は DM へ", shop?.instagram || "@open_ground_coffee_roasters"];
}

/** beanIntroduced: false on days that introduce no bean (the Sunday news TOP5). */
export function salesCtaLines(shop, { beanIntroduced = true } = {}) {
  const name = shop?.name || "Open Ground Coffee Roasters";
  const ig = shop?.instagram || "@open_ground_coffee_roasters";
  const mode = resolveCtaMode(shop);
  const lines = ["――", beanIntroduced ? `紹介した豆は ${name} で販売中です。` : `${name} の自家焙煎豆を販売しています。`];
  if (mode === "ec-url") lines.push(`ご購入はこちら → ${shop.ecUrl}`);
  else if (mode === "profile-link") lines.push(`ご購入はプロフィールのリンクから → ${ig}`);
  else lines.push(`ご購入・卸のご相談は Instagram の DM（${ig}）からお気軽にどうぞ。`);
  return lines;
}

export function buildRecipeSlides(content, lineup, { dateDisplay = "" } = {}) {
  const r = content.recipe;
  const bean = findBean(lineup, r.beanId);
  const method = METHODS[r.method];
  const n = r.numbers;
  const nar = r.narration || {};
  const beanName = bean.displayName || bean.name;
  const spokenBean = bean.spokenName || beanName;
  const iced = r.scene === "iced";

  // Card 1 = hook + bean + all key numbers, so the first frame is already
  // the "save this" recipe (numbers first, like AI Trend Daily's TOP5).
  const withMethod = r.hook.includes(method.label) ? "" : `を${method.label}で`;
  const titleNarration = pick(nar.title, `${r.hook}。今日の一杯は、${spokenBean}${withMethod}。`);
  const coldBrew = r.method === "cold-brew";
  const numbersNarration = pick(
    nar.numbers,
    `豆${n.dose_g}グラムに、${coldBrew ? "水" : "お湯"}${n.water_g}グラム` +
      (iced && isNum(n.ice_g) && !coldBrew ? `、氷${n.ice_g}グラム` : "") +
      "。" +
      (coldBrew ? `冷蔵庫で${speakTime(n.time)}です。` : `${n.temp_c}度で、${speakTime(n.time)}です。`)
  );

  const slides = [
    {
      kind: "recipe-title",
      heading: "今日の一杯",
      date: dateDisplay,
      beanName,
      beanFullName: bean.name,
      beanMeta: [bean.origin, bean.processShort || bean.process, bean.roast].filter(Boolean).join("・"),
      methodLabel: method.label,
      sceneLabel: SCENES[r.scene],
      hook: r.hook,
      tiles: recipeNumberTiles(r),
      narration: `${titleNarration}${numbersNarration}`,
    },
    {
      kind: "recipe-steps",
      heading: "手順",
      steps: r.steps.map((s) => ({
        time: s.time,
        action: s.action,
        amount: isNum(s.pour_to_g) ? `${s.pour_to_g}g` : "",
      })),
      narration: pick(nar.steps, `手順は${r.steps.length}ステップ。画面を保存しておくと便利です。`),
    },
    {
      kind: "recipe-taste",
      heading: "味わい",
      notes: r.taste.notes,
      summary: r.taste.summary,
      meters: [
        { label: "酸味", value: r.taste.acidity },
        { label: "甘み", value: r.taste.sweetness },
        { label: "コク", value: r.taste.body },
      ],
      narration: pick(nar.taste, `味わいは、${r.taste.notes.join("、")}。${r.taste.summary}。`),
    },
    {
      kind: "recipe-tips",
      heading: "悩み別のコツ",
      tips: r.tips.map((t) => ({ problem: t.problem, fix: t.fix })),
      narration: pick(nar.tips, r.tips.slice(0, 2).map((t) => `${t.problem}は、${t.fix}。`).join("")),
    },
  ];

  const ending = {
    kind: "recipe-cta",
    heading: "保存して、淹れる時に見返そう",
    beanName: bean.name,
    lead: "この豆は OPEN GROUND で販売中",
    lines: ctaSlideLines(lineup?.shop),
    narration: pick(nar.cta, `この豆はオープングラウンドで販売中。保存して、淹れる時に見返してください。`),
  };

  return {
    slides,
    ending,
    topicTitle: `${beanName}×${method.label}`,
  };
}

/**
 * recipesLive: at least one bean is confirmed, so Mon-Sat really post recipe
 * cards. While none is, the Sunday ending must not promise them (and the
 * routine's own cta narration, which may promise them, is not used).
 */
export function buildNewsTop5Slides(content, { dateDisplay = "", shop, recipesLive = true } = {}) {
  const block = content.newsTop5;
  const nar = block.narration || {};
  const items = block.items;
  const narItems = Array.isArray(nar.items) ? nar.items : [];
  const slides = [
    {
      kind: "news-cover",
      heading: "今週の世界のコーヒーニュース",
      date: dateDisplay,
      weekLabel: block.weekLabel || "",
      headlines: items.map((it) => it.headline),
      narration: pick(nar.intro, "今週の世界のコーヒーニュース、トップ5です。"),
    },
    ...items.map((it, i) => ({
      kind: "news-item",
      heading: `${it.rank}位`,
      rank: it.rank,
      headline: it.headline,
      number: it.number || "",
      numberLabel: it.numberLabel || "",
      summary: it.summary,
      source: it.source,
      narration: pick(narItems[i], `${it.rank}位、${it.headline}。`),
    })),
  ];
  const ending = recipesLive
    ? {
        kind: "news-cta",
        heading: "月〜土は「今日の一杯」レシピ",
        beanName: "",
        lead: "OPEN GROUND の豆で、毎朝お届け",
        lines: ctaSlideLines(shop),
        narration: pick(nar.cta, "月曜から土曜は、オープングラウンドの豆で今日の一杯レシピをお届けします。"),
      }
    : {
        kind: "news-cta",
        heading: "毎週日曜は、世界のコーヒーニュース",
        beanName: "",
        lead: "OPEN GROUND の自家焙煎豆",
        lines: ctaSlideLines(shop),
        narration: "毎週日曜は、世界のコーヒーニュースをお届けします。",
      };
  return { slides, ending, topicTitle: `今週のコーヒーニュースTOP5：${items[0].headline}` };
}

/**
 * Build output/trending-data.json for the card formats. `projects` mirrors
 * the slides so scripts/generate-audio.mjs keeps producing project-N.mp3.
 */
export function buildCardsData(content, lineup, { dateDisplay = "" } = {}) {
  // what production shows: confirmed beans only (a dry run's candidates do not count)
  const recipesLive = postableBeans(lineup).length > 0;
  const built =
    content.format === "news-top5"
      ? buildNewsTop5Slides(content, { dateDisplay, shop: lineup?.shop, recipesLive })
      : buildRecipeSlides(content, lineup, { dateDisplay });
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
    recipesLive,
    trial: content.trial || TRIAL_ID,
    fallback: Boolean(content.fallback),
    date: content.date,
    slides: built.slides,
    ending: built.ending,
    projects,
    endingNarration: built.ending.narration,
    topicTitle: built.topicTitle,
    recipe: content.format === "recipe" ? content.recipe : undefined,
    newsTop5: content.format === "news-top5" ? content.newsTop5 : undefined,
    discovery: content.discovery || null,
  };
}

export function narrationLength(data) {
  return data.slides.reduce((sum, s) => sum + charLen(s.narration), 0) + charLen(data.ending?.narration);
}

/** Template-only narration (used when the routine's narration makes the video too long). */
export function withTemplateNarration(content) {
  const copy = structuredClone(content);
  if (copy.recipe) delete copy.recipe.narration;
  if (copy.newsTop5) delete copy.newsTop5.narration;
  return copy;
}

// ---------------------------------------------------------------------------
// Timeline (frames) — single source of truth, passed to Remotion as props
// ---------------------------------------------------------------------------

export const TIMELINE = {
  fps: 30,
  padFrames: 15, // 0.5s after narration
  minFirstSlideSec: 6, // hook + bean + six numbers
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
// Captions (sales CTA fixed at the end)
// ---------------------------------------------------------------------------

// Instagram IG User Media: caption ≤ 2200 characters, 30 hashtags, 20 @ tags.
// (YouTube title/description limits: youtube-limits.mjs.)
const IG_CAPTION_MAX_CHARS = 2200;

/** Join body + tail, dropping body lines from the end until it fits — the sales CTA tail always stays last. */
export function fitWithTail(bodyLines, tailLines, measure, max) {
  const body = [...bodyLines];
  const text = () => [...body, ...tailLines].join("\n");
  while (body.length > 0 && measure(text()) > max) body.pop();
  return text();
}

function hashtagsFor(data) {
  if (data.format === "news-top5") {
    return ["#コーヒーニュース", "#コーヒー", "#スペシャルティコーヒー", "#珈琲", "#自家焙煎", "#OpenGroundCoffee"];
  }
  const method = METHODS[data.recipe?.method];
  const tags = ["#今日の一杯", "#コーヒーレシピ", method ? `#${method.hashtag}` : null];
  if (data.recipe?.scene === "iced") tags.push("#アイスコーヒー");
  tags.push("#スペシャルティコーヒー", "#自家焙煎", "#コーヒー豆", "#おうちカフェ", "#OpenGroundCoffee");
  return [...new Set(tags.filter(Boolean))];
}

function recipeBodyLines(data) {
  const r = data.recipe;
  const title = data.slides.find((s) => s.kind === "recipe-title");
  const steps = data.slides.find((s) => s.kind === "recipe-steps");
  const taste = data.slides.find((s) => s.kind === "recipe-taste");
  const tips = data.slides.find((s) => s.kind === "recipe-tips");
  const tileText = title.tiles.map((t) => `${t.label} ${t.value}${t.unit}`).join(" / ");
  const ratio = ratioLabel(r.numbers);
  const hasRatio = title.tiles.some((t) => t.label === "比率");
  return [
    `【今日の一杯】${title.beanFullName || title.beanName} × ${title.methodLabel}（${title.sceneLabel}）`,
    title.hook,
    "",
    "■ レシピ",
    tileText + (!hasRatio && ratio ? ` / 比率 ${ratio}` : ""),
    "",
    "■ 手順",
    ...steps.steps.map((s) => `${s.time} ${s.action}${s.amount ? ` ${s.amount}まで` : ""}`),
    "",
    "■ 味わい",
    `${taste.notes.join("、")}｜${taste.summary}`,
    "",
    "■ 悩み別のコツ",
    ...tips.tips.map((t) => `・${t.problem} → ${t.fix}`),
    "",
    "保存しておくと、淹れる時にすぐ見返せます。",
  ];
}

function newsBodyLines(data) {
  const items = data.slides.filter((s) => s.kind === "news-item");
  const lines = ["【今週の世界のコーヒーニュース TOP5】", ""];
  for (const it of items) {
    lines.push(`${it.rank}. ${it.headline}${it.number ? `（${it.number}${it.numberLabel ? ` ${it.numberLabel}` : ""}）` : ""}`);
    lines.push(`   ${it.summary}（${it.source}）`);
  }
  const urls = (data.newsTop5?.items || []).map((it) => it.url).filter(Boolean);
  if (urls.length) {
    lines.push("", "出典:", ...urls);
  }
  lines.push(
    "",
    data.recipesLive === false
      ? "毎週日曜は、世界のコーヒーニュースをお届けします。"
      : "月〜土は Open Ground の豆で「今日の一杯」レシピをお届けします。"
  );
  return lines;
}

export function buildCardCaptions(data, lineup, dateStr) {
  const shop = lineup?.shop || {};
  const hashtags = hashtagsFor(data);
  const body = data.format === "news-top5" ? newsBodyLines(data) : recipeBodyLines(data);
  const cta = salesCtaLines(shop, { beanIntroduced: data.format !== "news-top5" });

  let title;
  if (data.format === "news-top5") {
    title = youtubeTitle("【今週のコーヒーニュースTOP5】", data.slides[1]?.headline || "", `ほか｜${dateStr.slash} #Shorts`);
  } else {
    const t = data.slides[0];
    const n = data.recipe.numbers;
    const nums = (
      data.recipe.method === "cold-brew"
        ? [`豆${n.dose_g}g`, `冷蔵庫${n.time}`]
        : [`豆${n.dose_g}g`, Number.isFinite(n.temp_c) ? `${n.temp_c}℃` : null, n.time]
    )
      .filter(Boolean)
      .join("・");
    title = youtubeTitle("【今日の一杯】", `${t.beanName}×${t.methodLabel}`, `｜${nums} #Shorts`);
  }

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
  };
}

// ---------------------------------------------------------------------------
// performance-history entry summary
// ---------------------------------------------------------------------------

export function contentRecord(data) {
  if (!data?.format) return null;
  if (data.format === "news-top5") {
    return {
      format: "news-top5",
      trial: data.trial || TRIAL_ID,
      fallback: Boolean(data.fallback),
      headlines: (data.newsTop5?.items || []).map((it) => it.headline),
    };
  }
  const r = data.recipe || {};
  const title = data.slides?.[0] || {};
  return {
    format: "recipe",
    trial: data.trial || TRIAL_ID,
    fallback: Boolean(data.fallback),
    beanId: r.beanId || null,
    beanName: title.beanName || null,
    method: r.method || null,
    scene: r.scene || null,
    angle: r.angle || null,
    tipProblems: (r.tips || []).map((t) => t.problem),
  };
}
