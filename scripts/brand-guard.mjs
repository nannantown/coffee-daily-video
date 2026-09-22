/**
 * Brand guard — the machine check behind the owner's 2026-09-22 decision:
 * while the channel is in its audience-growth phase, nothing we sell may
 * appear in a video, a title or a caption.
 *
 * Banned, in every published text:
 *   1. our own coffees — every name / origin / process / flavour wording in
 *      data/coffee-lineup.json, plus the shop's own name, brand and EC host
 *      (read from the file, so retiring or adding a bean keeps the guard true)
 *   2. producing-country names in general — a viewer does not own that coffee,
 *      and naming one is what the owner asked us to stop
 *   3. anything that sells — purchase / wholesale / DM / shop / order wording
 *
 * Allowed on purpose: 浅煎り / 中煎り / 深煎り and other general roast or
 * brewing vocabulary (the channel teaches exactly that).
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
  "イルガチェフェ", "シダモ", "グジ", "コチャレ", "デーホン", "フムレ", "マバンザ", "ゴールドマウンテン", "ブルーマウンテン", "キリマンジャロ",
  "ゲイシャ", "ティピカ", "ブルボン", "パカマラ", "SL28", "SL34",
];

/** Selling. The growth phase asks for a save and a follow, nothing else. */
export const SALES_TERMS = [
  "ご購入", "購入", "お買い", "買える", "販売", "発売", "売って", "通販", "オンラインショップ", "ネットショップ",
  "ご注文", "注文", "卸", "取り扱い", "在庫", "送料", "定期便", "お取り寄せ", "ギフト", "プレゼント企画",
  "DM", "ディーエム", "プロフィールのリンク", "リンクはプロフィール", "公式サイト", "自家焙煎", "焙煎所", "当店", "弊社",
  "open-ground", "openground", "OPEN GROUND", "オープングラウンド",
];

function lineupTerms() {
  let lineup;
  try {
    lineup = JSON.parse(readFileSync(join(rootDir, "data", "coffee-lineup.json"), "utf-8"));
  } catch {
    return []; // the file may be removed one day; the static lists still hold
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
    // A multi-word bean name is also banned word by word ("ブルンジ マバンザ …" → "マバンザ").
    for (const key of ["name", "displayName", "spokenName"]) {
      push(bean[key]);
      for (const part of String(bean[key] ?? "").split(/[\s・×]+/u)) push(part);
    }
    // Identity of the lot, banned whole — never split, so a tasting word is not
    // caught by accident. Flavour wording (flavor / labelFlavor) is NOT banned:
    // "キャラメル" or "citrus" is ordinary tasting vocabulary the lessons need.
    for (const key of ["origin", "region", "farm", "variety", "process", "processShort"]) push(bean[key]);
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

let cached = null;

/**
 * Scan `[label, text]` pairs. Returns one hit per (label, term):
 * `{ label, term, why, text }`. Empty array = nothing to sell in sight.
 */
export function scanBannedTerms(entries, terms = (cached ||= bannedTerms())) {
  const hits = [];
  for (const [label, value] of entries) {
    const haystack = String(value ?? "").normalize("NFKC").toLowerCase();
    if (!haystack) continue;
    for (const { term, why } of terms) {
      if (haystack.includes(term.normalize("NFKC").toLowerCase())) hits.push({ label, term, why, text: String(value) });
    }
  }
  return hits;
}
