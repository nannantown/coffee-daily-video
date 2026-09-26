/**
 * Where the lab look (ラボノート) puts its text, computed so that no text ever
 * reaches under the Instagram / YouTube UI: every text block ends at or above
 * CONTENT_BOTTOM (src/cards/theme.ts SPACE.contentBottom), and blocks below
 * y 1000 keep the 80px action-column clearance on the right (review
 * 2026-09-26). Pictures may go lower; text may not.
 *
 * Plain JS so the renderer (src/looks/*.tsx) and the tests
 * (scripts/looks-layout.test.mjs) use the very same numbers.
 */

export const CONTENT_BOTTOM = 1560;
export const MARGIN = 96;
export const COLUMN = 1080 - MARGIN * 2; // 888
export const LOW_COLUMN = COLUMN - 80; // 808, text below y 1000 (action-column clearance)
export const LOW_Y = 1000;

/** Line height the lab look uses for a font size. */
export const lineHeight = (size) => Math.ceil(size * (size >= 64 ? 1.3 : 1.5));

/**
 * Lines a text wraps to at `size` px in `width` px. CJK glyphs are one em wide
 * (+ the letter spacing); ASCII counts half. Conservative: phrase breaking
 * (PHRASE_BREAK) only ever wraps earlier, which this rounds up for.
 */
export function lineCount(text, size, width, spacing = 0.04) {
  const units = [...String(text ?? "")].reduce((n, c) => n + (c.charCodeAt(0) < 0x2e80 ? 0.55 : 1), 0);
  if (units === 0) return 0;
  const perLine = Math.max(1, Math.floor(width / (size * (1 + spacing))));
  // phrase breaking can push up to ~2 characters to the next line
  return Math.ceil(units / Math.max(1, perLine - 2));
}

export const textHeight = (text, size, width, spacing) => lineCount(text, size, width, spacing) * lineHeight(size);

/** The heading block of every lab scene (grey label + 96px heading), and where content may start. */
export const HEADING = { labelTop: 290, top: 372, size: 96 };
// headings are set with 0.01em letter spacing (LabHeading)
export const headingBottom = (heading) => HEADING.top + textHeight(heading, HEADING.size, COLUMN, 0.01) + 14;

// ---------------------------------------------------------------------------
// why scene (src/looks/PencilMotion.tsx)
// ---------------------------------------------------------------------------

export const WHY = {
  meterRow: 64, // one meter row (label 52px, bar 40px)
  meterGap: (n) => (n > 2 ? 86 : 100),
  coreSize: 48,
  ruleGap: 50, // gap + hairline + gap between the meters and the core line
  vesselGap: 30,
  cupLabelSize: 48,
};

/**
 * The why scene, bottom up: the core line ends at CONTENT_BOTTOM, the meters
 * sit above it, and the drawing gets whatever is left under the heading.
 * `box` is the drawing's bounding box on its 1080x1920 plate (vessels.ts).
 */
export function whyLayout({ heading, core, meters, box, maxScale, labels = null }) {
  const n = Math.max(1, meters);
  const gap = WHY.meterGap(n);
  // the core line sits below y LOW_Y: it keeps the action-column clearance
  const coreH = textHeight(core, WHY.coreSize, LOW_COLUMN);
  const coreTop = CONTENT_BOTTOM - coreH;
  const metersBottom = coreTop - WHY.ruleGap;
  const metersTop = metersBottom - ((n - 1) * gap + WHY.meterRow);
  const headTop = headingBottom(heading) + 20;
  // cups: the names go under the cups — the other way under the left cup, today's under the right —
  // each in half the column, the right one ending left of the action buttons (x ≤ 1080 − MARGIN − 80)
  const labelBoxes = (labels ?? []).map((text, i) => {
    const left = i === 0 ? MARGIN : 540 + 20;
    const right = i === 0 ? 540 - 20 : 1080 - MARGIN - 80;
    return { text, left, right, width: right - left, height: textHeight(text, WHY.cupLabelSize, right - left) };
  });
  const labelH = labelBoxes.length ? Math.max(...labelBoxes.map((b) => b.height)) + 10 : 0;
  const avail = metersTop - WHY.vesselGap - labelH - headTop;
  const scale = Math.max(0.3, Math.min(maxScale, avail / (box.bottom - box.top)));
  const drawnH = (box.bottom - box.top) * scale;
  // when the drawing is capped at maxScale, it moves down so the names / meters follow right under it
  const top = metersTop - WHY.vesselGap - labelH - drawnH;
  const drawnBottom = top + drawnH;
  const labelTop = drawnBottom + 10;
  for (const b of labelBoxes) {
    b.top = labelTop;
    b.bottom = labelTop + b.height;
  }
  return { gap, coreTop, coreBottom: coreTop + coreH, coreLeft: MARGIN, coreRight: MARGIN + LOW_COLUMN, metersTop, headTop, top, scale, drawnBottom, labelTop, labels: labelBoxes };
}

