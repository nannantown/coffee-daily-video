import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRICULUM, LIMITS, buildCardsData, fallbackLessonContent, validateDailyContent } from "./content-format.mjs";
import { CLASSIC, LOW_COLUMN, MARGIN, RIGHT_LIMIT, SCENE, SCENE_ART, classicPremiseHeight, classicSceneHeight, classicPremiseNote, headingBottom, labLayout, layoutProblems } from "../src/looks/safe-layout.mjs";
import { VESSELS } from "../src/looks/vessels-data.mjs";

// Review 2026-09-26 (rounds 1-3): every text of the lab look sits where the
// Reels / Shorts UI leaves it readable — bottom ≤ contentBottom (1560) and,
// below y 1000, right edge ≤ 904 (action buttons) — and the diagram scene's
// reason (lesson.why) is always on screen, for every curriculum episode and
// for the longest content a routine may write. Vessel sizes come from
// src/looks/vessels-data.mjs, the same numbers the renderer uses.

const theme = readFileSync(new URL("../src/cards/theme.ts", import.meta.url), "utf-8");
const built = (ep) => buildCardsData(fallbackLessonContent(ep, "2026-09-27"), {});

test("the layout uses the theme's content bottom and clearance", () => {
  assert.match(theme, /contentBottom: 1560/);
  assert.match(theme, /actionColumnClearance: 80/);
  assert.equal(LOW_COLUMN, 1080 - MARGIN * 2 - 80);
  assert.equal(MARGIN + LOW_COLUMN, RIGHT_LIMIT);
  assert.equal(RIGHT_LIMIT, 904);
  // the classic cards' column (SlideShell): contentTop..contentBottom inset by DRIFT_MAX, margin 80 + clearance 80
  assert.match(theme, /contentTop: 340/);
  assert.match(theme, /DRIFT_MAX = 8;/);
  assert.match(theme, /margin: 80/);
  assert.equal(CLASSIC.column, 1560 - 340 - 2 * 8);
  assert.equal(CLASSIC.width, 1080 - (80 + 8) * 2 - 80);
});

test("every curriculum episode fits: text above the Reels UI, left of the action buttons, the reason always shown", () => {
  for (const ep of CURRICULUM.episodes) {
    const data = built(ep);
    assert.deepEqual(layoutProblems(data, VESSELS), [], ep.id);
    if (ep.lesson.script) continue; // a script episode has its own scenes (tested below)
    const L = labLayout(data, VESSELS);
    assert.ok(L.visual.fits, `${ep.id}: the diagram's reason does not fit`);
    assert.ok(headingBottom(`${ep.lesson.hook}と`) < 700, `${ep.id}: heading runs three lines`);
  }
});

test("cups follow right under the drawing: no gap between the cup names and the meters", () => {
  for (const ep of CURRICULUM.episodes.filter((e) => e.lesson.motion.type === "compare" && !e.lesson.script)) {
    const w = labLayout(built(ep), VESSELS).why;
    const namesBottom = Math.max(...w.labels.map((b) => b.bottom));
    assert.ok(w.metersTop - namesBottom <= 60, `${ep.id}: ${Math.round(w.metersTop - namesBottom)}px between the cup names and the meters`);
  }
});

test("the longest content a routine may write still fits", () => {
  const base = built(CURRICULUM.episodes[0]);
  const longest = (xs) => [...xs].sort((a, b) => b.length - a.length)[0];
  const long = (n) => "あ".repeat(n);
  for (const type of ["liquid", "meter", "compare", "dissolve"]) {
    for (const vtype of ["compare", "graph", "flow", "scale"]) {
      const data = structuredClone(base);
      const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
      // word / ask / hook are fixed by the curriculum (validateLesson), so its longest hook is the worst case
      s["lesson-why"].hook = longest(CURRICULUM.episodes.map((e) => e.lesson.hook));
      s["lesson-why"].core = long(LIMITS.core);
      s["lesson-why"].why = long(LIMITS.why);
      s["lesson-why"].motion = { type, shade: { from: 0, to: 100 }, meters: [1, 2, 3].map((i) => ({ label: long(LIMITS.meterLabel - (i % 2)), from: 0, to: 100 })) };
      s["lesson-why"].sides = [0, 1].map(() => ({ label: long(LIMITS.effectLabel), taste: long(LIMITS.effectTaste) }));
      s["lesson-visual"].visual = { ...s["lesson-visual"].visual, type: vtype, caption: long(LIMITS.visualCaption) };
      s["lesson-effect"].sides = [0, 1].map(() => ({ label: long(LIMITS.effectLabel), taste: long(LIMITS.effectTaste) }));
      s["lesson-tips"].tips = [0, 1, 2].map(() => ({ problem: long(LIMITS.tipProblem), fix: long(LIMITS.tipFix) }));
      data.ending.next = long(LIMITS.word + LIMITS.ask);
      assert.deepEqual(layoutProblems(data, VESSELS), [], `max ${type}/${vtype}`);
    }
  }
});

