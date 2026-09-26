import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRICULUM, LIMITS, buildCardsData, fallbackLessonContent } from "./content-format.mjs";
import {
  COLUMN,
  CONTENT_BOTTOM,
  EFFECT,
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
import { VESSELS, vesselFor } from "../src/looks/vessels-data.mjs";

// Review 2026-09-26 (rounds 1 and 2): no text of the lab look may reach under
// the Reels / Shorts UI — every text block ends at or above contentBottom
// (1560) and, below y 1000, ends left of the action-button column
// (x ≤ 1080 − 96 − 80 = 904) — for every curriculum episode and for the
// longest content a routine may write.

const theme = readFileSync(new URL("../src/cards/theme.ts", import.meta.url), "utf-8");
const RIGHT_LIMIT = 1080 - MARGIN - 80; // 904
const withTo = (l) => (l.endsWith("と") ? l : `${l}と`);

function scenes(data) {
  const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
  const why = s["lesson-why"];
  const kind = vesselFor(why.motion.type);
  const v = VESSELS[kind];
  const labels = kind === "cups" ? [withTo(why.sides[1].label), withTo(why.sides[0].label)] : null;
  return {
    why: whyLayout({ heading: `${why.hook}と`, core: why.core, meters: why.motion.meters.length, box: v.box, maxScale: v.maxScale, labels, labelX: v.labelX }),
    visual: visualLayout({ type: s["lesson-visual"].visual.type, caption: s["lesson-visual"].visual.caption, why: why.why }),
    effect: effectLayout(s["lesson-effect"].sides),
    tips: tipsLayout(s["lesson-tips"].tips),
    end: endLayout(data.ending),
  };
}

/** A text box [top, bottom] × [left, right]: above the UI, and clear of the buttons once below y 1000. */
function box(label, { top, bottom, left, right }) {
  assert.ok(bottom <= CONTENT_BOTTOM, `${label}: ends at y ${bottom} (max ${CONTENT_BOTTOM})`);
  if (bottom > LOW_Y) assert.ok(right <= RIGHT_LIMIT, `${label}: reaches x ${right} below y ${LOW_Y} (max ${RIGHT_LIMIT})`);
  assert.ok(left >= 0 && right <= 1080 && top < bottom, `${label}: outside the frame or empty`);
}

function assertInside(label, L) {
  const w = L.why;
  box(`${label} why core`, { top: w.coreTop, bottom: w.coreBottom, left: w.coreLeft, right: w.coreRight });
  box(`${label} why meters`, { top: w.metersTop, bottom: w.coreTop - 50, left: MARGIN, right: w.coreRight });
  for (const [i, b] of w.labels.entries()) box(`${label} why cup name ${i}`, b);
  const labelH = w.labels.length ? Math.max(...w.labels.map((b) => b.height)) : 0;
  assert.ok(w.metersTop > w.drawnBottom + labelH, `${label} why: the drawing (to ${w.drawnBottom}) runs into the meters (${w.metersTop})`);
  assert.ok(w.scale >= 0.45, `${label} why: the drawing shrank to ${w.scale}`);

  const v = L.visual;
  box(`${label} diagram caption`, { top: v.captionTop, bottom: v.captionBottom, left: MARGIN, right: v.captionTop > LOW_Y ? MARGIN + LOW_COLUMN : MARGIN + COLUMN });
  if (v.showNote) box(`${label} diagram note`, { top: v.noteTop, bottom: v.noteBottom, left: v.noteLeft, right: v.noteLeft + v.noteWidth });

  for (const [i, r] of L.effect.entries()) {
    const left = 60 + EFFECT.cup + 40;
    box(`${label} both ways row ${i}`, { top: r.top, bottom: r.bottom, left, right: left + r.width });
  }
  L.tips.forEach((r, i) => {
    box(`${label} tip ${i}`, { top: r.top, bottom: r.bottom, left: MARGIN, right: MARGIN + r.width + 20 + r.doodle });
    if (i > 0) assert.ok(r.top >= L.tips[i - 1].bottom + 10, `${label} tip ${i}: overlaps the tip above`);
  });
  const e = L.end;
  box(`${label} ending next`, { top: e.nextTop, bottom: e.nextBottom, left: MARGIN, right: e.lowRight });
  box(`${label} ending signature`, { top: e.signatureTop, bottom: e.bottom, left: MARGIN, right: e.lowRight });
}

test("the layout uses the theme's content bottom and clearance", () => {
  assert.match(theme, /contentBottom: 1560/);
  assert.match(theme, /actionColumnClearance: 80/);
  assert.equal(LOW_COLUMN, 1080 - MARGIN * 2 - 80);
  assert.equal(MARGIN + LOW_COLUMN, RIGHT_LIMIT);
});

test("every curriculum episode: all lab-look text ends above the Reels UI and left of the action buttons", () => {
  for (const ep of CURRICULUM.episodes) {
    const data = buildCardsData(fallbackLessonContent(ep, "2026-09-27"), {});
    assertInside(ep.id, scenes(data));
    assert.ok(headingBottom(`${ep.lesson.hook}と`) < 700, `${ep.id}: heading runs three lines`);
  }
});

test("the longest content a routine may write still fits", () => {
  const base = buildCardsData(fallbackLessonContent(CURRICULUM.episodes[0], "2026-09-27"), {});
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
      assertInside(`max ${type}/${vtype}`, scenes(data));
    }
  }
});
