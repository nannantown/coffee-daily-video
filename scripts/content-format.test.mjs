import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIMITS,
  NoPostableBeanError,
  TIMELINE,
  isSafeHttpsUrl,
  unsafeTextReason,
  validateLegacyContent,
  buildCardCaptions,
  buildCardsData,
  charLen,
  computeCardTimeline,
  contentRecord,
  ctaSlideLines,
  expectedFormatFor,
  fallbackRecipeContent,
  narrationLength,
  ratioLabel,
  recipeNumberTiles,
  resolveCtaMode,
  salesCtaLines,
  speakTime,
  timeSeconds,
  toSpokenJa,
  validateDailyContent,
  withTemplateNarration,
  youtubeTitle,
} from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (rel) => JSON.parse(readFileSync(join(rootDir, rel), "utf-8"));
const realLineup = readJSON("data/coffee-lineup.json");
const recipeSample = readJSON("data/samples/recipe.sample.json");
const newsSample = readJSON("data/samples/news-top5.sample.json");
const clone = (o) => structuredClone(o);
const jst = { iso: "2026-09-15", slash: "2026/09/15", compact: "20260915" };
// Most tests are about the content, not the owner's bean confirmation, so they
// use a copy where every non-retired bean is confirmed (the gate has its own test).
const lineup = clone(realLineup);
for (const b of lineup.beans) if (b.status !== "retired") b.status = "confirmed";

test("lineup master: every sellable bean has a valid house recipe within the narration budget", () => {
  const beans = realLineup.beans.filter((b) => b.status !== "retired");
  assert.ok(beans.length >= 1);
  const ids = new Set();
  for (const bean of beans) {
    assert.ok(["candidate", "confirmed"].includes(bean.status), `${bean.id}: status must be candidate / confirmed / retired`);
    assert.ok(!ids.has(bean.id), `duplicate id ${bean.id}`);
    ids.add(bean.id);
    assert.ok(bean.name && bean.origin && bean.roast, `${bean.id} needs name/origin/roast`);
    const content = { date: "2026-09-15", format: "recipe", recipe: { ...bean.houseRecipe, beanId: bean.id } };
    const { errors } = validateDailyContent(content, realLineup, { allowCandidate: true });
    assert.deepEqual(errors, [], `${bean.id}: ${errors.join("; ")}`);
  }
});

test("candidate beans are for dry runs only; production posts confirmed beans", () => {
  const gated = clone(lineup);
  const candidate = gated.beans[0];
  candidate.status = "candidate";
  const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(candidate.houseRecipe), beanId: candidate.id } };
  assert.ok(validateDailyContent(content, gated).errors.some((e) => e.includes('status "candidate"')));
  assert.deepEqual(validateDailyContent(content, gated, { allowCandidate: true }).errors, []);
  for (const day of ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]) {
    assert.notEqual(fallbackRecipeContent(gated, day).recipe.beanId, candidate.id, "the fallback never advertises a candidate");
  }
  const none = clone(gated);
  for (const b of none.beans) b.status = "candidate";
  assert.throws(() => fallbackRecipeContent(none, "2026-09-15"), NoPostableBeanError);
  assert.equal(fallbackRecipeContent(none, "2026-09-15", null, { allowCandidate: true }).fallback, true);
  const retired = clone(none);
  for (const b of retired.beans) b.status = "retired";
  assert.throws(() => fallbackRecipeContent(retired, "2026-09-15", null, { allowCandidate: true }), NoPostableBeanError);
});

test("lineup shop: EC not public yet → DM call to action", () => {
  assert.equal(lineup.shop.ecPublic, false);
  assert.equal(resolveCtaMode(lineup.shop), "dm");
});

test("samples validate", () => {
  assert.deepEqual(validateDailyContent(recipeSample, lineup).errors, []);
  assert.deepEqual(validateDailyContent(newsSample, lineup).errors, []);
});