// ---------------------------------------------------------------------------
// diagram scene (src/looks/LabConte.tsx LabVisualConte)
// ---------------------------------------------------------------------------

/** Drawn sizes the lab look passes to DiagramBody (flow brewer height, graph plot height, cup size). */
export const DIAGRAM_SIZE = { flow: 370, graph: 450, cup: 180 };
/** Drawn height of each kind at those sizes: measured on all 36 episodes (graph 566, compare 575, flow 570) + margin. */
export const DIAGRAM_HEIGHT = { compare: 585, graph: 576, flow: 580, scale: 0 };
export const DIAGRAM_TOP = 650;
/** The hand-drawn gauge (scale diagrams): centre, radius; its caption starts under the needle hub. */
export const GAUGE = { cy: 1090, r: 360 };
export const SCALE_CAPTION_TOP = GAUGE.cy + 34 + 26;
export const captionSize = (type) => (type === "scale" ? 64 : 48); // under a tall diagram the caption steps down
export const NOTE_SIZE = 40; // the reason line (30pt minimum)
const NOTE_RULE = 26; // hairline + gap above the reason
/** Gauge episodes: the episode's drawing left, the reason right of it (as in the approved storyboard). */
export const SCALE_DOODLE = { left: 40, size: 360 };

/**
 * Caption and the reason (lesson.why) under the diagram. The reason is always
 * shown (owner-approved storyboard); content whose reason does not fit fails
 * validation (layoutProblems) and the day falls back to the evergreen lesson.
 */
export function visualLayout({ type, caption, why }) {
  const scale = type === "scale";
  const captionTop = scale ? SCALE_CAPTION_TOP : DIAGRAM_TOP + DIAGRAM_HEIGHT[type] + 12;
  const size = captionSize(type);
  const captionBottom = captionTop + textHeight(caption, size, captionTop > LOW_Y ? LOW_COLUMN : COLUMN);
  const bandTop = captionBottom + 20;
  const noteLeft = scale ? SCALE_DOODLE.left + SCALE_DOODLE.size + 20 : MARGIN;
  const noteWidth = 1080 - MARGIN - 80 - noteLeft;
  const noteTop = bandTop + NOTE_RULE;
  const noteBottom = noteTop + textHeight(why, NOTE_SIZE, noteWidth);
  return { captionTop, captionSize: size, captionBottom, bandTop, noteLeft, noteWidth, noteTop, noteBottom, fits: noteBottom <= CONTENT_BOTTOM, doodle: scale };
}

// ---------------------------------------------------------------------------
// both ways (LabEffectConte) and tips (LabTipsConte)
// ---------------------------------------------------------------------------

export const EFFECT = { top: 560, pitch: 450, cup: 400, labelSize: 64, tasteSize: 56 };
/** Text column right of the cup; rows below LOW_Y keep the action-column clearance. */
export function effectLayout(rows) {
  return rows.map((r, i) => {
    const top = EFFECT.top + i * EFFECT.pitch;
    const width = 1080 - 60 - EFFECT.cup - 40 - (top + 200 > LOW_Y ? MARGIN + 80 : MARGIN);
    const labelH = textHeight(`${r.label}と →`, EFFECT.labelSize, width);
    const bottom = top + Math.max(labelH + 12 + textHeight(r.taste, EFFECT.tasteSize, width), 0);
    return { top, width, bottom };
  });
}

export const TIPS = { top: 580, doodle: 320, gap: 20 };
export function tipsLayout(tips) {
  const three = tips.length > 2;
  const problemSize = three ? 48 : 64;
  const fixSize = three ? 44 : 56;
  const pitch = three ? 300 : 470;
  const doodle = three ? 240 : TIPS.doodle;
  return tips.map((t, i) => {
    const top = TIPS.top + i * pitch;
    const width = 1080 - MARGIN - doodle - TIPS.gap - (MARGIN + 80);
    const bottom = top + textHeight(t.problem, problemSize, width) + 10 + textHeight(`→ ${t.fix}`, fixSize, width);
    return { top, width, bottom, problemSize, fixSize, pitch, doodle };
  });
}

// ---------------------------------------------------------------------------
// ending (LabEndConte)
// ---------------------------------------------------------------------------

