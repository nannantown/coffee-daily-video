import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULUM, LIMITS, buildCardsData, fallbackLessonContent } from "./content-format.mjs";
import {
  CONTENT_BOTTOM,
  LOW_COLUMN,
  LOW_Y,
  MARGIN,
  effectLayout,
  endLayout,
  headingBottom,
  tipsLayout,
  visualLayout,
  whyLayout,
} from "../src/looks/safe-layout.mjs";

// Review 2026-09-26: no text of the lab look may reach under the Reels /
// Shorts UI (SPACE.contentBottom 1560 in src/cards/theme.ts), for any
// curriculum episode and for the longest content a routine may write.

const theme = await import("node:fs").then((fs) => fs.readFileSync(new URL("../src/cards/theme.ts", import.meta.url), "utf-8"));
const BOXES = {
  server: { box: { top: 600, bottom: 1340 }, maxScale: 0.85 },
  dripper: { box: { top: 640, bottom: 1440 }, maxScale: 0.85 },
  cups: { box: { top: 890, bottom: 1230 }, maxScale: 1.2 },
};
const vesselFor = (type) => (type === "compare" ? "cups" : type === "dissolve" ? "dripper" : "server");
const long = (n) => "あ".repeat(n);

function scenes(data) {
  const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
  const why = s["lesson-why"];
  const v = BOXES[vesselFor(why.motion.type)];
  return {
    why: whyLayout({ heading: `${why.hook}と`, core: why.core, meters: why.motion.meters.length, ...v, labels: why.motion.type === "compare" }),
    visual: visualLayout({ type: s["lesson-visual"].visual.type, caption: s["lesson-visual"].visual.caption, why: why.why }),
    effect: effectLayout(s["lesson-effect"].sides),
    tips: tipsLayout(s["lesson-tips"].tips),
    end: endLayout(data.ending),
  };
}

function assertInside(label, L) {
  assert.ok(L.why.coreBottom <= CONTENT_BOTTOM, `${label} why: core ends at ${L.why.coreBottom}`);
  assert.ok(L.why.metersTop > L.why.drawnBottom, `${label} why: the drawing (to ${L.why.drawnBottom}) runs into the meters (${L.why.metersTop})`);
  assert.ok(L.why.scale >= 0.45, `${label} why: the drawing shrank to ${L.why.scale}`);
  assert.ok(L.visual.captionBottom <= CONTENT_BOTTOM, `${label} diagram: caption ends at ${L.visual.captionBottom}`);
  if (L.visual.showNote) assert.ok(L.visual.noteBottom <= CONTENT_BOTTOM, `${label} diagram: note ends at ${L.visual.noteBottom}`);
  for (const [i, r] of L.effect.entries()) {
    assert.ok(r.bottom <= CONTENT_BOTTOM, `${label} both ways row ${i}: ends at ${r.bottom}`);
    if (r.top + 200 > LOW_Y) assert.ok(60 + 400 + 40 + r.width <= 1080 - MARGIN - 80, `${label} both ways row ${i}: into the action column`);
  }
  L.tips.forEach((r, i) => {
    assert.ok(r.bottom <= CONTENT_BOTTOM, `${label} tip ${i}: ends at ${r.bottom}`);
    if (i > 0) assert.ok(r.top >= L.tips[i - 1].bottom + 10, `${label} tip ${i}: overlaps the tip above`);
    assert.ok(MARGIN + r.width + 20 + r.doodle <= 1080 - MARGIN - 80, `${label} tip ${i}: into the action column`);
  });
  assert.ok(L.end.bottom <= CONTENT_BOTTOM, `${label} ending: signature ends at ${L.end.bottom}`);
}

test("the layout uses the theme's content bottom and clearance", () => {
  assert.match(theme, /contentBottom: 1560/);
  assert.match(theme, /actionColumnClearance: 80/);
  assert.equal(LOW_COLUMN, 1080 - MARGIN * 2 - 80);
});

test("every curriculum episode: all lab-look text ends above the Reels UI", () => {
  for (const ep of CURRICULUM.episodes) {
    const data = buildCardsData(fallbackLessonContent(ep, "2026-09-27"), {});
    assertInside(ep.id, scenes(data));
    assert.ok(headingBottom(`${ep.lesson.hook}と`) < 700, `${ep.id}: heading runs three lines`);
  }
});

test("the longest content a routine may write still fits", () => {
  const base = buildCardsData(fallbackLessonContent(CURRICULUM.episodes[0], "2026-09-27"), {});
  for (const type of ["liquid", "meter", "compare", "dissolve"]) {
    for (const vtype of ["compare", "graph", "flow", "scale"]) {
      const data = structuredClone(base);
      const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
      // word / ask / hook are fixed by the curriculum (validateLesson), so its longest hook is the worst case
      s["lesson-why"].hook = CURRICULUM.episodes.map((e) => e.lesson.hook).sort((a, b) => b.length - a.length)[0];
      s["lesson-why"].core = long(LIMITS.core);
      s["lesson-why"].why = long(LIMITS.why);
      s["lesson-why"].motion = { type, shade: { from: 0, to: 100 }, meters: [1, 2, 3].map((i) => ({ label: long(LIMITS.meterLabel - (i % 2)), from: 0, to: 100 })) };
      s["lesson-visual"].visual = { ...s["lesson-visual"].visual, type: vtype, caption: long(LIMITS.visualCaption) };
      s["lesson-effect"].sides = [0, 1].map(() => ({ label: long(LIMITS.effectLabel), taste: long(LIMITS.effectTaste) }));
      s["lesson-tips"].tips = [0, 1, 2].map(() => ({ problem: long(LIMITS.tipProblem), fix: long(LIMITS.tipFix) }));
      data.ending.next = long(LIMITS.word + LIMITS.ask);
      assertInside(`max ${type}/${vtype}`, scenes(data));
    }
  }
});