test("Sunday is news TOP5, other days are recipes", () => {
  assert.equal(expectedFormatFor("2026-09-20"), "news-top5");
  assert.equal(expectedFormatFor("2026-09-15"), "recipe");
  assert.equal(expectedFormatFor("2026-09-19"), "recipe");
  const { warnings } = validateDailyContent({ ...clone(recipeSample), date: "2026-09-20" }, lineup);
  assert.ok(warnings.some((w) => w.includes("news-top5")));
});

test("validation rejects content the cards cannot show", () => {
  const cases = [
    [(c) => (c.recipe.beanId = "brazil-santos"), "not in data/coffee-lineup.json"],
    [(c) => (c.recipe.method = "siphon"), "method"],
    [(c) => (c.recipe.hook = "あ".repeat(LIMITS.hook + 1)), "recipe.hook"],
    [(c) => (c.recipe.steps[2].pour_to_g = 200), "must equal numbers.water_g"],
    [(c) => (c.recipe.scene = "iced"), "ice_g is required"],
    [(c) => (c.recipe.numbers.time = "2分30秒"), "numbers.time"],
    [(c) => (c.recipe.numbers.grind = "中細挽きより少し粗め"), "numbers.grind"],
    [(c) => (c.recipe.tips = c.recipe.tips.slice(0, 1)), "tips must have 2-3"],
    [(c) => (c.recipe.taste.acidity = 6), "taste.acidity"],
    [(c) => (c.recipe.narration.tips = "あ".repeat(200)), "narration is"],
    [(c) => (c.format = "news"), "format must be"],
    [(c) => (c.recipe.angle = "expert"), "sources is required"],
    [(c) => (c.recipe.sources = ["not-a-url"]), "sources[0]"],
    [
      (c) => {
        c.recipe.method = "cold-brew";
        c.recipe.numbers.temp_c = null;
        c.recipe.numbers.time = "10h";
      },
      'must be "iced" for cold-brew',
    ],
  ];
  for (const [mutate, expected] of cases) {
    const c = clone(recipeSample);
    mutate(c);
    const { errors } = validateDailyContent(c, lineup);
    assert.ok(errors.some((e) => e.includes(expected)), `expected "${expected}" in ${JSON.stringify(errors)}`);
  }
});

test("validation: date must be today when checked; news needs 5 sourced items", () => {
  assert.ok(validateDailyContent(recipeSample, lineup, { today: "2026-09-16" }).errors.some((e) => e.includes("not today")));
  const news = clone(newsSample);
  news.newsTop5.items.pop();
  assert.ok(validateDailyContent(news, lineup).errors.some((e) => e.includes("exactly 5")));
  const noUrl = clone(newsSample);
  noUrl.newsTop5.items[0].url = "";
  assert.ok(validateDailyContent(noUrl, lineup).errors.some((e) => e.includes("url")));
});

