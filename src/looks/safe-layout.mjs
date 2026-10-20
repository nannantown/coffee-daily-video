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
// classic cards' premise slide (src/cards/Diagrams.tsx LessonVisualView): the
// fallback renderer when a plate is missing or the look fails (pipeline.mjs).
// Diagram, caption and the `term：say` note are centred in the content column
// (SlideShell: contentTop..contentBottom, inset by the drift budget), so the
// whole stack must fit that column or it runs past both ends.
// ---------------------------------------------------------------------------

// copied from src/cards/theme.ts (SPACE.contentTop 340, DRIFT_MAX 8, margin 80 + clearance 80); scripts/looks-layout.test.mjs keeps them in sync
export const CLASSIC = { column: CONTENT_BOTTOM - 340 - 2 * 8, width: 824, captionGap: 64, captionSize: 52, captionWidth: 824 - 40, noteGap: 32, noteSize: 40 };
/** Classic diagram heights: measured 2026-10-19 on the tallest content each type allows (flow 807, graph 724, scale 696, compare 652; compare + 42 for a 3-line result) + margin. */
export const CLASSIC_DIAGRAM_HEIGHT = { flow: 817, graph: 734, scale: 706, compare: 704 };
/** The line under the premise diagram in the classic cards (CoffeeCardsVideo.tsx renders this exact string). */
export const classicPremiseNote = (p) => `${p.term}：${p.say}`;
/**
 * Height of the classic premise stack, with the line heights the classic cards set (caption 1.35, note 1.4).
 * Conservative like lineCount: the longest note (14 + 1 + 24 chars) renders in 2 lines, but phrase breaking
 * may push it to a 3rd, which under the tallest flow overflows (measured 1155 + 56 > 1204) — validation then
 * asks to shorten the premise.
 */
export function classicPremiseHeight({ type, caption, note }) {
  const caps = lineCount(caption, CLASSIC.captionSize, CLASSIC.captionWidth, 0) * Math.ceil(CLASSIC.captionSize * 1.35);
  const notes = lineCount(note, CLASSIC.noteSize, CLASSIC.width, 0) * Math.ceil(CLASSIC.noteSize * 1.4);
  return CLASSIC_DIAGRAM_HEIGHT[type] + CLASSIC.captionGap + caps + CLASSIC.noteGap + notes;
}

// ---------------------------------------------------------------------------
// script scenes (lesson.script, owner 2026-10-20: an episode told scene by scene
// as its approved script says — LabConte.tsx LabSceneConte): grey label, the big
// heading, the lines / "lead → result" rows, and the scene's drawing (SceneArt.tsx)
// under the text, as big as the space left allows.
// ---------------------------------------------------------------------------

/**
 * The drawings a script scene can carry (src/looks/SceneArt.tsx): their design size
 * (viewBox) and every word drawn inside them (centre cx / cy and font size, in viewBox
 * units). SceneArt.tsx draws those words from here, and layoutProblems maps them onto
 * the screen with the drawing's box, so a word in a picture obeys the same rules as
 * any text: above the Reels UI, left of the action buttons, 40px (30pt) or larger.
 * The cover's big pale 水 is a picture (a watermark behind the glasses), not a word to read.
 */
