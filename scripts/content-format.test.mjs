import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FORMATS,
  LIMITS,
  METHODS,
  PILLARS,
  TIMELINE,
  TRIAL_ID,
  buildCardCaptions,
  buildCardsData,
  charLen,
  collectPublishedTexts,
  computeCardTimeline,
  contentRecord,
  expectedFormatFor,
  fallbackLessonContent,
  growthCtaCaptionLines,
  kanjiNumber,
  lessonNumberTiles,
  narrationLength,
  speakTime,
  toSpokenJa,
  unsafeSteepReason,
  unsafeTextReason,
  validateDailyContent,
  withTemplateNarration,
  youtubeTitle,
} from "./content-format.mjs";
import { SALES_TERMS, scanBannedTerms } from "./brand-guard.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (rel) => JSON.parse(readFileSync(join(rootDir, rel), "utf-8"));
const pack = readJSON("data/brew-lessons.json");
const sample = readJSON("data/samples/brew-lesson.sample.json");
const lineup = readJSON("data/coffee-lineup.json");
const clone = (o) => structuredClone(o);
const ch = (cp) => String.fromCodePoint(cp);
const errorsOf = (content) => validateDailyContent(content).errors;

// ---------------------------------------------------------------------------
// The format
// ---------------------------------------------------------------------------

test("there is exactly one format and every day uses it", () => {
  assert.deepEqual(FORMATS, ["brew-lesson"]);
  for (const iso of ["2026-09-20", "2026-09-21", "2026-09-26", "2026-09-27"]) {
    assert.equal(expectedFormatFor(iso), "brew-lesson"); // Sunday included
  }
  assert.equal(TRIAL_ID, "coffee-trial-2-brew-basics");
});

test("the sample and every evergreen lesson validate and fit the narration budget", () => {
  assert.deepEqual(errorsOf(sample), []);
  assert.ok(pack.lessons.length >= 14, `the pack needs at least two weeks of lessons (${pack.lessons.length})`);
  for (const lesson of pack.lessons) {
    const content = { date: "2026-09-23", format: "brew-lesson", trial: TRIAL_ID, lesson };
    assert.deepEqual(errorsOf(content), [], `${lesson.pillar} / ${lesson.hook}`);
    assert.ok(narrationLength(buildCardsData(content, {})) <= LIMITS.narrationTotal);
  }
});

test("the pack covers every pillar, so a long outage still teaches something new", () => {
  const covered = new Set(pack.lessons.map((l) => l.pillar));
  assert.deepEqual([...covered].sort(), Object.keys(PILLARS).sort());
  for (const lesson of pack.lessons) assert.ok(METHODS[lesson.method], lesson.method);
});

// ---------------------------------------------------------------------------
// No product, anywhere — the owner's 2026-09-22 decision, mechanically
// ---------------------------------------------------------------------------

test("nothing we sell reaches a slide, a title or a caption", () => {
  for (const lesson of [...pack.lessons, sample.lesson]) {
    const data = buildCardsData({ date: "2026-09-23", format: "brew-lesson", lesson }, { dateDisplay: "2026.09.23" });
    const captions = buildCardCaptions(data, "2026/09/23");
    const hits = scanBannedTerms(collectPublishedTexts(data, captions));
    assert.deepEqual(hits, [], hits.map((h) => `${h.label}: ${h.term}`).join(", "));
  }
});

test("a bean name, an origin or a sales line fails validation wherever it is written", () => {
  const bean = lineup.beans[0];
  const cases = [
    ["hook", (l) => (l.hook = bean.origin)],
    ["topic", (l) => (l.topic = bean.displayName || bean.name)],
    ["why", (l) => (l.why = "当店の自家焙煎豆で淹れました")],
    ["taste note", (l) => (l.taste.notes[0] = "エチオピア")],
    ["tip fix", (l) => (l.tips[0].fix = "ご購入はDMから")],
    ["narration", (l) => ((l.narration ||= {}), (l.narration.cta = "オープングラウンドで販売中です"))],
  ];
  for (const [where, mutate] of cases) {
    const content = clone(sample);
    mutate(content.lesson);
    const errors = errorsOf(content);
    assert.ok(
      errors.some((e) => e.includes("must not say")),
      `${where} must be rejected, got: ${errors.join(" | ") || "no error"}`
    );
  }
});