test("cold brew house recipe steeps in the fridge: tiles, narration and title say so", () => {
  const bean = lineup.beans.find((b) => b.houseRecipe.method === "cold-brew");
  const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
  assert.deepEqual(validateDailyContent(content, lineup).errors, []);
  const tiles = recipeNumberTiles(content.recipe);
  assert.deepEqual(tiles.map((t) => t.label), ["豆", "水", "冷蔵庫", "抽出", "挽き目", "比率"]);
  assert.deepEqual([tiles[2].value, tiles[2].unit], ["5", "℃"]);
  assert.deepEqual([tiles[3].value, tiles[3].unit], ["10", "時間"]);
  const data = buildCardsData(withTemplateNarration(content), lineup, {});
  assert.match(data.slides[0].narration, /冷蔵庫で10時間です。/);
  assert.match(buildCardCaptions(data, lineup, jst).youtube.title, /豆50g・冷蔵庫10h #Shorts$/);
});

test("cold brew food safety: fridge 1-10℃, 6-24 hours, a step says 冷蔵庫, never room temperature", () => {
  const bean = lineup.beans.find((b) => b.houseRecipe.method === "cold-brew");
  const errorsFor = (mutate) => {
    const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
    mutate(content.recipe);
    return validateDailyContent(content, lineup).errors;
  };
  const has = (errors, text) => errors.some((e) => e.includes(text));
  assert.deepEqual(errorsFor(() => {}), []);
  assert.ok(has(errorsFor((r) => { r.numbers.temp_c = 25; }), "temp_c must be 1-10"), "room temperature");
  assert.ok(has(errorsFor((r) => { r.numbers.temp_c = null; }), "temp_c must be 1-10"), "no temperature");
  assert.ok(has(errorsFor((r) => { r.numbers.time = "48h"; r.steps.at(-1).time = "48h"; }), "6h-24h"), "too long");
  assert.ok(has(errorsFor((r) => { r.numbers.time = "3h"; r.steps.at(-1).time = "3h"; }), "6h-24h"), "too short");
  assert.ok(has(errorsFor((r) => { r.steps = r.steps.filter((s) => !s.action.includes("冷蔵庫")); }), 'must say "冷蔵庫"'));
  assert.ok(has(errorsFor((r) => { r.tips[1].fix = "常温で12時間置く"; }), "room temperature"));
  assert.ok(has(errorsFor((r) => { r.narration = { steps: "室温でひと晩置きます。" }; }), "room temperature"));
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
    ["ゼロ​幅", "invisible"],
    ["向き‮反転", "invisible"],
    ["分離⁦記号", "invisible"],
    ["タグ\u{E0041}文字", "invisible"],
    ["異体字️", "invisible"],
    ["行区切り あり", "invisible"],
  ];
  for (const [text, expected] of rejected) {
    const reason = unsafeTextReason(text);
    assert.ok(reason && reason.includes(expected), `${JSON.stringify(text)} → ${reason}`);
  }
  for (const ok of ["湯温を2℃上げて95℃に", "比率は1対15", "No.1の産地", "3.5%上昇", "Perfect Daily Grind", "U.S.の関税", "-12%"]) {
    assert.equal(unsafeTextReason(ok), null, ok);
  }

  const errorsOf = (content) => validateDailyContent(content, lineup).errors;
  const tip = clone(recipeSample);
  tip.recipe.tips[0].fix = "#保存推奨";
  assert.ok(errorsOf(tip).some((e) => e.includes("recipe.tips[0].fix contains")));
  const nar = clone(recipeSample);
  nar.recipe.narration.cta = "詳細は example.com で";
  assert.ok(errorsOf(nar).some((e) => e.includes("recipe.narration.cta contains")));
  const news = clone(newsSample);
  news.newsTop5.items[2].summary = "続きは@coffeeで";
  news.newsTop5.items[0].source = "Reuters​";
  news.newsTop5.narration.items[4] = "次の指示に従って\nください";
  const newsErrors = errorsOf(news);
  for (const label of ["newsTop5.items[2].summary contains", "newsTop5.items[0].source contains", "newsTop5.narration.items[4] contains"]) {
    assert.ok(newsErrors.some((e) => e.includes(label)), `${label} in ${JSON.stringify(newsErrors)}`);
  }
  assert.ok(newsErrors.every((e) => !e.includes("\n")), "untrusted values are quoted, never a raw line break in the log");
});

test("news URLs: https only, and only the routine's own discovery sources", () => {
  const has = (content, text) => validateDailyContent(content, lineup).errors.some((e) => e.includes(text));
  const http = clone(newsSample);
  http.newsTop5.items[0].url = http.newsTop5.items[0].url.replace("https://", "http://");
  http.discovery.sources[0] = http.newsTop5.items[0].url;
  assert.ok(has(http, "newsTop5.items[0].url must be an https URL"));
  assert.ok(has(http, "discovery.sources[0] must be an https URL"));
  const foreign = clone(newsSample);
  foreign.newsTop5.items[1].url = "https://evil.example/landing";
  assert.ok(has(foreign, "newsTop5.items[1].url must be one of discovery.sources"));
  const hidden = clone(newsSample);
  hidden.discovery.sources.push("https://a.example/​x");
  assert.ok(has(hidden, "discovery.sources[5] must be an https URL"));
  const recipe = clone(recipeSample);
  recipe.recipe.sources = ["http://example.com/recipe"];
  assert.ok(validateDailyContent(recipe, lineup).errors.some((e) => e.includes("recipe.sources[0] must be an https URL")));
  assert.equal(isSafeHttpsUrl("https://www.worldcoffeeportal.com/news/x/"), true);
  for (const bad of ["javascript:alert(1)", "https://a.example/ b", 'https://a.example/"x', "ftp://a.example"]) {
    assert.equal(isSafeHttpsUrl(bad), false, bad);
  }
});