export const SCENE_ART = {
  glasses: { w: 1000, h: 820, texts: [] }, // the cover: two identical glasses before a big 水
  minerals: {
    w: 1000,
    h: 560, // few vs many mineral grains (some marked Ca / Mg), each glass named under it
    texts: [
      { key: "soft-ca", label: "Ca", cx: 225, cy: 220, size: 52 },
      { key: "hard-ca1", label: "Ca", cx: 660, cy: 160, size: 52 },
      { key: "hard-mg", label: "Mg", cx: 805, cy: 215, size: 52 },
      { key: "hard-ca2", label: "Ca", cx: 700, cy: 300, size: 52 },
      { key: "soft-name", label: "軟水", cx: 265, cy: 500, size: 56 },
      { key: "hard-name", label: "硬水", cx: 735, cy: 500, size: 56 },
    ],
  },
  acid: {
    w: 1000,
    h: 640, // acid grains cancelled in hard water, a baking-soda pouch
    texts: [
      { key: "acid", label: "酸味", cx: 132, cy: 34, size: 44 },
      { key: "base", label: "酸を打ち消す成分", cx: 484, cy: 34, size: 44 },
      { key: "soda", label: "重曹", cx: 802, cy: 364, size: 56 },
    ],
  },
  compare: {
    w: 1000,
    h: 660, // left 硬水: grains → dark cup, 酸味 low / 苦み high; right 軟水: light cup, 酸味 stays / 苦み low
    texts: [
      { key: "hard-name", label: "硬水", cx: 250, cy: 44, size: 60 },
      { key: "soft-name", label: "軟水", cx: 760, cy: 44, size: 60 },
      { key: "hard-acid", label: "酸味", cx: 50, cy: 390, size: 48 },
      { key: "hard-bitter", label: "苦み", cx: 168, cy: 390, size: 48 },
      { key: "soft-acid", label: "酸味", cx: 560, cy: 390, size: 48 },
      { key: "soft-bitter", label: "苦み", cx: 678, cy: 390, size: 48 },
    ],
  },
  which: {
    w: 1000,
    h: 540, // the tap's glass, two cups, an imported bottle's 硬度 label
    texts: [{ key: "hardness", label: "硬度", cx: 865, cy: 295, size: 56 }],
  },
};
/** One drawn word of SCENE_ART, found by key. */
export const artText = (name, key) => SCENE_ART[name].texts.find((t) => t.key === key);
/** A drawn word's box in viewBox units (CJK one em, ASCII 0.6 em; ± 6 for the grains' bob). */
export function artTextBox(t) {
  const w = [...t.label].reduce((n, c) => n + (c.charCodeAt(0) < 0x2e80 ? 0.6 : 1), 0) * t.size;
  return { left: t.cx - w / 2, right: t.cx + w / 2, top: t.cy - t.size * 0.65 - 6, bottom: t.cy + t.size * 0.65 + 6 };
}
// The drawing sits centred between the text and y artBottom (its table line may reach under
// the Reels caption), as big as the text above leaves room for.
export const SCENE = { labelSize: 44, labelGap: 30, bodyGap: 44, itemGap: 28, resultGap: 4, sizes: [56, 48], artGap: 40, artBottom: 1720, artMaxWidth: 1000, artMinHeight: 380, artTextMin: 40 };

/**
 * Every text box of a script scene, top down, and the drawing's box under them.
 * The boxes are upper bounds (lineCount rounds up), so validation never lets text
 * run under the UI; the renderer flows the text from the top and centres the
 * drawing in the room the upper bound leaves, so a line that wraps less only leaves more air.
 */
export function sceneLayout(scene) {
  const fit = (size) => {
    // the line above the heading: a grey label (まず前提), or an intro sentence set like the body
    const above = scene.label ? { text: scene.label, size: SCENE.labelSize } : scene.intro ? { text: scene.intro, size } : null;
    const aboveH = above ? textHeight(above.text, above.size, COLUMN) : 0;
    const headTop = Math.max(HEADING.top, above ? HEADING.labelTop + aboveH + SCENE.labelGap : HEADING.top);
    let y = headTop + textHeight(scene.heading, HEADING.size, COLUMN, 0.01) + 14 + SCENE.bodyGap;
    const items = (scene.body ?? []).map((item) => {
      const top = y;
      const h =
        typeof item === "string"
          ? textHeight(item, size, LOW_COLUMN)
          : textHeight(`${item.lead} →`, size, LOW_COLUMN) + SCENE.resultGap + textHeight(item.result, size, LOW_COLUMN);
      y = top + h + SCENE.itemGap;
      return { top, bottom: top + h, left: MARGIN, right: MARGIN + LOW_COLUMN };
    });
    const textBottom = items.length ? items[items.length - 1].bottom : y;
    const a = SCENE_ART[scene.art] ?? { w: 1000, h: 700, texts: [] };
    const artTop = textBottom + SCENE.artGap;
    // the drawing may reach artBottom, but the words inside it must stay above CONTENT_BOTTOM
    const wordsBottom = Math.max(0, ...(a.texts ?? []).map((t) => artTextBox(t).bottom));
    const scale = Math.min(SCENE.artMaxWidth / a.w, (SCENE.artBottom - artTop) / a.h, wordsBottom ? (CONTENT_BOTTOM - artTop) / wordsBottom : Infinity);
    const width = a.w * scale;
    const height = a.h * scale;
    // centred in the room between the text and artBottom, as far as its words allow
    const slack = Math.max(0, Math.min((SCENE.artBottom - artTop - height) / 2, CONTENT_BOTTOM - artTop - wordsBottom * scale));
    return {
      size,
      label: above ? { top: HEADING.labelTop, bottom: HEADING.labelTop + aboveH, left: MARGIN, right: MARGIN + COLUMN } : null,
      heading: { top: headTop, bottom: headTop + textHeight(scene.heading, HEADING.size, COLUMN, 0.01), left: MARGIN, right: MARGIN + COLUMN },
      items,
      textBottom,
      art: { top: artTop + slack, left: (1080 - width) / 2, width, height },
    };
  };
  // the larger body size when the drawing still gets its room and its words stay 40px+, else the smaller one (never below 30pt)
  const art = SCENE_ART[scene.art];
  const ok = (L) => L.art.height >= SCENE.artMinHeight && L.textBottom <= CONTENT_BOTTOM && (art?.texts ?? []).every((t) => (t.size * L.art.width) / art.w >= SCENE.artTextMin);
  const big = fit(SCENE.sizes[0]);
  return ok(big) ? big : fit(SCENE.sizes[1]);
}