export const END = { linesTop: 680, lineSize: 44, nextSize: 64, labelSize: 44, signatureSize: 32 };
export function endLayout({ heading, lines, next }) {
  const linesTop = Math.max(END.linesTop, headingBottom(heading) + 40);
  const linesBottom = linesTop + lines.reduce((h, l) => h + textHeight(l, END.lineSize, COLUMN), 0) + 58;
  const nextTop = linesBottom + 10;
  // the 次回 line and the signature may reach below y LOW_Y: they keep the action-column clearance
  const nextBottom = next ? nextTop + lineHeight(END.labelSize) + textHeight(next, END.nextSize, LOW_COLUMN) : nextTop;
  const signatureTop = nextBottom + 30;
  return { linesTop, nextTop, nextBottom, signatureTop, bottom: signatureTop + lineHeight(END.signatureSize), stillTop: signatureTop + 80, lowRight: MARGIN + LOW_COLUMN };
}

// ---------------------------------------------------------------------------
// every scene of one episode, checked
// ---------------------------------------------------------------------------

export const RIGHT_LIMIT = 1080 - MARGIN - 80; // 904: text below LOW_Y ends here (action buttons)
const withTo = (l) => (String(l).endsWith("と") ? l : `${l}と`);

/** The lab look's text boxes for one built episode (content-format.mjs buildCardsData). */
export function labLayout(data, vessels) {
  const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
  const why = s["lesson-why"];
  const kind = why.motion.type === "compare" ? "cups" : why.motion.type === "dissolve" ? "dripper" : "server";
  const v = vessels[kind];
  const labels = kind === "cups" ? [withTo(why.sides[1].label), withTo(why.sides[0].label)] : null;
  return {
    why: whyLayout({ heading: `${why.hook}と`, core: why.core, meters: why.motion.meters.length, box: v.box, maxScale: v.maxScale, labels }),
    visual: visualLayout({ type: s["lesson-visual"].visual.type, caption: s["lesson-visual"].visual.caption, why: why.why }),
    effect: effectLayout(s["lesson-effect"].sides),
    tips: tipsLayout(s["lesson-tips"].tips),
    end: endLayout(data.ending),
  };
}

/**
 * Why an episode would not fit the lab look (empty = fits): a text box below
 * CONTENT_BOTTOM, into the action-button column below LOW_Y, or a scene that
 * cannot hold its text. Used by the tests and by content validation.
 */
export function layoutProblems(data, vessels) {
  const L = labLayout(data, vessels);
  const out = [];
  const box = (label, { top, bottom, left, right }) => {
    if (bottom > CONTENT_BOTTOM) out.push(`${label} ends at y ${Math.round(bottom)} (max ${CONTENT_BOTTOM})`);
    if (bottom > LOW_Y && right > RIGHT_LIMIT) out.push(`${label} reaches x ${Math.round(right)} below y ${LOW_Y} (max ${RIGHT_LIMIT})`);
    if (left < 0 || right > 1080 || !(top < bottom)) out.push(`${label} is outside the frame or empty`);
  };
  const w = L.why;
  box("why: core line", { top: w.coreTop, bottom: w.coreBottom, left: w.coreLeft, right: w.coreRight });
  box("why: meters", { top: w.metersTop, bottom: w.coreTop - WHY.ruleGap, left: MARGIN, right: w.coreRight });
  for (const [i, b] of w.labels.entries()) box(`why: cup name ${i}`, b);
  if (w.top < w.headTop) out.push(`why: the drawing (from y ${Math.round(w.top)}) runs into the heading`);
  if (w.scale < 0.45) out.push(`why: the drawing would shrink to ${w.scale.toFixed(2)}`);
  const v = L.visual;
  box("diagram: caption", { top: v.captionTop, bottom: v.captionBottom, left: MARGIN, right: v.captionTop > LOW_Y ? MARGIN + LOW_COLUMN : MARGIN + COLUMN });
  box("diagram: reason (lesson.why)", { top: v.noteTop, bottom: v.noteBottom, left: v.noteLeft, right: v.noteLeft + v.noteWidth });
  for (const [i, r] of L.effect.entries()) {
    const left = 60 + EFFECT.cup + 40;
    box(`both ways: row ${i}`, { top: r.top, bottom: r.bottom, left, right: left + r.width });
  }
  L.tips.forEach((r, i) => {
    box(`tips: ${i}`, { top: r.top, bottom: r.bottom, left: MARGIN, right: MARGIN + r.width + TIPS.gap + r.doodle });
    if (i > 0 && r.top < L.tips[i - 1].bottom + 10) out.push(`tips: ${i} overlaps the tip above`);
  });
  box("ending: next", { top: L.end.nextTop, bottom: L.end.nextBottom, left: MARGIN, right: L.end.lowRight });
  box("ending: signature", { top: L.end.signatureTop, bottom: L.end.bottom, left: MARGIN, right: L.end.lowRight });
  return out;
}