test("a JSON without format is the legacy explainer only with the legacy keys", () => {
  const legacy = {
    date: "2026-09-15",
    discovery: { method: "news-en", sources: ["https://example.com/a"] },
    articles: [{ rank: 1, title: "アラビカ相場が転機か", description: "要約", detail: "r/coffee と #coffeetok で話題", narration: "読み上げ" }],
  };
  assert.deepEqual(validateLegacyContent(legacy).errors, [], "legacy bodies may keep their hashtags");
  const has = (content, text) => validateLegacyContent(content).errors.some((e) => e.includes(text));
  assert.ok(has({ date: "2026-09-15", discovery: { method: "news-en" } }, "articles[] is required"));
  assert.ok(has({ ...clone(legacy), articles: [{ rank: 1, title: "t" }] }, "articles[0].description is required"));
  assert.ok(has({ ...clone(legacy), discovery: undefined }, "discovery.method is required"));
  const linked = clone(legacy);
  linked.articles[0].title = "詳しくは https://x.example で";
  assert.ok(has(linked, "articles[0].title contains"));
  const hidden = clone(legacy);
  hidden.articles[0].narration_sections = { hook: "見出し⁦隠し" };
  assert.ok(has(hidden, "articles[0].narration_sections.hook contains an invisible"));
});

test("per-method bounds: ratio, total time and water per brewer", () => {
  const errorsFor = (method, scene, mutate) => {
    const bean = lineup.beans.find((b) => b.houseRecipe.method === method && b.houseRecipe.scene === scene);
    const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
    mutate(content.recipe);
    return validateDailyContent(content, lineup).errors;
  };
  const has = (errors, text) => errors.some((e) => e.includes(text));
  assert.ok(has(errorsFor("v60", "hot", (r) => { r.numbers.dose_g = 30; }), "outside 1:12-1:18 for V60"));
  assert.ok(has(errorsFor("v60", "hot", (r) => { r.numbers.time = "8:00"; r.steps.at(-1).time = "8:00"; }), "outside 1:30-6:00 for V60"));
  assert.ok(has(errorsFor("french-press", "hot", (r) => { r.numbers.time = "2:00"; }), "outside 3:00-15:00 for フレンチプレス"));
  assert.ok(has(errorsFor("aeropress", "hot", (r) => { r.numbers.water_g = 700; }), "outside 60-600g for エアロプレス"));
  assert.ok(has(errorsFor("cold-brew", "iced", (r) => { r.numbers.dose_g = 20; }), "outside 1:5-1:15 for 水出し"));
  const iced = errorsFor("v60", "iced", (r) => { r.numbers.ice_g = 20; });
  assert.ok(has(iced, "outside 1:10-1:16 for iced V60"));
  assert.ok(has(iced, "ice_g is 12% of water + ice"));
});

test("number tiles: hot shows ratio, iced shows ice instead", () => {
  assert.deepEqual(recipeNumberTiles(recipeSample.recipe).map((t) => `${t.label}:${t.value}${t.unit}`), [
    "豆:15g",
    "お湯:225g",
    "湯温:93℃",
    "時間:2:30",
    "挽き目:中細挽き",
    "比率:1:15",
  ]);
  const iced = lineup.beans.find((b) => b.houseRecipe.scene === "iced" && b.houseRecipe.method !== "cold-brew");
  const labels = recipeNumberTiles(iced.houseRecipe).map((t) => t.label);
  assert.deepEqual(labels, ["豆", "お湯", "氷", "湯温", "時間", "挽き目"]);
  assert.equal(ratioLabel(iced.houseRecipe.numbers), "1:12.5");
});

