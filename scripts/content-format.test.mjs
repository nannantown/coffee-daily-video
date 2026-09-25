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
  CURRICULUM,
  LEVELS,
  VISUAL_TYPES,
  episodeById,
  episodeNumber,
  episodeQueue,
  expectedFormatFor,
  fallbackLessonContent,
  followingEpisode,
  nextEpisode,
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
const curriculum = readJSON("data/curriculum.json");
// Every episode's evergreen lesson, tagged the way the fallback tags it.
const pack = { lessons: curriculum.episodes.map((e) => ({ episode: e.id, ...e.lesson })) };
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
  assert.ok(pack.lessons.length >= 30, `the series needs at least 30 episodes (${pack.lessons.length})`);
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
      // the hook is pinned to the curriculum, so a changed hook is already an error of its own
      errors.some((e) => e.includes("must not say") || (where === "hook" && e.includes("hook must stay"))),
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
// The series 「味をコントロールする技術」 (owner request 2026-09-25)
// ---------------------------------------------------------------------------

const LEVEL_ORDER = Object.keys(LEVELS);
const aired = (...entries) => ({ videos: entries.map(([date, episode]) => ({ date, content: { episode } })) });

test("the curriculum: 30+ unique episodes, beginner → intermediate → advanced, term episodes included", () => {
  const eps = curriculum.episodes;
  assert.equal(CURRICULUM.episodes.length, eps.length);
  assert.ok(eps.length >= 30, `${eps.length} episodes`);
  assert.equal(new Set(eps.map((e) => e.id)).size, eps.length, "episode ids are unique");
  assert.equal(new Set(eps.map((e) => e.lesson.hook)).size, eps.length, "each episode changes a different thing (the 次回 teaser names it)");
  for (let i = 1; i < eps.length; i++) {
    assert.ok(LEVEL_ORDER.indexOf(eps[i].level) >= LEVEL_ORDER.indexOf(eps[i - 1].level), `${eps[i].id} goes back a level`);
  }
  for (const level of LEVEL_ORDER) assert.ok(eps.some((e) => e.level === level), `no ${level} episode`);
  const terms = eps.filter((e) => e.term).map((e) => e.term);
  for (const t of ["抽出", "蒸らし", "未抽出", "過抽出", "TDS", "抽出収率"]) assert.ok(terms.includes(t), `term episode ${t}`);
  for (const e of eps.filter((x) => x.term)) assert.equal(e.lesson.pillar, "terms", `${e.id} is a term episode`);
  // every diagram kind is used, and more than once
  for (const type of Object.keys(VISUAL_TYPES)) {
    assert.ok(eps.filter((e) => e.lesson.visual.type === type).length >= 3, `diagram ${type} is used at least 3 times`);
  }
});

test("docs/curriculum.md lists every episode, in broadcast order", () => {
  const doc = readFileSync(join(rootDir, "docs", "curriculum.md"), "utf-8");
  let at = -1;
  for (const e of curriculum.episodes) {
    const i = doc.indexOf(`\`${e.id}\``);
    assert.ok(i > at, `${e.id} is missing from docs/curriculum.md or out of order`);
    at = i;
  }
});

test("the next episode follows the last one aired; today's own post never counts", () => {
  const [first, second, third, fourth] = curriculum.episodes;
  assert.equal(nextEpisode({ videos: [] }, "2026-09-26").id, first.id);
  assert.equal(nextEpisode(null, "2026-09-26").id, first.id); // unreadable history
  assert.equal(nextEpisode(aired(["2026-09-26", first.id]), "2026-09-27").id, second.id);
  // a re-run on the same day still picks the episode it already posted
  assert.equal(nextEpisode(aired(["2026-09-26", first.id]), "2026-09-26").id, first.id);
  // only the latest airing matters (history order does not), and a day with no record repeats nothing new
  assert.equal(nextEpisode(aired(["2026-09-27", third.id], ["2026-09-26", first.id]), "2026-09-28").id, fourth.id);
  assert.equal(nextEpisode(aired(["2026-09-26", first.id]), "2026-09-28").id, second.id); // 09-27 failed to post
  // unknown ids (a renamed episode) are ignored rather than trusted
  assert.equal(nextEpisode(aired(["2026-09-26", first.id], ["2026-09-27", "gone"]), "2026-09-28").id, second.id);
  // pre-series posts (no episode) do not count
  assert.equal(nextEpisode({ videos: [{ date: "2026-09-25", content: { topic: "x" } }] }, "2026-09-26").id, first.id);
  // season two starts again from episode 1 once the last episode has aired
  assert.equal(nextEpisode(aired(["2026-10-31", curriculum.episodes.at(-1).id]), "2026-11-01").id, first.id);
  assert.equal(episodeQueue(null, "2026-11-01").length, curriculum.episodes.length);
});