test("a lineup bean id is rejected outright — the lesson format has no bean", () => {
  const content = clone(sample);
  content.lesson.beanId = lineup.beans[0].id;
  assert.ok(errorsOf(content).some((e) => e.includes("beanId is not allowed")));
});

test("the guard keeps working when a bean is added, renamed or retired", () => {
  const terms = scanBannedTerms([["x", `${lineup.shop.brand} の ${lineup.beans.at(-1).name}`]]);
  assert.ok(terms.length > 0);
  // ordinary tasting and roast vocabulary stays allowed
  assert.deepEqual(scanBannedTerms([["x", "浅煎りでも深煎りでも、キャラメルのような甘さが出ます"]]), []);
});

test("the caption asks for a save and a follow, and never for a sale", () => {
  const data = buildCardsData(sample, { dateDisplay: "2026.09.23" });
  const captions = buildCardCaptions(data, "2026/09/23");
  const cta = growthCtaCaptionLines();
  assert.ok(captions.instagram.endsWith(cta.join("\n")));
  assert.ok(captions.youtube.description.endsWith(cta.join("\n")));
  for (const term of SALES_TERMS) {
    assert.ok(!captions.instagram.includes(term), `caption must not say ${term}`);
  }
  assert.ok(charLen(captions.youtube.title) <= 100 && captions.youtube.title.endsWith(" #Shorts"));
  assert.equal(captions.youtube.titleTemplate, "brew-lesson");
});

// ---------------------------------------------------------------------------
// Fallback: a missing routine still posts generic knowledge
// ---------------------------------------------------------------------------

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Walk `days` consecutive days the way production does: each day's pick feeds
 * the next day's `recentTopics` (newest first, a 7-day window), exactly like
 * generate-data.mjs reads performance-history. A filter that pushes the pick
 * off its rotation slot shows up here as a repeat two days later.
 */
function runRotation(days, from = "2026-09-23", window = 7) {
  const posted = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(from, i);
    const recent = posted.slice(-window).map((l) => l.topic).reverse();
    posted.push({ ...fallbackLessonContent(pack, iso, recent).lesson, iso });
  }
  return posted;
}

test("the fallback is deterministic and every day is a valid, product-free lesson", () => {
  const a = fallbackLessonContent(pack, "2026-09-23");
  assert.deepEqual(a, fallbackLessonContent(pack, "2026-09-23"));
  assert.equal(a.fallback, true);
  assert.equal(a.format, "brew-lesson");
  assert.equal(a.trial, TRIAL_ID);

  for (let i = 0; i < 21; i++) {
    const iso = addDays("2026-10-01", i);
    const content = fallbackLessonContent(pack, iso);
    content.date = iso;
    assert.deepEqual(errorsOf(content), [], iso);
  }
});

test("chaining the previous days never brings a lesson back inside one cycle", () => {
  const n = pack.lessons.length;
  const run = runRotation(n * 3);

  // no repeat inside any window of one full cycle
  for (let i = 0; i < run.length; i++) {
    const window = run.slice(Math.max(0, i - (n - 1)), i);
    assert.ok(
      !window.some((l) => l.topic === run[i].topic),
      `${run[i].iso} repeats "${run[i].topic}" within ${n} days`
    );
  }
  // and the whole pack really is used, not a handful of it
  assert.equal(new Set(run.slice(0, n).map((l) => l.topic)).size, n);
});

test("consecutive fallback days teach different pillars (the pack's order guarantees it)", () => {
  const run = runRotation(pack.lessons.length * 2 + 1);
  for (let i = 1; i < run.length; i++) {
    assert.notEqual(run[i].pillar, run[i - 1].pillar, `${run[i].iso} repeats the pillar of the day before`);
  }
  // V60 is 9 of 17 lessons, so the method can only avoid repeating once per
  // cycle at most — assert the bound rather than a clean alternation.
  const sameMethod = run.slice(1).filter((l, i) => l.method === run[i].method).length;
  assert.ok(sameMethod <= Math.ceil(run.length / pack.lessons.length), `method repeated on ${sameMethod} consecutive pairs`);
});

test("a recently posted topic is skipped when the pack is reordered under us", () => {
  const first = fallbackLessonContent(pack, "2026-09-23").lesson;
  const next = fallbackLessonContent(pack, "2026-09-23", [first.topic]);
  assert.notEqual(next.lesson.topic, first.topic);
});

