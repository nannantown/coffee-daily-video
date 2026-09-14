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
 * content type. A file without `format` is the legacy news explainer.
 */

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

export function findBean(lineup, beanId) {
  return (lineup?.beans || []).find((b) => b.id === beanId && b.status !== "retired") || null;
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

function checkLen(errors, label, value, max) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} is required`);
  } else if (charLen(value) > max) {
    errors.push(`${label} is ${charLen(value)} chars (max ${max}): "${value}"`);
  }
}

export function validateRecipe(recipe, lineup, errors, prefix = "recipe") {
  if (!recipe || typeof recipe !== "object") {
    errors.push(`${prefix} block is required`);
    return;
  }
  if (!findBean(lineup, recipe.beanId)) {
    const ids = (lineup?.beans || []).filter((b) => b.status !== "retired").map((b) => b.id);
    errors.push(`${prefix}.beanId "${recipe.beanId}" is not in data/coffee-lineup.json (${ids.join(", ")})`);
  }
  if (!METHODS[recipe.method]) {
    errors.push(`${prefix}.method "${recipe.method}" must be one of ${Object.keys(METHODS).join(", ")}`);
  }
  if (!SCENES[recipe.scene]) errors.push(`${prefix}.scene must be "hot" or "iced"`);
  if (!ANGLES[recipe.angle]) {
    errors.push(`${prefix}.angle must be one of ${Object.keys(ANGLES).join(", ")}`);
  }
  checkLen(errors, `${prefix}.hook`, recipe.hook, LIMITS.hook);

  const n = recipe.numbers || {};
  if (!isNum(n.dose_g) || n.dose_g < 5 || n.dose_g > 80) errors.push(`${prefix}.numbers.dose_g must be 5-80`);
  if (!isNum(n.water_g) || n.water_g < 20 || n.water_g > 1200) errors.push(`${prefix}.numbers.water_g must be 20-1200`);
  const coldBrew = recipe.method === "cold-brew";
  if (coldBrew) {
    if (n.temp_c != null && (!isNum(n.temp_c) || n.temp_c > 30)) errors.push(`${prefix}.numbers.temp_c must be null or ≤30 for cold-brew`);
  } else if (!isNum(n.temp_c) || n.temp_c < 60 || n.temp_c > 100) {
    errors.push(`${prefix}.numbers.temp_c must be 60-100`);
  }
  if (recipe.scene === "iced" && !coldBrew && (!isNum(n.ice_g) || n.ice_g <= 0)) {
    errors.push(`${prefix}.numbers.ice_g is required for iced recipes`);
  }
  if (n.ice_g != null && (!isNum(n.ice_g) || n.ice_g < 0 || n.ice_g > 600)) errors.push(`${prefix}.numbers.ice_g must be 0-600`);
  if (!isValidTime(n.time)) errors.push(`${prefix}.numbers.time must be "m:ss" or "<hours>h" (got "${n.time}")`);
  checkLen(errors, `${prefix}.numbers.grind`, n.grind, LIMITS.grind);
  if (isNum(n.dose_g) && isNum(n.water_g) && n.dose_g > 0) {
    const ratio = (n.water_g + (n.ice_g || 0)) / n.dose_g;
    if (ratio < 2 || ratio > 20) errors.push(`${prefix}.numbers ratio 1:${ratio.toFixed(1)} is outside 1:2-1:20`);
  }

  const steps = recipe.steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 5) {
    errors.push(`${prefix}.steps must have 1-5 items`);
  } else {
    let maxPour = null;
    steps.forEach((s, i) => {
      if (!isValidTime(s?.time)) errors.push(`${prefix}.steps[${i}].time must be "m:ss" or "<hours>h"`);
      checkLen(errors, `${prefix}.steps[${i}].action`, s?.action, LIMITS.stepAction);
      if (s?.pour_to_g != null) {
        if (!isNum(s.pour_to_g) || s.pour_to_g <= 0) errors.push(`${prefix}.steps[${i}].pour_to_g must be a positive number`);
        else maxPour = Math.max(maxPour ?? 0, s.pour_to_g);
      }
    });
    if (maxPour != null && isNum(n.water_g) && Math.abs(maxPour - n.water_g) > 2) {
      errors.push(`${prefix}.steps: last pour_to_g (${maxPour}g) must equal numbers.water_g (${n.water_g}g)`);
    }
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

function validateNewsTop5(content, errors) {
  const block = content.newsTop5;
  if (!block || !Array.isArray(block.items) || block.items.length !== 5) {
    errors.push("newsTop5.items must have exactly 5 items");
    return;
  }
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
    if (!/^https?:\/\//.test(String(item?.url ?? ""))) errors.push(`${p}.url must be an http(s) URL`);
  });
  const d = content.discovery;
  if (!d || !Array.isArray(d.sources) || d.sources.length === 0) {
    errors.push("discovery.sources is required for news-top5");
  }
  if (d && isNum(d.freshness_hours) && d.freshness_hours > 168) {
    errors.push(`discovery.freshness_hours ${d.freshness_hours} > 168 (news older than a week)`);
  }
}

/**
 * @returns {{errors: string[], warnings: string[]}}
 * errors → the content cannot be rendered as-is (routine must fix; the
 * pipeline falls back to a house recipe). warnings → rendered anyway.
 */
export function validateDailyContent(content, lineup, { today } = {}) {
  const errors = [];
  const warnings = [];
  if (!content || typeof content !== "object") {
    return { errors: ["content is not an object"], warnings };
  }
  if (!DATE_RE.test(String(content.date ?? ""))) errors.push(`date must be YYYY-MM-DD (got "${content.date}")`);
  if (today && content.date !== today) errors.push(`date ${content.date} is not today (${today})`);
  if (!FORMATS.includes(content.format)) {
    errors.push(`format must be one of ${FORMATS.join(", ")} (got "${content.format}")`);
    return { errors, warnings };
  }
  if (DATE_RE.test(String(content.date ?? "")) && content.format !== expectedFormatFor(content.date)) {
    warnings.push(`${content.date} is normally "${expectedFormatFor(content.date)}" (got "${content.format}")`);
  }
  if (content.format === "recipe") validateRecipe(content.recipe, lineup, errors);
  if (content.format === "news-top5") validateNewsTop5(content, errors);

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

export function fallbackRecipeContent(lineup, isoDate) {
  const beans = (lineup?.beans || []).filter((b) => b.status !== "retired" && b.houseRecipe);
  if (beans.length === 0) throw new Error("data/coffee-lineup.json has no bean with a houseRecipe");
  const bean = beans[((dayIndex(isoDate) % beans.length) + beans.length) % beans.length];
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
  tiles.push(isNum(n.temp_c) ? { label: "湯温", value: String(n.temp_c), unit: "℃" } : { label: "水温", value: "冷水", unit: "" });
  const hours = String(n.time).match(HOURS_RE);
  tiles.push({ label: coldBrew ? "抽出" : "時間", value: hours ? hours[1] : String(n.time), unit: hours ? "時間" : "" });
  tiles.push({ label: "挽き目", value: n.grind, unit: "" });
  const ratio = ratioLabel(n);
  if (tiles.length < 6 && ratio) tiles.push({ label: "比率", value: ratio, unit: "" });
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

export function salesCtaLines(shop) {
  const name = shop?.name || "Open Ground Coffee Roasters";
  const ig = shop?.instagram || "@open_ground_coffee_roasters";
  const mode = resolveCtaMode(shop);
  const lines = ["――", `紹介した豆は ${name} で販売中です。`];
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
  const titleNarration = pick(nar.title, `${r.hook}。今日の一杯は、${spokenBean}を${method.label}で。`);
  const numbersNarration = pick(
    nar.numbers,
    `豆${n.dose_g}グラムに、${r.method === "cold-brew" ? "水" : "お湯"}${n.water_g}グラム` +
      (iced && isNum(n.ice_g) && r.method !== "cold-brew" ? `、氷${n.ice_g}グラム` : "") +
      "。" +
      (isNum(n.temp_c) ? `${n.temp_c}度で、` : "") +
      `${speakTime(n.time)}です。`
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

export function buildNewsTop5Slides(content, { dateDisplay = "", shop } = {}) {
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
  const ending = {
    kind: "news-cta",
    heading: "平日は「今日の一杯」レシピ",
    beanName: "",
    lead: "OPEN GROUND の豆で、毎朝お届け",
    lines: ctaSlideLines(shop),
    narration: pick(nar.cta, "平日は、オープングラウンドの豆で今日の一杯レシピをお届けします。"),
  };
  return { slides, ending, topicTitle: `今週のコーヒーニュースTOP5：${items[0].headline}` };
}

/**
 * Build output/trending-data.json for the card formats. `projects` mirrors
 * the slides so scripts/generate-audio.mjs keeps producing project-N.mp3.
 */
export function buildCardsData(content, lineup, { dateDisplay = "" } = {}) {
  const built =
    content.format === "news-top5"
      ? buildNewsTop5Slides(content, { dateDisplay, shop: lineup?.shop })
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

export function clampChars(text, max) {
  const chars = Array.from(String(text));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}

const YT_TITLE_MAX = 100;

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
  lines.push("", "平日は Open Ground の豆で「今日の一杯」レシピをお届けします。");
  return lines;
}

export function buildCardCaptions(data, lineup, dateStr) {
  const shop = lineup?.shop || {};
  const hashtags = hashtagsFor(data);
  const body = data.format === "news-top5" ? newsBodyLines(data) : recipeBodyLines(data);
  const cta = salesCtaLines(shop);

  let title;
  if (data.format === "news-top5") {
    title = `【今週のコーヒーニュースTOP5】${data.slides[1]?.headline || ""}ほか｜${dateStr.slash}`;
  } else {
    const t = data.slides[0];
    const n = data.recipe.numbers;
    const nums = [`豆${n.dose_g}g`, Number.isFinite(n.temp_c) ? `${n.temp_c}℃` : null, n.time].filter(Boolean).join("・");
    title = `【今日の一杯】${t.beanName}×${t.methodLabel}｜${nums}`;
  }
  const suffix = " #Shorts";
  title = `${clampChars(title, YT_TITLE_MAX - charLen(suffix))}${suffix}`;

  const ytDescription = [...body, "", hashtags.join(" "), "", ...cta].join("\n");
  const instagram = [...body, "", hashtags.join(" "), "", ...cta].join("\n");

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