test("the classic cards' premise slide is checked too: the curriculum's premises fit, a note that needs a 3rd line under the tallest flow does not", () => {
  const withPremise = CURRICULUM.episodes.filter((e) => e.lesson.premise);
  assert.ok(withPremise.length >= 3);
  for (const ep of withPremise) {
    const ps = built(ep).slides.find((x) => x.kind === "lesson-premise");
    assert.ok(classicPremiseHeight({ type: ps.visual.type, caption: ps.visual.caption, note: classicPremiseNote(ps) }) <= CLASSIC.column, ep.id);
  }
  const data = built(withPremise[0]);
  const ps = data.slides.find((x) => x.kind === "lesson-premise");
  ps.visual = { ...ps.visual, caption: "あ".repeat(LIMITS.visualCaption) };
  ps.term = "あ".repeat(LIMITS.premiseTerm);
  ps.say = "あ".repeat(LIMITS.premiseSay);
  assert.ok(layoutProblems(data, VESSELS).some((p) => p.startsWith("classic cards: premise slide")));
});

test("content that cannot fit is reported (validation then falls back instead of hiding text)", () => {
  const data = built(CURRICULUM.episodes.find((e) => e.lesson.visual.type === "scale"));
  data.slides.find((x) => x.kind === "lesson-why").why = "あ".repeat(80);
  assert.ok(layoutProblems(data, VESSELS).some((p) => p.startsWith("diagram: reason")));
  // and validation carries the layout problems (the sample fits)
  const sample = JSON.parse(readFileSync(new URL("../data/samples/brew-lesson.sample.json", import.meta.url), "utf-8"));
  assert.deepEqual(validateDailyContent(sample).errors, []);
});

// Script scenes (lesson.script, 2026-10-20): the approved script's words above the
// Reels UI, its drawing as large as the room allows; too much text is reported.
test("script scenes fit: text above the UI and left of the action buttons, the drawing big enough, the classic fallback too", () => {
  const scripted = CURRICULUM.episodes.filter((e) => e.lesson.script);
  assert.ok(scripted.length >= 1);
  for (const ep of scripted) {
    const data = built(ep);
    const L = labLayout(data, VESSELS);
    assert.equal(L.scenes.length, ep.lesson.script.scenes.length);
    for (const [i, sc] of L.scenes.entries()) {
      assert.ok(sc.textBottom <= 1560, `${ep.id} scene ${i + 1}: text ends at ${sc.textBottom}`);
      assert.ok(sc.items.every((b) => b.right <= RIGHT_LIMIT), `${ep.id} scene ${i + 1}`);
      assert.ok(sc.art.top >= sc.textBottom + SCENE.artGap - 0.5, `${ep.id} scene ${i + 1}: the drawing runs into the text`);
      assert.ok(sc.art.top + sc.art.height <= SCENE.artBottom + 0.5, `${ep.id} scene ${i + 1}: the drawing runs past ${SCENE.artBottom}`);
      assert.ok(sc.art.height >= SCENE.artMinHeight, `${ep.id} scene ${i + 1}: drawing ${Math.round(sc.art.height)}px`);
      assert.ok(sc.size >= 48, "body never below 48px (30pt+)");
    }
  }
  // a word inside a drawing is checked where the drawing puts it (review 2026-10-20)
  const word = SCENE_ART.minerals.texts[0];
  const saved = { ...word };
  try {
    Object.assign(word, { cy: 690 });
    assert.ok(layoutProblems(built(scripted[0]), VESSELS).some((p) => p.includes("「Ca」 in the drawing")));
    Object.assign(word, { cy: saved.cy, size: 30 });
    assert.ok(layoutProblems(built(scripted[0]), VESSELS).some((p) => p.includes("「Ca」 in the drawing is")));
  } finally {
    Object.assign(word, saved);
  }
  assert.deepEqual(layoutProblems(built(scripted[0]), VESSELS), []);
  const data = built(scripted[0]);
  const scene = data.slides.find((x) => x.kind === "lesson-scene");
  scene.body = [0, 1, 2, 3].map(() => ({ lead: "あ".repeat(LIMITS.sceneLead), result: "あ".repeat(LIMITS.sceneResult) }));
  const problems = layoutProblems(data, VESSELS);
  assert.ok(problems.some((p) => p.startsWith("scene 1:")), problems.join("\n"));
  assert.ok(classicSceneHeight(scene) > CLASSIC.column || problems.length > 0);
});
