// Every picture beside text shows what that text says (owner 2026-10-27: the tips
// scene, second from last, used to put a grinder on its second row whatever it said).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_WORDS, NEUTRAL_ART, artCandidates, artFits, artProblems, tipArts } from "../src/looks/art-words.mjs";
import { buildCardsData, episodeById, fallbackLessonContent, validateDailyContent } from "./content-format.mjs";
import { episodeSubjects } from "./looks-plates.mjs";
import { scriptOf } from "./print-script.mjs";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const curriculum = JSON.parse(readFileSync(join(rootDir, "data/curriculum.json"), "utf-8"));
const tipsOf = (data) => data.slides.find((s) => s.kind === "lesson-tips").tips;

// The tips of the posts that showed a grinder no row talked about (data/enriched-coffee-news.json at #226-#232).
const AIRED = [
  ["2026-10-22", "i12-soft-water", [["違いが分からない時", "海外の硬水と淹れ比べる"], ["酸っぱすぎる時", "硬度の高めな水で淹れる"]]],
  ["2026-10-23", "i13-iced-ratio", [["薄い時", "お湯を減らして濃くする"], ["濃すぎる時", "お湯を少し増やす"]]],
  ["2026-10-25", "i14-swirl", [["ムラが出る時", "最後に軽く回す"], ["壁に粉が残る時", "最後に軽く回す"]]],
  ["2026-10-27", "a02-extraction-yield", [["苦くなった時", "挽き目を少し戻す"], ["酸っぱい時", "もう少し細かく"]]],
];

test("every plate has words and a label, and the neutral cup is one of them", () => {
  const art = readFileSync(join(rootDir, "src/looks/art.ts"), "utf-8");
  const plates = new Set(art.match(/^export type Subject =([\s\S]*?);/m)[1].match(/"[a-z-]+"/g).map((s) => s.slice(1, -1)));
  assert.deepEqual(new Set(Object.keys(ART_WORDS)), plates, "ART_WORDS covers exactly the plates of src/looks/art.ts");
  for (const [s, { label, words }] of Object.entries(ART_WORDS)) assert.ok(label && words instanceof RegExp, s);
  assert.ok(ART_WORDS[NEUTRAL_ART]);
});

test("the aired days now draw, on each tips row, a plate that row names — no grinder unless it says 挽き目", () => {
  for (const [date, id, rows] of AIRED) {
    const content = fallbackLessonContent(episodeById(id), date);
    if (content.lesson.script) delete content.lesson.script; // the tips scene is drawn only without a script
    content.lesson.tips = rows.map(([problem, fix]) => ({ problem, fix }));
    const data = buildCardsData(content, {});
    assert.deepEqual(artProblems(data), [], date);
    for (const t of tipsOf(data)) {
      assert.equal(t.art === "grinder", /挽き目|細かく$/.test(t.fix), `${date} 「${t.problem} → ${t.fix}」 draws ${t.art}`);
    }
  }
  const swirl = fallbackLessonContent(episodeById("i14-swirl"), "2026-10-25");
  swirl.lesson.tips = AIRED[2][2].map(([problem, fix]) => ({ problem, fix }));
  assert.deepEqual(validateDailyContent(swirl).errors, []);
  assert.deepEqual(tipsOf(buildCardsData(swirl, {})).map((t) => t.art), ["dripper-top", "dripper-top"]);
});

