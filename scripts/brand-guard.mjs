/**
 * Brand guard — the machine check behind the owner's 2026-09-22 decision:
 * while the channel is in its audience-growth phase, nothing we sell may
 * appear in a video, a title or a caption.
 *
 * Banned, in every published text:
 *   1. our own coffees — the name, origin, region and farm of every bean in
 *      data/coffee-lineup.json, plus the shop's own name, brand and EC host
 *      (read from the file, so retiring or adding a bean keeps the guard true)
 *   2. producing-country names in general — a viewer does not own that coffee,
 *      and naming one is what the owner asked us to stop
 *   3. anything that sells — purchase / wholesale / DM / shop / order wording
 *
 * Allowed on purpose: general coffee vocabulary the lessons need — roast
 * levels (浅煎り / 中煎り / 深煎り), tasting words (キャラメル / シトラス), and
 * processing / product words that happen to sit inside a bean's own name
 * (ナチュラル / ウォッシュド / ハニー / デカフェ …, see GENERIC_WORDS). Banning
 * those would reject an honest lesson every morning and quietly fall back to
 * the canned pack, which is worse than the risk they carry.
 *
 * The lineup file itself stays in the repo for the day the promotion phase
 * reopens; it is simply never an input to content generation any more.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Coffee producing countries and the regions/varietals that stand in for them. */
export const ORIGIN_TERMS = [
  "エチオピア", "ケニア", "タンザニア", "ルワンダ", "ブルンジ", "ウガンダ", "コンゴ", "イエメン", "マラウイ", "ザンビア",
  "コロンビア", "ブラジル", "グアテマラ", "コスタリカ", "エルサルバドル", "ホンジュラス", "ニカラグア", "パナマ", "ペルー",
  "ボリビア", "メキシコ", "ジャマイカ", "ハワイ", "エクアドル",
  "インドネシア", "スマトラ", "マンデリン", "ベトナム", "ミャンマー", "ラオス", "中国", "ネパール", "東ティモール",
  // romaji, because YouTube tags and titles are often written in English
  "ethiopia", "kenya", "tanzania", "rwanda", "burundi", "uganda", "yemen",
  "colombia", "brazil", "brasil", "guatemala", "costa rica", "el salvador", "honduras", "nicaragua", "panama", "peru", "bolivia",
  "indonesia", "sumatra", "mandheling", "vietnam", "yirgacheffe", "sidamo", "geisha", "gesha", "single origin",
  "イルガチェフェ", "シダモ", "グジ", "コチャレ", "デーホン", "フムレ", "マバンザ", "ゴールドマウンテン", "ブルーマウンテン", "キリマンジャロ",
  "ゲイシャ", "ティピカ", "ブルボン", "パカマラ", "SL28", "SL34",
];

/**
 * Selling. The growth phase asks for a save and a follow, nothing else.
 *
 * Deliberately NOT here, because an honest brewing lesson says them and a false
 * positive costs a whole day of content: 「買える」（スーパーで買える豆で十分…）,
 * 「取り扱い」（豆の取り扱いは密閉容器で）, 「注文」（カフェで注文する時は）,
 * 「公式サイト」（メーカー公式サイトの推奨値）, bare 「卸」（粉を卸すように）, 「在庫」.
 * The selling forms of those are listed in their polite/compound shapes instead.
 */
export const SALES_TERMS = [
  "ご購入", "購入", "お買い求め", "お買い上げ", "販売", "発売", "売って", "通販", "オンラインショップ", "ネットショップ",
  "ご注文", "ご予約", "卸売", "卸価格", "卸のご相談", "お取り扱い店", "送料", "定期便", "お取り寄せ", "ギフトセット", "プレゼント企画",
  "DM", "D.M.", "ディーエム", "プロフィールのリンク", "プロフのリンク", "リンクはプロフィール", "プロフィールから",
  "自家焙煎", "焙煎所", "当店", "弊社", "うちで焼いた", "自分たちで焼いた", "うちで買え",
  "ECサイト", "EC ショップ", "ネット限定",
  // Narrowed 2026-09-22 (review): bare 店頭 / 買えます / 入荷 blocked the growth
  // phase's own message — 「スーパーで買えます」「店頭で挽いてもらう」「豆が入荷したて」
  // are exactly the "you don't need our coffee" lines this channel exists to
  // write. Only the selling shapes are listed. 「当店で買えます」 is already
  // caught by 当店, 「通販で買えます」 by 通販.
  "店頭販売", "店頭でお渡し", "店頭でもどうぞ", "店頭にて", "店頭でお求め", "新豆が入荷", "入荷しました",
  "open-ground", "openground", "OPEN GROUND", "オープングラウンド",
];

/**
 * Words that appear inside a bean's own name but are ordinary coffee
 * vocabulary. A lesson about brewing decaf, or one that says 「ナチュラルな甘み」,
 * must not be rejected because a bean we sell happens to be
 * 「デカフェ … ナチュラル」.
 */
export const GENERIC_WORDS = new Set([
  "ナチュラル", "ウォッシュド", "ハニー", "デカフェ", "カフェインレス", "在来種", "ブレンド",
  "イーストファーメンテーション", "アナエロビック", "フリーウォッシュド", "パルプドナチュラル", "スペシャルティ",
]);

