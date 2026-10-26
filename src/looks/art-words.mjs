/**
 * Which plate (public/looks/lab-<subject>.png, src/looks/art.ts) a line of text may
 * carry. A plate is drawn next to text only when the text names what the plate shows
 * (owner 2026-10-27: 「文章と画像が合ってない…合ったものを入れよう」 — the tips slide
 * used to put a grinder on its second row whatever the row said). `cup` (a cup of
 * black coffee) is the neutral picture: every line here is about the coffee in the cup,
 * so it never says something the text does not.
 *
 * `label` is what the plate shows, in the words reader E reads (scripts/print-script.mjs --art).
 * Order is preference: the first subject a text names wins.
 */
export const NEUTRAL_ART = "cup";

export const ART_WORDS = {
  dial: { label: "手挽きミルの目盛り", words: /目盛り|ダイヤル|手前に戻す|少しずつ動か|少しだけ動か/ },
  sieve: { label: "茶こしで粉をふるう", words: /微粉|茶こし|ふるう|ふるっ|ふるい/ },
  grinder: { label: "手挽きのミルと挽いた粉", words: /挽き|挽い|挽く|(?:細かく|粗く)(?:挽|する|戻|$)|グラインダー|ミル(?!ク)/ },
  bloom: { label: "蒸らしで膨らむ粉", words: /蒸らし|膨ら|ふくら|ガス/ },
  "beans-dark": { label: "深煎りの豆とケトル", words: /深煎り/ },
  "beans-light": { label: "浅煎りの豆とケトル", words: /浅煎り/ },
  kettle: { label: "湯気の立つケトル", words: /湯温|温度|熱め|ぬるめ|熱い/ },
  iced: { label: "氷の入ったアイスコーヒー", words: /氷|アイス/ },
  water: { label: "グラスの水とケトル", words: /硬水|軟水|硬度|水道水|浄水/ },
  "metal-filter": { label: "金属のフィルター", words: /金属|メタル/ },
  "flat-dripper": { label: "平底のドリッパー", words: /平底/ },
  clever: { label: "マグに載せた浸漬式ドリッパー", words: /クレバー|浸して待つ|待ってから落と/ },
  bypass: { label: "コーヒーにお湯を足す", words: /足し湯|お湯を(?:少し|少しずつ)?足|お湯で(?:割|薄め)|少しずつ足す/ },
  scale: { label: "はかりに載せたドリッパー", words: /量る|はかり|計量|目分量|(?:粉|お湯|量)を計る/ },
  ratio: { label: "粉のスプーンとケトル", words: /比率|お湯の量|粉の量|お湯を(?:少し)?(?:減ら|増や)|粉を(?:少し)?(?:減ら|増や|足)|豆を(?:少し)?(?:減ら|増や|足)|濃く淹れ/ },
  "pour-high": { label: "高くから細く注ぐ", words: /高さ|高くから|高い位置/ },
  "dripper-top": { label: "上から見たドリッパーの粉の層（真ん中に湯）", words: /中心|真ん中|回す|回し|粉の層/ },
  drawdown: { label: "ドリッパーから落ちる最後のしずく", words: /落とし切|落ちが|落とす|落ちる|(?:早め|早く|途中)に?で?止め|抽出を(?:早めに)?止め|最後の湯|残す量/ },
  timer: { label: "砂時計と蒸らし中のドリッパー", words: /待つ|待って|時間/ },
  mug: { label: "マグで浸す粉とスプーン", words: /マグ|上ずみ/ },
  press: { label: "フレンチプレス", words: /浸漬|浸す|浸して|プレス/ },
  pour: { label: "ケトルからドリッパーに注ぐ", words: /注ぐ|注い|注ぎ|抽出/ },
  bed: { label: "淹れ終わった粉の層", words: /収率|出がらし|溶け出した/ },
  "two-cups": { label: "濃さの違う 2 杯", words: /淹れ比べ|比べ|違い/ },
  notebook: { label: "ノートと鉛筆とコーヒー", words: /ひとつだけ|1つだけ|メモ|記録|いつもの淹れ方/ },
  "cup-light": { label: "薄い色のコーヒー", words: /未抽出|薄い|薄く|軽すぎ|物足りな/ },
  cup: { label: "ブラックコーヒーの 1 杯", words: /過抽出|TDS|苦|渋|雑味|濃|重|味|酸/ },
};

/** Every subject a text names, in preference order. */
export const artCandidates = (text) => Object.keys(ART_WORDS).filter((s) => ART_WORDS[s].words.test(text));

/** Whether a plate may sit next to this text: the text names it, or it is the neutral cup. */
export const artFits = (subject, text) => subject === NEUTRAL_ART || Boolean(ART_WORDS[subject]?.words.test(text));

/**
 * One plate per tips row, from that row's own words: what the fix names (the picture
 * shows what to do) or, when the fix names nothing, a symptom the problem names (never a
 * tool from the problem: 「金属っぽい時 → 紙に戻す」 must not draw the metal filter); among
 * those, one the row above does not already show. A row that names none gets the neutral cup.
 */
const SYMPTOMS = ["cup-light", "cup", "drawdown", "bloom"];
export function tipArts(tips) {
  const used = [];
  for (const t of tips) {
    const fix = artCandidates(t.fix);
    const names = fix.length ? fix : artCandidates(t.problem).filter((s) => SYMPTOMS.includes(s));
    used.push(names.find((s) => !used.includes(s)) ?? names[0] ?? NEUTRAL_ART);
  }
  return used;
}

/**
 * Every tips row whose plate its text does not name, or that has no plate. This guards the
 * build and the renderer (no fixed or stale picture reaches the video); whether a word was
 * read in the right sense is reader E's look at `print-script.mjs --art` (docs/script-pipeline.md).
 */
export function artProblems(data) {
  const out = [];
  data.slides.forEach((s, i) => {
    if (s.kind !== "lesson-tips") return;
    s.tips.forEach((t, j) => {
      if (!ART_WORDS[t.art]) out.push(`slides[${i}].tips[${j}] has no plate (art ${JSON.stringify(t.art)})`);
      else if (!artFits(t.art, `${t.problem} ${t.fix}`)) out.push(`slides[${i}].tips[${j}] draws ${t.art} (${ART_WORDS[t.art].label}) next to 「${t.problem} → ${t.fix}」, which does not name it`);
    });
  });
  return out;
}