test("200 days of posts air the whole series in order, season after season, under the 90-day history window", () => {
  let history = { videos: [] };
  const start = new Date("2026-09-26T00:00:00Z");
  const iso = (i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
  const n = curriculum.episodes.length;
  for (let i = 0; i < 200; i++) {
    const ep = nextEpisode(history, iso(i));
    assert.equal(ep.id, curriculum.episodes[i % n].id, `day ${i} (${iso(i)})`);
    history.videos.push({ date: iso(i), content: { episode: ep.id } });
    history.videos = history.videos.filter((v) => v.date >= iso(i - 90)); // record-upload keeps 90 days
  }
});

test("a missed routine airs the next episode's own lesson (the fallback follows the curriculum)", () => {
  const ep = nextEpisode(aired(["2026-09-26", curriculum.episodes[0].id]), "2026-09-27");
  const content = fallbackLessonContent(ep, "2026-09-27");
  assert.equal(content.lesson.episode, curriculum.episodes[1].id);
  assert.equal(content.fallback, true);
  assert.equal(content.trial, TRIAL_ID);
  assert.deepEqual(validateDailyContent(content, { today: "2026-09-27", expectedEpisode: ep.id }).errors, []);
  // the pack itself is never mutated by a pick
  content.lesson.hook = "x";
  assert.notEqual(episodeById(ep.id).lesson.hook, "x");
  assert.throws(() => fallbackLessonContent(undefined, "2026-09-27"), /no episode/);
});

test("series: the title card numbers the episode, the CTA and caption announce the next one", () => {
  const data = buildCardsData(sample, { dateDisplay: "2026.09.23" });
  const { no, level } = episodeNumber(sample.lesson.episode);
  assert.equal(data.slides[0].series, `${level} 第${no}回`);
  const next = followingEpisode(sample.lesson.episode);
  assert.equal(data.ending.next, next.term ? `用語「${next.term}」` : next.lesson.hook);
  assert.ok(data.ending.narration.includes("次回"));
  const captions = buildCardCaptions(data, "2026/09/23");
  assert.ok(captions.instagram.includes(`次回：${data.ending.next}`));
  assert.ok(captions.instagram.startsWith(`シリーズ「${CURRICULUM.series}」`));
  // a term episode is headed by its word
  const tds = curriculum.episodes.find((e) => e.term === "TDS");
  const tdsData = buildCardsData(fallbackLessonContent(tds, "2026-09-23"), {});
  assert.equal(tdsData.slides[0].heading, "用語「TDS」");
  assert.ok(tdsData.slides[0].narration.startsWith("今日の用語は、TDS。"));
  // the last episode wraps its teaser to episode 1
  assert.equal(followingEpisode(curriculum.episodes.at(-1).id).id, curriculum.episodes[0].id);
});

test("validation keeps the script on its episode", () => {
  const bad = (mutate, opts) => {
    const content = clone(sample);
    mutate(content);
    return validateDailyContent(content, opts).errors;
  };
  assert.ok(bad((c) => delete c.lesson.episode).some((e) => e.includes("lesson.episode")));
  assert.ok(bad((c) => (c.lesson.episode = "z99-nope")).some((e) => e.includes("must be an episode id")));
  assert.ok(bad((c) => (c.lesson.hook = "湯温を5度下げる")).some((e) => e.includes("hook must stay")));
  assert.ok(bad((c) => (c.lesson.pillar = "grind")).some((e) => e.includes("pillar must be")));
  assert.ok(bad(() => {}, { expectedEpisode: "b01-extraction" }).some((e) => e.includes("is not today's episode")));
  assert.deepEqual(bad(() => {}, { expectedEpisode: sample.lesson.episode }), []);
  // a gear episode keeps its brewer; an ordinary one may change it
  const clever = fallbackLessonContent(episodeById("i10-clever"), "2026-09-23");
  clever.lesson.method = "v60";
  assert.ok(errorsOf(clever).some((e) => e.includes("the brewer is the lesson")));
  assert.deepEqual(bad((c) => (c.lesson.method = "kalita-wave")), []);
});

test("diagram block: each type is checked against the space it gets", () => {
  const bad = (visual) => {
    const content = clone(sample);
    content.lesson.visual = visual;
    return errorsOf(content);
  };
  const has = (errors, text) => assert.ok(errors.some((e) => e.includes(text)), `${text}: ${errors.join(" | ") || "no error"}`);
  has(bad(undefined), "lesson.visual is required");
  has(bad({ type: "pie", caption: "x" }), "visual.type must be one of");
  has(bad({ ...sample.lesson.visual, caption: "あ".repeat(LIMITS.visualCaption + 1) }), "visual.caption is");
  const compare = { type: "compare", caption: "比べる", left: { label: "粗い", result: "軽い", strength: 2 }, right: { label: "細かい", result: "濃い", strength: 4 }, pick: "right" };
  assert.deepEqual(bad(compare), []);
  has(bad({ ...compare, left: { ...compare.left, strength: 7 } }), "left.strength");
  has(bad({ ...compare, pick: "middle" }), "pick");
  has(bad({ ...compare, right: { ...compare.right, result: "あ".repeat(LIMITS.visualResult + 1) } }), "right.result is");
  const graph = { type: "graph", caption: "動き", xLabel: "時間", yLabel: "濃さ", points: [{ label: "1:00", value: 1 }, { label: "2:00", value: 3 }], mark: 1 };
  assert.deepEqual(bad(graph), []);
  has(bad({ ...graph, points: [graph.points[0]] }), "points must have 2-5");
  has(bad({ ...graph, mark: 5 }), "mark");
  has(bad({ ...graph, zones: ["a"] }), "zones must have 2-3");
  const flow = { type: "flow", caption: "流れ", brewers: [{ shape: "cone", label: "円すい", note: "速く落ちる", speed: "fast" }] };
  assert.deepEqual(bad(flow), []);
  has(bad({ ...flow, brewers: [] }), "brewers must have 1-2");
  has(bad({ ...flow, brewers: [{ ...flow.brewers[0], shape: "siphon" }] }), "shape must be one of");
  has(bad({ ...flow, brewers: [{ ...flow.brewers[0], speed: "warp" }] }), "speed");
  const scale = clone(sample.lesson.visual);
  has(bad({ ...scale, to: 120 }), "to 120 is outside");
  has(bad({ ...scale, zones: [{ upTo: 94, label: "a" }, { upTo: 90, label: "b" }] }), "upTo must rise");
  has(bad({ ...scale, zones: [{ upTo: 94, label: "a" }] }), "last upTo must equal max");
  has(bad({ ...scale, unit: "度数" + "x" }), "unit must be");
  has(bad({ ...scale, zones: [{ upTo: 81, label: "ぬるすぎ" }, { upTo: 100, label: "標準" }] }), "too narrow");
  has(bad({ ...scale, max: 123456 }), "within -999 to 9999");
});

test("diagram text is untrusted and product-free like every other text", () => {
  const withCaption = (caption) => {
    const content = clone(sample);
    content.lesson.visual.caption = caption;
    return errorsOf(content);
  };
  assert.ok(withCaption("エチオピアの味").some((e) => e.includes("must not say")));
  assert.ok(withCaption("詳しくはexample.com").some((e) => e.includes("URL or domain")));
  const content = clone(sample);
  content.lesson.visual.zones[0].label = "#軽い";
  assert.ok(errorsOf(content).some((e) => e.includes("visual.zones[0].label")));
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

test("cards: 5 slides (title, diagram, steps, taste, tips) + CTA, audio sections mirror the slides, narration is spoken", () => {
  const data = buildCardsData(sample, { dateDisplay: "2026.09.23" });
  assert.deepEqual(
    data.slides.map((s) => s.kind),
    ["lesson-title", "lesson-visual", "lesson-steps", "lesson-taste", "lesson-tips"]
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
    episode: sample.lesson.episode,
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
