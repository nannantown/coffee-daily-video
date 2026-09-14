import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIMITS,
  TIMELINE,
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
  toSpokenJa,
  validateDailyContent,
  withTemplateNarration,
} from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (rel) => JSON.parse(readFileSync(join(rootDir, rel), "utf-8"));
const lineup = readJSON("data/coffee-lineup.json");
const recipeSample = readJSON("data/samples/recipe.sample.json");
const newsSample = readJSON("data/samples/news-top5.sample.json");
const clone = (o) => structuredClone(o);
const jst = { iso: "2026-09-15", slash: "2026/09/15", compact: "20260915" };

test("lineup master: every sellable bean has a valid house recipe within the narration budget", () => {
  const beans = lineup.beans.filter((b) => b.status !== "retired");
  assert.ok(beans.length >= 1);
  const ids = new Set();
  for (const bean of beans) {
    assert.ok(!ids.has(bean.id), `duplicate id ${bean.id}`);
    ids.add(bean.id);
    assert.ok(bean.name && bean.origin && bean.roast, `${bean.id} needs name/origin/roast`);
    const content = { date: "2026-09-15", format: "recipe", recipe: { ...bean.houseRecipe, beanId: bean.id } };
    const { errors } = validateDailyContent(content, lineup);
    assert.deepEqual(errors, [], `${bean.id}: ${errors.join("; ")}`);
  }
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

test("cold brew allows no temperature; iced pour-over needs ice", () => {
  const bean = lineup.beans.find((b) => b.houseRecipe.method === "cold-brew");
  const content = { date: "2026-09-15", format: "recipe", recipe: { ...clone(bean.houseRecipe), beanId: bean.id } };
  assert.deepEqual(validateDailyContent(content, lineup).errors, []);
  const tiles = recipeNumberTiles(content.recipe);
  assert.deepEqual(tiles.map((t) => t.label), ["豆", "水", "水温", "抽出", "挽き目", "比率"]);
  assert.equal(tiles[2].value, "冷水");
  assert.deepEqual([tiles[3].value, tiles[3].unit], ["10", "時間"]);
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
  assert.ok(newsCaps.instagram.endsWith(cta.join("\n")));
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