test("an empty pack is an error, never a silent bean day", () => {
  assert.throws(() => fallbackLessonContent({ lessons: [] }, "2026-09-23"), /no lessons/);
});

// ---------------------------------------------------------------------------
// Shape, numbers and safety
// ---------------------------------------------------------------------------

test("validation rejects content the cards cannot show", () => {
  const bad = (mutate) => {
    const content = clone(sample);
    mutate(content);
    return errorsOf(content);
  };
  assert.ok(bad((c) => (c.format = "news-top5")).some((e) => e.includes("format must be one of")));
  assert.ok(bad((c) => (c.date = "2026/09/23")).some((e) => e.includes("date must be YYYY-MM-DD")));
  assert.ok(bad((c) => (c.lesson.pillar = "vibes")).some((e) => e.includes("pillar must be one of")));
  assert.ok(bad((c) => (c.lesson.method = "microwave")).some((e) => e.includes("method")));
  assert.ok(bad((c) => (c.lesson.scene = "warm")).some((e) => e.includes("scene")));
  assert.ok(bad((c) => (c.lesson.hook = "あ".repeat(LIMITS.hook + 1))).some((e) => e.includes("lesson.hook is")));
  assert.ok(bad((c) => (c.lesson.topic = "")).some((e) => e.includes("lesson.topic is required")));
  assert.ok(bad((c) => (c.lesson.why = "あ".repeat(LIMITS.why + 1))).some((e) => e.includes("lesson.why is")));
  assert.ok(bad((c) => (c.lesson.numbers.temp_c = 120)).some((e) => e.includes("temp_c")));
  assert.ok(bad((c) => (c.lesson.numbers.dose_g = 1)).some((e) => e.includes("dose_g")));
  assert.ok(bad((c) => (c.lesson.steps[3].time = "0:10")).some((e) => e.includes("earlier than the step before")));
  assert.ok(bad((c) => (c.lesson.steps[2].pour_to_g = 300)).some((e) => e.includes("must equal numbers.water_g")));
  assert.ok(bad((c) => (c.lesson.taste.acidity = 9)).some((e) => e.includes("taste.acidity")));
  assert.ok(bad((c) => (c.lesson.tips = [c.lesson.tips[0]])).some((e) => e.includes("tips must have 2-3")));
  assert.ok(bad((c) => (c.date = "2026-09-24")).length === 0); // date check is opt-in
  assert.ok(validateDailyContent(sample, { today: "2026-09-24" }).errors.some((e) => e.includes("is not today")));
});

test("cold brew food safety survives the format change", () => {
  const content = clone(sample);
  content.lesson.method = "cold-brew";
  content.lesson.scene = "iced";
  content.lesson.numbers = { dose_g: 60, water_g: 600, temp_c: 4, grind: "粗挽き", time: "10h" };
  content.lesson.steps = [
    { time: "0:00", action: "粉と水", pour_to_g: 600 },
    { time: "10h", action: "冷蔵庫で待つ" },
  ];
  assert.deepEqual(errorsOf(content), []);

  const roomTemp = clone(content);
  roomTemp.lesson.steps[1].action = "常温で待つ";
  assert.ok(errorsOf(roomTemp).length > 0);

  const tiles = lessonNumberTiles(content.lesson);
  assert.ok(tiles.some((t) => t.label === "冷蔵庫"));
  assert.ok(!tiles.some((t) => t.label === "湯温"));
});

test("cards: 4 slides + CTA, audio sections mirror the slides, narration is spoken", () => {
  const data = buildCardsData(sample, { dateDisplay: "2026.09.23" });
  assert.deepEqual(
    data.slides.map((s) => s.kind),
    ["lesson-title", "lesson-steps", "lesson-taste", "lesson-tips"]
  );
  assert.equal(data.ending.kind, "lesson-cta");
  assert.equal(data.projects.length, data.slides.length);
  assert.equal(data.topicTitle, `${PILLARS[sample.lesson.pillar]}｜${sample.lesson.hook}`);
  assert.ok(!data.slides[0].narration.includes("15g"));
  assert.ok(data.slides[0].narration.includes("グラム"));
  assert.equal(data.slides[0].topic, sample.lesson.topic);
  assert.equal(data.ending.topic, sample.lesson.topic);

  const template = buildCardsData(withTemplateNarration(sample), {});
  assert.notEqual(template.slides[0].narration, data.slides[0].narration);
  assert.ok(narrationLength(template) <= LIMITS.narrationTotal);
});