function lineupTerms() {
  let lineup;
  try {
    lineup = JSON.parse(readFileSync(join(rootDir, "data", "coffee-lineup.json"), "utf-8"));
  } catch (err) {
    // Loud on purpose: without this file no bean NAME is banned at all, only
    // the static origin and sales lists. A silent empty list here is how a
    // coffee we sell gets on air.
    console.warn(
      `brand-guard: data/coffee-lineup.json is not readable (${err.message}) — bean names are NOT being checked, only ORIGIN_TERMS and SALES_TERMS`
    );
    return [];
  }
  const out = [];
  const push = (v) => {
    const s = String(v ?? "").trim();
    if (s.length >= 2) out.push(s);
  };
  const shop = lineup.shop || {};
  push(shop.name);
  push(shop.brand);
  push(shop.instagram);
  if (shop.ecUrl) {
    try {
      push(new URL(shop.ecUrl).hostname.replace(/^www\./, ""));
    } catch {
      push(shop.ecUrl);
    }
  }
  for (const bean of lineup.beans || []) {
    // A multi-word bean name is also banned word by word ("ブルンジ マバンザ …" →
    // "マバンザ"), except for the generic words above.
    for (const key of ["name", "displayName", "spokenName"]) {
      push(bean[key]);
      for (const part of String(bean[key] ?? "").split(/[\s・×]+/u)) {
        if (!GENERIC_WORDS.has(part.trim())) push(part);
      }
    }
    // Identity of the lot. `process` / `processShort` / `variety` are NOT here:
    // ウォッシュド and ナチュラル are how anyone describes coffee, not how anyone
    // identifies ours. Flavour wording (flavor / labelFlavor) is out for the
    // same reason — "キャラメル" is vocabulary the lessons need.
    for (const key of ["origin", "region", "farm"]) push(bean[key]);
  }
  return out;
}

/**
 * Every banned term, longest first so an error names the most specific match.
 * Built once per process — the lineup file does not change while a render runs.
 */
export function bannedTerms() {
  const tagged = [
    ...lineupTerms().map((term) => [term, "it is one of our own coffees or the shop itself"]),
    ...ORIGIN_TERMS.map((term) => [term, "it names a coffee origin the viewer does not own"]),
    ...SALES_TERMS.map((term) => [term, "it sells instead of teaching (growth phase, owner decision 2026-09-22)"]),
  ];
  const byTerm = new Map();
  for (const [term, why] of tagged) {
    const key = term.normalize("NFKC").toLowerCase();
    if (key && !byTerm.has(key)) byTerm.set(key, { term, why });
  }
  return [...byTerm.values()].sort((a, b) => b.term.length - a.term.length);
}

/**
 * Normalise both sides of the comparison: NFKC, lower case, and spaces / middle
 * dots / hyphens dropped — so 「ブルー マウンテン」, "Costa Rica" and
 * "open-ground" all match their needle however they are spaced.
 *
 * Deliberately NOT folded: the long-vowel mark 「ー」 and hiragana. Dropping
 * 「ー」 would shorten 「ペルー」 to a 2-character needle, and folding hiragana
 * would let 「ぐじゃぐじゃ」 match 「グジ」 — both turn into false positives that
 * silently cost a day of content, and neither buys a realistic leak back
 * (nobody writes an origin in hiragana; romaji is covered by ORIGIN_TERMS).
 */
export function fold(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・·_/\u{2010}\u{2011}\u{2013}\u{2014}-]/gu, "");
}

/** NFKC + lower case, keeping the separators — the haystack ASCII terms anchor to. */
export function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase();
}

/**
 * ASCII-only terms match on a word boundary, not as a substring: "Hand Method"
 * and "admin" both contain "dm", and "DM" is a banned term. They are tested
 * against the separator-keeping haystack, with the term's own separators made
 * flexible so "Costa Rica" still matches "costa-rica" and "OPEN　GROUND".
 *
 * Japanese terms stay substring matches on the separator-stripped haystack —
 * Japanese has no word separators to anchor to.
 */
const ASCII_ONLY = /^[\x20-\x7e]+$/u;
const SEP_CLASS = "[\\s\u{30fb}\u{b7}_/\u{2010}\u{2011}\u{2013}\u{2014}-]*";

function matcher(term) {
  if (!ASCII_ONLY.test(term)) {
    const needle = fold(term);
    return needle ? { spaced: false, test: (h) => h.includes(needle) } : null;
  }
  const body = normalize(term)
    .split(/[\s_/\u{2010}\u{2011}\u{2013}\u{2014}-]+/u)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(SEP_CLASS);
  if (!body) return null;
  const re = new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "u");
  return { spaced: true, test: (h) => re.test(h) };
}

let cached = null;

/**
 * Scan `[label, text]` pairs. Returns one hit per (label, term):
 * `{ label, term, why, text }`. Empty array = nothing to sell in sight.
 */
export function scanBannedTerms(entries, terms = (cached ||= bannedTerms())) {
  const hits = [];
  const matchers = terms.map((t) => ({ ...t, m: matcher(t.term) })).filter((t) => t.m);
  for (const [label, value] of entries) {
    const folded = fold(value);
    if (!folded) continue;
    const spaced = normalize(value);
    for (const { term, why, m } of matchers) {
      if (m.test(m.spaced ? spaced : folded)) hits.push({ label, term, why, text: String(value) });
    }
  }
  return hits;
}
