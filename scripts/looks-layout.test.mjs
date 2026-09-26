import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRICULUM, LIMITS, buildCardsData, fallbackLessonContent, validateDailyContent } from "./content-format.mjs";
import { LOW_COLUMN, MARGIN, RIGHT_LIMIT, headingBottom, labLayout, layoutProblems } from "../src/looks/safe-layout.mjs";
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
});

test("every curriculum episode fits: text above the Reels UI, left of the action buttons, the reason always shown", () => {
  for (const ep of CURRICULUM.episodes) {
    const data = built(ep);
    assert.deepEqual(layoutProblems(data, VESSELS), [], ep.id);
    const L = labLayout(data, VESSELS);
    assert.ok(L.visual.fits, `${ep.id}: the diagram's reason does not fit`);
    assert.ok(headingBottom(`${ep.lesson.hook}と`) < 700, `${ep.id}: heading runs three lines`);
  }
});

test("cups follow right under the drawing: no gap between the cup names and the meters", () => {
  for (const ep of CURRICULUM.episodes.filter((e) => e.lesson.motion.type === "compare")) {
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

test("content that cannot fit is reported (validation then falls back instead of hiding text)", () => {
  const data = built(CURRICULUM.episodes.find((e) => e.lesson.visual.type === "scale"));
  data.slides.find((x) => x.kind === "lesson-why").why = "あ".repeat(80);
  assert.ok(layoutProblems(data, VESSELS).some((p) => p.startsWith("diagram: reason")));
  // and validation carries the layout problems (the sample fits)
  const sample = JSON.parse(readFileSync(new URL("../data/samples/brew-lesson.sample.json", import.meta.url), "utf-8"));
  assert.deepEqual(validateDailyContent(sample).errors, []);
});
