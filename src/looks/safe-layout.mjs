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
export function whyLayout({ heading, core, meters, box, maxScale, labels = null, labelX = [] }) {
  const n = Math.max(1, meters);
  const gap = WHY.meterGap(n);
  // the core line sits below y LOW_Y: it keeps the action-column clearance
  const coreH = textHeight(core, WHY.coreSize, LOW_COLUMN);
  const coreTop = CONTENT_BOTTOM - coreH;
  const metersBottom = coreTop - WHY.ruleGap;
  const metersTop = metersBottom - ((n - 1) * gap + WHY.meterRow);
  const top = headingBottom(heading) + 20;
  // cups: each cup's name under it, in a box that ends left of the action column (x ≤ 1080 - MARGIN - 80)
  const labelBoxes = (labels ?? []).map((text, i, all) => {
    const half = 540 - MARGIN; // 444: each name gets half the column
    const left = i === 0 ? MARGIN : 540 + 20;
    const right = i === 0 ? 540 - 20 : Math.min(1080 - MARGIN - 80, left + half);
    return { text, left, right, width: right - left, height: textHeight(text, WHY.cupLabelSize, right - left) };
  });
  const labelH = labelBoxes.length ? Math.max(...labelBoxes.map((b) => b.height)) + 10 : 0;
  const avail = metersTop - WHY.vesselGap - labelH - top;
  const scale = Math.max(0.3, Math.min(maxScale, avail / (box.bottom - box.top)));
  const drawnBottom = top + (box.bottom - box.top) * scale;
  const labelTop = drawnBottom + 10;
  // centre each name under its cup when that still fits its box
  for (const [i, b] of labelBoxes.entries()) {
    b.top = labelTop;
    b.bottom = labelTop + b.height;
    b.cupX = 540 + ((labelX[i] ?? 540) - 540) * scale;
  }
  return { gap, coreTop, coreBottom: coreTop + coreH, coreLeft: MARGIN, coreRight: MARGIN + LOW_COLUMN, metersTop, top, scale, drawnBottom, labelTop, labels: labelBoxes };
}

// ---------------------------------------------------------------------------
// diagram scene (src/looks/LabConte.tsx LabVisualConte)
// ---------------------------------------------------------------------------

/** Drawn height of each diagram kind at the lab look's sizes (flow drawn 480 high): measured on all 36 episodes (graph 716, compare 695, flow 680) plus room for a routine's longest labels. */
export const DIAGRAM_HEIGHT = { compare: 710, graph: 720, flow: 700, scale: 0 };
export const DIAGRAM_TOP = 650;
export const SCALE_CAPTION_TOP = 1290; // under the hand-drawn gauge (baseline 1130 + needle hub)
export const SCALE_NOTE_TOP = 1506; // right of the episode drawing (x 40, y 1440, 440 square)
export const SCALE_NOTE_LEFT = 520;
export const captionSize = (type) => (type === "scale" ? 64 : 56); // under a tall diagram the caption steps down a size
export const NOTE_SIZE = 44;

/** Caption (and the reason, if it still fits) under the diagram; null = the reason is dropped. */
export function visualLayout({ type, caption, why }) {
  const scale = type === "scale";
  // the gauge's caption sits where the approved storyboard put it (1290); other diagrams: right under the drawing
  const captionTop = scale ? SCALE_CAPTION_TOP : DIAGRAM_TOP + DIAGRAM_HEIGHT[type] + 16;
  const size = captionSize(type);
  const captionBottom = captionTop + textHeight(caption, size, captionTop > LOW_Y ? LOW_COLUMN : COLUMN);
  // gauge: the reason goes right of the episode's drawing (as in the storyboard); others: under the caption
  const noteLeft = scale ? SCALE_NOTE_LEFT : MARGIN;
  const noteWidth = 1080 - MARGIN - 80 - noteLeft;
  const noteTop = scale ? Math.max(SCALE_NOTE_TOP, captionBottom + 50) : captionBottom + 50;
  const noteBottom = noteTop + textHeight(why, NOTE_SIZE, noteWidth);
  const showNote = noteBottom <= CONTENT_BOTTOM;
  return { captionTop, captionSize: size, captionBottom, noteLeft, noteWidth, noteTop, noteBottom, showNote, doodle: scale };
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
