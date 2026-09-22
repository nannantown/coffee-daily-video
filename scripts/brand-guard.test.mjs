import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN_TERMS, SALES_TERMS, bannedTerms, scanBannedTerms } from "./brand-guard.mjs";
import { buildCardCaptions, buildCardsData, collectPublishedTexts } from "./content-format.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = (rel) => JSON.parse(readFileSync(join(rootDir, rel), "utf-8"));
const lineup = readJSON("data/coffee-lineup.json");
const sample = readJSON("data/samples/brew-lesson.sample.json");

const hit = (text) => scanBannedTerms([["x", text]]);

test("every coffee in the lineup is banned by name, display name and spoken name", () => {
  assert.ok(lineup.beans.length >= 5, "the lineup should still list the shop's coffees");
  for (const bean of lineup.beans) {
    for (const name of [bean.name, bean.displayName, bean.spokenName].filter(Boolean)) {
      assert.ok(hit(`今日は${name}を使います`).length > 0, name);
    }
    assert.ok(hit(`産地は${bean.origin}です`).length > 0, bean.origin);
  }
});

test("the shop itself is banned: name, brand, handle and EC host", () => {
  for (const v of [lineup.shop.name, lineup.shop.brand, lineup.shop.instagram, "open-ground.co"]) {
    assert.ok(hit(`${v} をチェック`).length > 0, String(v));
  }
});

test("origins and sales wording are banned even if the lineup file disappears", () => {
  for (const term of ORIGIN_TERMS) assert.ok(hit(`${term}の豆で淹れました`).length > 0, term);
  for (const term of SALES_TERMS) assert.ok(hit(`${term}はこちら`).length > 0, term);
});

test("the brewing vocabulary the channel needs stays allowed", () => {
  const allowed = [
    "浅煎りでも深煎りでも湯温で味は変わる",
    "挽き目を1段粗くする",
    "粉15gにお湯240g、1対16の比率",
    "蒸らしを40秒とると甘みが出る",
    "スーパーの粉でも味は動きます",
    "タイマーを4分にセット",
    "キャラメルのような甘さ",
    "フレンチプレスとV60の違い",
    "苦い時は湯温を下げる",
  ];
  for (const text of allowed) assert.deepEqual(hit(text), [], text);
});

test("a hit names the most specific term and says why", () => {
  const hits = hit("エチオピアの豆をDMで販売中");
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((h) => h.why && h.label === "x" && h.text.includes("エチオピア")));
  assert.ok(bannedTerms().every((t, i, all) => i === 0 || all[i - 1].term.length >= t.term.length), "longest first");
});

test("today's published texts are clean end to end", () => {
  const data = buildCardsData(sample, { dateDisplay: "2026.09.23" });
  const captions = buildCardCaptions(data, "2026/09/23");
  const texts = collectPublishedTexts(data, captions);
  assert.ok(texts.length > 20, "the scan must cover slides, narration, title, description and caption");
  assert.ok(texts.some(([label]) => label === "youtube.title"));
  assert.ok(texts.some(([label]) => label === "instagram"));
  assert.deepEqual(scanBannedTerms(texts), []);
});