/** Classic cards (the fallback renderer): label, heading and the lines, centred in the content column; no drawing. */
export const CLASSIC_SCENE = { labelSize: 40, headSize: 64, bodySize: 44, gap: 32 };
export function classicSceneHeight(scene) {
  const w = CLASSIC.width;
  const lh = (s, size) => lineCount(s, size, w, 0) * Math.ceil(size * 1.4);
  const above = scene.label || scene.intro;
  let h = (above ? lh(above, scene.label ? CLASSIC_SCENE.labelSize : CLASSIC_SCENE.bodySize) + CLASSIC_SCENE.gap : 0) + lh(scene.heading, CLASSIC_SCENE.headSize);
  for (const item of scene.body ?? []) {
    h += CLASSIC_SCENE.gap + (typeof item === "string" ? lh(item, CLASSIC_SCENE.bodySize) : lh(`${item.lead} →`, CLASSIC_SCENE.bodySize) + lh(item.result, CLASSIC_SCENE.bodySize));
  }
  return h;
}

// ---------------------------------------------------------------------------
// every scene of one episode, checked
// ---------------------------------------------------------------------------

export const RIGHT_LIMIT = 1080 - MARGIN - 80; // 904: text below LOW_Y ends here (action buttons)
const withTo = (l) => (String(l).endsWith("と") ? l : `${l}と`);

/**
 * The lab look's text boxes for one built episode (content-format.mjs buildCardsData).
 * A scene the episode does not have is null (a script episode has no why / diagram /
 * both-ways / tips scenes, only its own `scenes`).
 */