test("number tiles: hot shows the ratio, iced shows the ice instead", () => {
  const hot = lessonNumberTiles(sample.lesson);
  assert.ok(hot.some((t) => t.label === "比率" && t.value.includes("対")));
  const iced = pack.lessons.find((l) => l.scene === "iced");
  const tiles = lessonNumberTiles(iced);
  assert.ok(tiles.some((t) => t.label === "氷"));
  assert.ok(!tiles.some((t) => t.label === "比率"));
});

test("performance-history content record carries the pillar, not a bean", () => {
  const record = contentRecord(buildCardsData(sample, {}));
  assert.deepEqual(record, {
    format: "brew-lesson",
    trial: TRIAL_ID,
    fallback: false,
    pillar: sample.lesson.pillar,
    topic: sample.lesson.topic,
    method: sample.lesson.method,
    scene: sample.lesson.scene,
    tipProblems: sample.lesson.tips.map((t) => t.problem),
  });
  assert.ok(!("beanId" in record));
});

test("odd table keys never crash validation (a crash would stop the post)", () => {
  for (const key of ["__proto__", "constructor", "toString"]) {
    const content = clone(sample);
    content.lesson.method = key;
    assert.ok(errorsOf(content).some((e) => e.includes("method")));
    const p = clone(sample);
    p.lesson.pillar = key;
    assert.ok(errorsOf(p).some((e) => e.includes("pillar")));
  }
});