test("fallback rotates through the lineup deterministically", () => {
  const days = ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"];
  const ids = days.map((d) => fallbackRecipeContent(lineup, d).recipe.beanId);
  assert.equal(new Set(ids).size, Math.min(5, lineup.beans.length));
  assert.equal(fallbackRecipeContent(lineup, "2026-09-15").recipe.beanId, ids[0]);
  const f = fallbackRecipeContent(lineup, "2026-09-15");
  assert.equal(f.fallback, true);
  assert.deepEqual(validateDailyContent(f, lineup, { today: "2026-09-15" }).errors, []);
});

test("TTS normalization of times, temperatures and grams", () => {
  assert.equal(speakTime("2:30"), "2分30秒");
  assert.equal(speakTime("0:45"), "45秒");
  assert.equal(speakTime("4:00"), "4分");
  assert.equal(speakTime("10h"), "10時間");
  assert.equal(toSpokenJa("豆15gに93℃、2:30で。10hで完成"), "豆15グラムに93度、2分30秒で。10時間で完成");
  assert.equal(toSpokenJa("V60 と G-1"), "V60 と G-1");
});

test("recipe cards: 4 slides + CTA, audio sections mirror slides, spoken narration", () => {
  const data = buildCardsData(recipeSample, lineup, { dateDisplay: "2026.09.15" });
  assert.deepEqual(data.slides.map((s) => s.kind), ["recipe-title", "recipe-steps", "recipe-taste", "recipe-tips"]);
  assert.equal(data.ending.kind, "recipe-cta");
  assert.equal(data.projects.length, data.slides.length);
  assert.equal(data.endingNarration, data.ending.narration);
  for (const s of [...data.slides, data.ending]) {
    assert.doesNotMatch(s.narration, /\d\s?(℃|g)|\d:\d\d/, s.narration);
  }
  assert.ok(narrationLength(data) <= LIMITS.narrationTotal);
  assert.deepEqual(data.ending.lines, ctaSlideLines(lineup.shop));
  // template narration still covers every slide
  const t = buildCardsData(withTemplateNarration(recipeSample), lineup, {});
  assert.ok(t.slides.every((s) => s.narration.length > 0));
});