export function labLayout(data, vessels) {
  const s = Object.fromEntries(data.slides.map((x) => [x.kind, x]));
  const why = s["lesson-why"];
  let whyBox = null;
  if (why) {
    const kind = why.motion.type === "compare" ? "cups" : why.motion.type === "dissolve" ? "dripper" : "server";
    const v = vessels[kind];
    const labels = kind === "cups" ? [withTo(why.sides[1].label), withTo(why.sides[0].label)] : null;
    whyBox = whyLayout({ heading: `${why.hook}と`, core: why.core, meters: why.motion.meters.length, box: v.box, maxScale: v.maxScale, labels });
  }
  return {
    why: whyBox,
    visual: s["lesson-visual"] ? visualLayout({ type: s["lesson-visual"].visual.type, caption: s["lesson-visual"].visual.caption, why: why?.why ?? "" }) : null,
    // the premise slide is the diagram scene with its own heading and line (LabVisualConte)
    premise: s["lesson-premise"] ? visualLayout({ type: s["lesson-premise"].visual.type, caption: s["lesson-premise"].visual.caption, why: s["lesson-premise"].say }) : null,
    effect: s["lesson-effect"] ? effectLayout(s["lesson-effect"].sides) : [],
    tips: s["lesson-tips"] ? tipsLayout(s["lesson-tips"].tips) : [],
    scenes: data.slides.filter((x) => x.kind === "lesson-scene").map(sceneLayout),
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
  if (w) {
    box("why: core line", { top: w.coreTop, bottom: w.coreBottom, left: w.coreLeft, right: w.coreRight });
    box("why: meters", { top: w.metersTop, bottom: w.coreTop - WHY.ruleGap, left: MARGIN, right: w.coreRight });
    for (const [i, b] of w.labels.entries()) box(`why: cup name ${i}`, b);
    if (w.top < w.headTop) out.push(`why: the drawing (from y ${Math.round(w.top)}) runs into the heading`);
    if (w.scale < 0.45) out.push(`why: the drawing would shrink to ${w.scale.toFixed(2)}`);
  }
  const v = L.visual;
  if (v) {
    box("diagram: caption", { top: v.captionTop, bottom: v.captionBottom, left: MARGIN, right: v.captionTop > LOW_Y ? MARGIN + LOW_COLUMN : MARGIN + COLUMN });
    box("diagram: reason (lesson.why)", { top: v.noteTop, bottom: v.noteBottom, left: v.noteLeft, right: v.noteLeft + v.noteWidth });
  }
  const p = L.premise;
  if (p) {
    box("premise: caption", { top: p.captionTop, bottom: p.captionBottom, left: MARGIN, right: p.captionTop > LOW_Y ? MARGIN + LOW_COLUMN : MARGIN + COLUMN });
    box("premise: line (lesson.premise.say)", { top: p.noteTop, bottom: p.noteBottom, left: p.noteLeft, right: p.noteLeft + p.noteWidth });
    const ps = data.slides.find((x) => x.kind === "lesson-premise");
    const h = classicPremiseHeight({ type: ps.visual.type, caption: ps.visual.caption, note: classicPremiseNote(ps) });
    if (h > CLASSIC.column) out.push(`classic cards: premise slide (diagram + caption + "term：say") is ${h}px tall (max ${CLASSIC.column})`);
  }
  for (const [i, r] of L.effect.entries()) {
    const left = 60 + EFFECT.cup + 40;
    box(`both ways: row ${i}`, { top: r.top, bottom: r.bottom, left, right: left + r.width });
  }
  L.tips.forEach((r, i) => {
    box(`tips: ${i}`, { top: r.top, bottom: r.bottom, left: MARGIN, right: MARGIN + r.width + TIPS.gap + r.doodle });
    if (i > 0 && r.top < L.tips[i - 1].bottom + 10) out.push(`tips: ${i} overlaps the tip above`);
  });
  const scenes = data.slides.filter((x) => x.kind === "lesson-scene");
  L.scenes.forEach((sc, i) => {
    if (sc.label) box(`scene ${i + 1}: label`, sc.label);
    box(`scene ${i + 1}: heading`, sc.heading);
    sc.items.forEach((b, j) => box(`scene ${i + 1}: line ${j + 1}`, b));
    if (sc.art.height < SCENE.artMinHeight) out.push(`scene ${i + 1}: the drawing would shrink to ${Math.round(sc.art.height)}px tall (min ${SCENE.artMinHeight})`);
    // the words inside the drawing, where the drawing puts them on screen
    const art = SCENE_ART[scenes[i].art];
    const s = sc.art.width / (art?.w ?? 1);
    for (const t of art?.texts ?? []) {
      const b = artTextBox(t);
      box(`scene ${i + 1}: 「${t.label}」 in the drawing`, { top: sc.art.top + b.top * s, bottom: sc.art.top + b.bottom * s, left: sc.art.left + b.left * s, right: sc.art.left + b.right * s });
      if (t.size * s < SCENE.artTextMin) out.push(`scene ${i + 1}: 「${t.label}」 in the drawing is ${Math.round(t.size * s)}px (min ${SCENE.artTextMin})`);
    }
    const h = classicSceneHeight(scenes[i]);
    if (h > CLASSIC.column) out.push(`classic cards: scene ${i + 1} is ${h}px tall (max ${CLASSIC.column})`);
  });
  box("ending: next", { top: L.end.nextTop, bottom: L.end.nextBottom, left: MARGIN, right: L.end.lowRight });
  box("ending: signature", { top: L.end.signatureTop, bottom: L.end.bottom, left: MARGIN, right: L.end.lowRight });
  return out;
}