test("untrusted text: URLs, @, #, line breaks and invisible characters are rejected after NFKC", () => {
  const rejected = [
    ["https://evil.example/x", "URL"],
    ["見てwww.example.com", "URL"],
    ["詳しくは example.com へ", "URL"],
    ["ｅｘａｍｐｌｅ．ｃｏｍ", "URL"],
    ["ｈｔｔｐｓ：／／ｘ", "URL"],
    ["@someone に連絡", '"@"'],
    ["＠someone", '"@"'],
    ["#コーヒー", '"#"'],
    ["＃コーヒー", '"#"'],
    ["一行目\n二行目", "invisible"],
    ["タブ\tあり", "invisible"],
    ["ゼロ" + ch(0x200b) + "幅", "invisible"],
    ["向き" + ch(0x202e) + "反転", "invisible"],
    ["分離" + ch(0x2066) + "記号", "invisible"],
    ["タグ" + ch(0xe0041) + "文字", "invisible"],
    ["異体字" + ch(0xfe0f), "invisible"],
    ["行区切り" + ch(0x2028) + "あり", "invisible"],
  ];
  for (const [text, expected] of rejected) {
    const reason = unsafeTextReason(text);
    assert.ok(reason && reason.includes(expected), `${JSON.stringify(text)} → ${reason}`);
  }
  for (const ok of ["湯温を2℃上げて95℃に", "比率は1対15", "No.1の産地", "3.5%上昇", "Perfect Daily Grind", "-12%", "V60で淹れる。次は"]) {
    assert.equal(unsafeTextReason(ok), null, ok);
  }
});
test("steep safety wording: every recipe text, after NFKC (review round 2 examples)", () => {
  const rejected = [
    "常温に一晩おく",
    "室温一晩でもOK",
    "常温OKの水出し",
    "キッチンに置いたまま一晩",
    "2日浸ける",
    "48h",
    "一日半",
    "\u{FF13}\u{FF10}時間",
    "常温で一晩置いて水出し",
    "3 days in the fridge",
    "冷蔵庫でなく常温で",
    "24.5時間浸ける",
  ];
  for (const text of rejected) assert.ok(unsafeSteepReason(text), `${text} must be rejected`);
  for (const ok of ["冷蔵庫でひと晩寝かせる", "常温に置かず冷蔵庫へ", "濾して冷蔵保存", "抽出を12時間に延ばす", "湯温を2℃上げて95℃に", "毎日の一杯に", "一日の始まりに"]) {
    assert.equal(unsafeSteepReason(ok), null, ok);
  }
});
test("steep safety wording, review round 3: negated fridge, 24 hours or more, kanji numbers, steeping words", () => {
  const rejected = [
    // required 1: a negation after the fridge word in the same sentence
    "冷蔵庫には入れず一晩",
    "冷蔵庫には入れません",
    "冷蔵庫に入れなくてOK",
    "冷蔵庫NG",
    "冷蔵庫の外で12時間",
    "冷蔵庫から出して8時間置く",
    // required 2: 24 hours or more, kanji hours and days
    "24時間以上浸ける",
    "24時間超",
    "24時間を超えて寝かせる",
    "24時間オーバーでもOK",
    "\u{FF12}\u{FF14}時間以上",
    "三十時間",
    "二十五時間浸ける",
    "一昼夜おく",
    "二日",
    "半日浸ける",
    "一日冷蔵庫で寝かせる",
    // recommended 4: steeping words without the fridge in the same sentence, any recipe
    "水出しは一晩でOK",
    "翌朝まで置く",
    "テーブルで8時間",
  ];
  for (const text of rejected) assert.ok(unsafeSteepReason(text), `${text} must be rejected`);

  const allowed = [
    "冷蔵庫でひと晩寝かせる",
    "冷蔵庫で10時間抽出します",
    "冷蔵庫に必ず入れる",
    "まず冷蔵庫で冷やす",
    "冷蔵庫で作る水出しデカフェ",
    "冷蔵庫で甘みを引き出す",
    "二十四時間",
    "十二時間冷蔵庫で",
    "一日の始まりに",
    // recommended 6: storage / pouring at room temperature
    "粉は常温で保存",
    "常温の水を注ぐ",
  ];
  for (const text of allowed) assert.equal(unsafeSteepReason(text), null, text);

  assert.deepEqual([kanjiNumber("三十"), kanjiNumber("二十四"), kanjiNumber("十二"), kanjiNumber("百二十"), kanjiNumber("二四"), kanjiNumber("三杯")], [30, 24, 12, 120, 24, null]);
});
test("TTS normalization of times, temperatures and grams", () => {
  assert.equal(speakTime("2:30"), "2分30秒");
  assert.equal(speakTime("0:45"), "45秒");
  assert.equal(speakTime("4:00"), "4分");
  assert.equal(speakTime("10h"), "10時間");
  assert.equal(toSpokenJa("豆15gに93℃、2:30で。10hで完成"), "豆15グラムに93度、2分30秒で。10時間で完成");
  assert.equal(toSpokenJa("V60 と G-1"), "V60 と G-1");
});

test("timeline keeps reading time and reports seconds", () => {
  const tl = computeCardTimeline({ "project-1": 2, "project-2": 10, "project-3": 1, "project-4": 1, ending: 1 }, 4);
  assert.equal(tl.slides[0], Math.ceil(TIMELINE.minFirstSlideSec * 30));
  assert.equal(tl.slides[1], 10 * 30 + TIMELINE.padFrames);
  assert.equal(tl.slides[2], Math.ceil(TIMELINE.minSlideSec * 30));
  assert.equal(tl.ending, Math.ceil(TIMELINE.minEndingSec * 30));
  assert.equal(tl.total, tl.slides.reduce((a, b) => a + b, 0) + tl.ending);
  assert.equal(tl.seconds, tl.total / 30);
});


test("youtubeTitle shortens only the middle so the title fits 100 characters", () => {
  // 2026-09-15: a 106-character title made YouTube reject the upload.
  const topic = "あ".repeat(90);
  assert.ok(charLen(topic) > 72);
  const title = youtubeTitle("【湯温】", topic, "｜粉15g・88℃・2:30 #Shorts");
  assert.equal(charLen(title), 100);
  assert.ok(title.startsWith("【湯温】"));
  assert.ok(title.endsWith("…｜粉15g・88℃・2:30 #Shorts"));
  assert.ok(!/[<>]/.test(title));
  for (const lesson of pack.lessons) {
    const c = buildCardCaptions(buildCardsData({ date: "2026-09-23", format: "brew-lesson", lesson }, {}), "2026/09/23");
    assert.ok(charLen(c.youtube.title) <= 100 && c.youtube.title.endsWith(" #Shorts"), c.youtube.title);
  }
});
