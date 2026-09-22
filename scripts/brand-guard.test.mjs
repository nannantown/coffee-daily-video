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
  // Spelled out, not derived from the lists — a test that iterates the list it
  // is checking passes even when the list is emptied.
  const origins = ["エチオピア", "ケニア", "コロンビア", "ブラジル", "グアテマラ", "ルワンダ", "ブルンジ", "ニカラグア", "中国", "インドネシア"];
  const sales = ["ご購入", "販売", "通販", "ご注文", "卸売", "送料", "定期便", "DM", "自家焙煎", "当店", "プロフのリンク", "買えます"];
  for (const term of origins) {
    assert.ok(ORIGIN_TERMS.includes(term), `${term} must stay in ORIGIN_TERMS`);
    assert.ok(hit(`${term}の豆で淹れました`).length > 0, term);
  }
  for (const term of sales) {
    assert.ok(SALES_TERMS.includes(term), `${term} must stay in SALES_TERMS`);
    assert.ok(hit(`${term}はこちら`).length > 0, term);
  }
  assert.ok(ORIGIN_TERMS.length >= 40 && SALES_TERMS.length >= 25, "the lists must not shrink silently");
});

test("an ASCII term needs a word boundary — 'DM' must not fire inside an English word", () => {
  for (const text of ["Hand Method", "Good Morning", "admin", "handmade drip", "medium grind"]) {
    assert.deepEqual(hit(text), [], text);
  }
  for (const text of ["DM で送ってください", "お気軽に DM を", "dm us"]) {
    assert.ok(hit(text).some((h) => h.term === "DM"), text);
  }
});

test("the sales wording the review found slipping through is caught", () => {
  for (const text of ["プロフのリンクから", "ECサイトで買えます", "豆はうちで焼いたもの", "店頭でもどうぞ", "次回入荷は来週"]) {
    assert.ok(hit(text).length > 0, `${text} must be rejected`);
  }
});

test("a missing lineup file is loud, not silent", async () => {
  const src = await import("./brand-guard.mjs");
  // the real file is present, so bean names are in the list — the regression we
  // guard against is the catch branch returning [] with no warning at all
  const guard = readFileSync(join(rootDir, "scripts", "brand-guard.mjs"), "utf-8");
  assert.match(guard, /console\.warn\([\s\S]*coffee-lineup\.json is not readable/);
  assert.ok(src.bannedTerms().some((t) => t.term === lineup.beans[0].origin));
});

test("the brewing vocabulary the channel needs stays allowed", () => {
  // Every one of these is a sentence an honest lesson would write. A false
  // positive here is worse than a miss: the morning post silently falls back
  // to the canned pack, every day, and nobody notices.
  const allowed = [
    "浅煎りでも深煎りでも湯温で味は変わる",
    "挽き目を1段粗くする",
    "粉15gにお湯240g、1対16の比率",
    "蒸らしを40秒とると甘みが出る",
    "スーパーの粉でも味は動きます",
    "スーパーで買える粉で十分おいしくなります",
    "タイマーを4分にセット",
    "キャラメルのような甘さ",
    "フレンチプレスとV60の違い",
    "苦い時は湯温を下げる",
    "ナチュラルな甘みが出ます",
    "デカフェも同じ数字で淹れられます",
    "ハニーのような甘さが残ります",
    "ウォッシュドらしい澄んだ味",
    "豆の取り扱いは密閉容器で",
    "ドリッパーの取り扱い説明書の推奨値です",
    "メーカー公式サイトの推奨値に合わせます",
    "カフェで注文する時は浅煎りを選ぶ",
    "粉を卸すように削る",
    "在庫のある粉から使い切る",
    "湯の中、国産の水でも同じです",
    "ペーパーを一度お湯で濡らす",
    "粉がぐじゃぐじゃにならないよう静かに注ぐ",
  ];
  for (const text of allowed) assert.deepEqual(hit(text), [], text);
});

test("an origin still cannot slip through in romaji or with odd spacing", () => {
  const rejected = [
    "Ethiopia single origin",
    "kenya AA",
    "COSTA RICA の豆",
    "ブルー マウンテン",
    "ブルーマウンテン",
    "open-ground.co をどうぞ",
    "OPEN　GROUND",
    "ご購入はこちら",
  ];
  for (const text of rejected) assert.ok(hit(text).length > 0, `${text} must be rejected`);
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