test("news TOP5 cards: cover + 5 items + CTA", () => {
  const data = buildCardsData(newsSample, lineup, { dateDisplay: "2026.09.20" });
  assert.deepEqual(data.slides.map((s) => s.kind), ["news-cover", ...Array(5).fill("news-item")]);
  assert.equal(data.slides[0].headlines.length, 5);
  assert.equal(data.ending.kind, "news-cta");
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

test("captions end with the fixed sales CTA; YouTube title fits 100 chars", () => {
  const data = buildCardsData(recipeSample, lineup, { dateDisplay: "2026.09.15" });
  const caps = buildCardCaptions(data, lineup, jst);
  const cta = salesCtaLines(lineup.shop);
  assert.ok(caps.instagram.endsWith(cta.join("\n")));
  assert.ok(caps.youtube.description.endsWith(cta.join("\n")));
  assert.match(caps.instagram, /DM/);
  assert.match(caps.instagram, /豆 15g \/ お湯 225g \/ 湯温 93℃ \/ 時間 2:30/);
  assert.match(caps.youtube.title, /^【今日の一杯】イルガチェフェ コチャレ×V60｜豆15g・93℃・2:30 #Shorts$/);
  assert.ok(charLen(caps.youtube.title) <= 100);
  assert.ok(caps.youtube.tags.includes("今日の一杯"));
  assert.equal(caps.youtube.titleTemplate, "recipe");

  const news5 = clone(newsSample);
  news5.newsTop5.items[0].headline = "<速報> 価格が上昇";
  const bracketCaps = buildCardCaptions(buildCardsData(news5, lineup, {}), lineup, jst);
  assert.doesNotMatch(bracketCaps.youtube.title, /[<>]/, "YouTube rejects < and > in titles");
  assert.doesNotMatch(bracketCaps.youtube.description, /[<>]/, "YouTube rejects < and > in descriptions");
  assert.match(bracketCaps.instagram, /<速報>/, "Instagram keeps the original text");

  // limits: YT description ≤ 5000 bytes, IG caption ≤ 2200 chars, CTA still last
  // the Sunday news introduces no bean → no "紹介した豆は" line
  const newsCta = salesCtaLines(lineup.shop, { beanIntroduced: false });
  assert.doesNotMatch(newsCta.join("\n"), /紹介した豆/);
  const huge = clone(newsSample);
  huge.newsTop5.items.forEach((it, i) => (it.url = `https://example.com/${"長い記事".repeat(300)}/${i}`));
  const hugeCaps = buildCardCaptions(buildCardsData(huge, lineup, {}), lineup, jst);
  assert.ok(Buffer.byteLength(hugeCaps.youtube.description, "utf8") <= 5000);
  assert.ok(charLen(hugeCaps.instagram) <= 2200);
  assert.ok(hugeCaps.youtube.description.endsWith(newsCta.join("\n")));
  assert.ok(hugeCaps.instagram.endsWith(newsCta.join("\n")));

  const longLineup = clone(lineup);
  longLineup.beans.find((b) => b.id === recipeSample.recipe.beanId).displayName = "長".repeat(120);
  const longData = buildCardsData(recipeSample, longLineup, {});
  const longTitle = buildCardCaptions(longData, longLineup, jst).youtube.title;
  assert.ok(charLen(longTitle) <= 100 && longTitle.endsWith(" #Shorts"));

  const ecLineup = clone(lineup);
  ecLineup.shop.ctaMode = "ec-url";
  assert.equal(resolveCtaMode(ecLineup.shop), "dm", "EC link only once the shop is public");
  ecLineup.shop.ecPublic = true;
  assert.ok(buildCardCaptions(longData, ecLineup, jst).instagram.endsWith(`ご購入はこちら → ${ecLineup.shop.ecUrl}`));

  const news = buildCardsData(newsSample, lineup, {});
  const newsCaps = buildCardCaptions(news, lineup, jst);
  assert.ok(newsCaps.instagram.endsWith(newsCta.join("\n")));
  assert.doesNotMatch(newsCaps.instagram, /紹介した豆/);
  for (const item of newsSample.newsTop5.items) assert.ok(newsCaps.youtube.description.includes(item.url));
});

test("performance-history content record", () => {
  const recipe = contentRecord(buildCardsData(recipeSample, lineup, {}));
  assert.deepEqual(recipe, {
    format: "recipe",
    trial: "coffee-trial-1-recipe-card",
    fallback: false,
    beanId: "ethiopia-yirgacheffe-kochere",
    beanName: "イルガチェフェ コチャレ",
    method: "v60",
    scene: "hot",
    angle: "trouble",
    tipProblems: ["酸っぱい時", "苦い時", "薄い時"],
  });
  const news = contentRecord(buildCardsData(newsSample, lineup, {}));
  assert.equal(news.format, "news-top5");
  assert.equal(news.headlines.length, 5);
  assert.equal(contentRecord({ projects: [] }), null);
});

test("youtubeTitle shortens only the middle so the title fits 100 characters", () => {
  // 2026-09-15: this legacy title was 106 characters and YouTube rejected the upload.
  const topic =
    "<速報>商社オラムがブラジル産アラビカ15-20万袋をICE認証在庫へ・9/11ロイター報、26年低水準を倍増候補で9/14の12月限は3.3%下落、市場関係者の見方";
  assert.ok(charLen(topic) > 72);
  const title = youtubeTitle("【コーヒー豆知識】", topic, "｜2026/09/15 #Shorts");
  assert.equal(charLen(title), 100);
  assert.ok(title.startsWith("【コーヒー豆知識】＜速報＞商社オラム"));
  assert.ok(title.endsWith("…｜2026/09/15 #Shorts"));
  assert.ok(!/[<>]/.test(title));
  assert.equal(youtubeTitle("【今日の一杯】", "ルワンダ フムレ×フレンチプレス", "｜豆15g #Shorts"), "【今日の一杯】ルワンダ フムレ×フレンチプレス｜豆15g #Shorts");
  for (const c of [buildCardCaptions(buildCardsData(recipeSample, lineup, {}), lineup, jst), buildCardCaptions(buildCardsData(newsSample, lineup, {}), lineup, jst)]) {
    assert.ok(charLen(c.youtube.title) <= 100 && c.youtube.title.endsWith(" #Shorts"));
  }
});

test("news-top5 is rejected on a weekday; a recipe on a Sunday is only a warning", () => {
  const mondayNews = { ...clone(newsSample), date: "2026-09-21" };
  assert.ok(validateDailyContent(mondayNews, lineup).errors.some((e) => e.includes("Sunday only")));
  const bean = lineup.beans[0];
  const sundayRecipe = { date: "2026-09-20", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
  const result = validateDailyContent(sundayRecipe, lineup);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.length > 0);
});

test("recipe numbers: time format per method, ordered step times, increasing pours", () => {
  assert.equal(timeSeconds("2:30"), 150);
  assert.equal(timeSeconds("10h"), 36000);
  assert.equal(timeSeconds("2分"), null);
  const errorsFor = (method, mutate) => {
    const bean = lineup.beans.find((b) => b.houseRecipe.method === method);
    const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
    mutate(content.recipe);
    return validateDailyContent(content, lineup).errors;
  };
  const has = (errors, text) => errors.some((e) => e.includes(text));
  assert.deepEqual(errorsFor("v60", () => {}), []);
  assert.ok(has(errorsFor("v60", (r) => { r.numbers.time = "3h"; }), "numbers.time"));
  assert.ok(has(errorsFor("v60", (r) => { r.steps[2].pour_to_g = r.steps[1].pour_to_g - 10; }), "must be more than"));
  assert.ok(has(errorsFor("v60", (r) => { r.steps.forEach((s) => delete s.pour_to_g); }), "at least one pour_to_g"));
  assert.ok(has(errorsFor("v60", (r) => { [r.steps[1].time, r.steps[2].time] = [r.steps[2].time, r.steps[1].time]; }), "earlier than"));
  assert.ok(has(errorsFor("v60", (r) => { r.steps.at(-1).time = "9:59"; }), "after numbers.time"));
  assert.deepEqual(errorsFor("cold-brew", () => {}), []);
  assert.ok(has(errorsFor("cold-brew", (r) => { r.numbers.time = "8:00"; }), "for cold-brew"));
  assert.ok(has(errorsFor("cold-brew", (r) => { r.numbers.ice_g = 200; }), "ice_g must be omitted"));
});

test("cold brew's temperature tile is the fridge (冷蔵庫), never 湯温", () => {
  const bean = lineup.beans.find((b) => b.houseRecipe.method === "cold-brew");
  const tiles = recipeNumberTiles({ ...clone(bean.houseRecipe), numbers: { ...bean.houseRecipe.numbers, temp_c: 4 } });
  assert.ok(tiles.some((t) => t.label === "冷蔵庫" && t.value === "4" && t.unit === "℃"));
  assert.ok(!tiles.some((t) => t.label === "湯温"));
});

test("the fallback house recipe does not repeat the previous post's bean or method", () => {
  const day = "2026-09-15";
  const first = fallbackRecipeContent(lineup, day);
  const next = fallbackRecipeContent(lineup, day, { beanId: first.recipe.beanId, method: first.recipe.method });
  assert.notEqual(next.recipe.beanId, first.recipe.beanId);
  assert.notEqual(next.recipe.method, first.recipe.method);
  assert.deepEqual(validateDailyContent(next, lineup, { today: day }).errors, []);
  assert.equal(fallbackRecipeContent(lineup, day, null).recipe.beanId, first.recipe.beanId);
});