test("a picture its text does not name is stopped; a row that names nothing gets the neutral cup", () => {
  const data = buildCardsData(fallbackLessonContent(episodeById("i13-iced-ratio"), "2026-10-23"), {});
  const tips = tipsOf(data);
  tips[1] = { problem: "濃すぎる時", fix: "お湯を少し増やす", art: "grinder" }; // the old fixed second row
  const problems = artProblems(data);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /grinder/);
  tips[1].art = "no-such-plate";
  assert.match(artProblems(data)[0], /no plate/);

  assert.deepEqual(tipArts([{ problem: "迷う時", fix: "ゆったり構える" }]), [NEUTRAL_ART]);
  assert.ok(artFits(NEUTRAL_ART, "なんでも"));
  assert.ok(!artFits("grinder", "お湯を少し増やす"));
  // the fix wins over the problem, and the row below passes over a plate already shown
  assert.deepEqual(tipArts([{ problem: "薄い時", fix: "挽き目を細かくする" }, { problem: "落ちが遅い時", fix: "中心に細く注ぐ" }]), ["grinder", "dripper-top"]);
  assert.deepEqual(artCandidates("ゆっくり注いで時間を延ばす"), ["timer", "pour"]);
});

// Rows a word list could read in the wrong sense (adversarial review 2026-10-27), and the plate each must not get.
const MISREADS = [
  [["甘さが欲しい時", "ミルクを少し減らす"], "grinder"],
  [["薄い時", "粉を少し足す"], "bypass"],
  [["雑味が出る時", "低く静かに注ぐ"], "pour-high"],
  [["忘れる時", "細かくメモする"], "grinder"],
  [["長すぎる時", "時間を計る"], "scale"],
  [["重い時", "円すいに替える"], "flat-dripper"],
  [["濁る時", "混ぜるのを止める"], "drawdown"],
  [["金属っぽい時", "紙のフィルターに戻す"], "metal-filter"],
  [["高く注ぐと跳ねる", "ケトルを近づける"], "pour-high"],
  [["落ちが遅い時", "少し外側にも注ぐ"], "dripper-top"],
];

test("a word read in another sense does not pick that plate", () => {
  for (const [[problem, fix], not] of MISREADS) {
    const [art] = tipArts([{ problem, fix }]);
    assert.notEqual(art, not, `「${problem} → ${fix}」 draws ${art}`);
  }
  // and the senses that are meant still do
  assert.deepEqual(tipArts([{ problem: "薄い時", fix: "粉を少し足す" }, { problem: "濃すぎる時", fix: "淹れた後にお湯を足す" }]), ["ratio", "bypass"]);
  assert.deepEqual(tipArts([{ problem: "雑味が出る時", fix: "低く静かに注ぐ" }, { problem: "薄い時", fix: "少し高くから注ぐ" }]), ["pour", "pour-high"]);
  assert.deepEqual(tipArts([{ problem: "まだ渋い時", fix: "もう少し早く止める" }, { problem: "酸っぱい時", fix: "もう少し細かく" }]), ["drawdown", "grinder"]);
});

test("every curriculum episode: its cover plate fits its own words, and its evergreen tips draw fitting plates", () => {
  const subjects = episodeSubjects();
  for (const e of curriculum.episodes) {
    const l = e.lesson;
    const own = subjects[e.id];
    assert.ok(artFits(own, [l.word, l.ask, l.hook, l.why, l.topic].join(" ")), `${e.id}: plate ${own} is not named by its cover / hook / why`);
    const content = fallbackLessonContent(e, "2026-10-27");
    if (content.lesson.script) continue;
    assert.deepEqual(artProblems(buildCardsData(content, {})), [], e.id);
  }
});

test("the lab tips scene draws each row's own plate (no fixed doodles), and reader E is told each one", () => {
  const src = readFileSync(join(rootDir, "src/looks/LabConte.tsx"), "utf-8");
  const tipsScene = src.slice(src.indexOf("export const LabTipsConte"), src.indexOf("export const LabSceneConte"));
  assert.match(tipsScene, /<Doodle subject=\{t\.art \?\? NEUTRAL_ART\}/);
  assert.doesNotMatch(tipsScene, /"grinder"|"kettle"|subjectFor/);

  const content = fallbackLessonContent(episodeById("b04-grind"), "2026-10-27");
  const art = scriptOf(content, { art: true });
  assert.match(art, /「薄い時 → 挽き目を細かくする」の横に grinder（手挽きのミルと挽いた粉）/);
  assert.match(art, /表紙の絵 grinder/);
});
