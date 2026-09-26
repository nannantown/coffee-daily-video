// Mirrors the slide objects built by scripts/content-format.mjs
// (buildLessonSlides) and the frame timeline from computeCardTimeline — the
// pipeline passes them as Remotion input props.
//
// There is no product here on purpose: the channel is in its audience-growth
// phase and never names a coffee of its own (owner decision 2026-09-22).
// There are no recipe numbers either (owner decision 2026-09-26): one change,
// why it works, and how the taste moves either way.

export interface LessonTitleSlide {
  kind: "lesson-title";
  heading: string; // the pillar, e.g. 湯温 — or 用語「TDS」 on a term episode
  episode: string; // curriculum id (picks the cover picture / colour)
  pillar: string;
  series: string; // e.g. 初級 第4回 (the episode's place in data/curriculum.json)
  date: string;
  word: string; // the big word on the cover: 湯温
  ask: string; // what follows it: を下げると？
  topic: string; // what it does to the taste, one line
  methodLabel: string;
  sceneLabel: string;
  narration: string;
}

export interface LessonWhySlide {
  kind: "lesson-why";
  heading: string;
  hook: string; // the one change: お湯の温度を下げる
  why: string; // why the cup changes
  narration: string;
}

export interface LessonEffectSlide {
  kind: "lesson-effect";
  heading: string;
  sides: { label: string; taste: string }[]; // [today's move, the other way]
  narration: string;
}

export interface LessonTipsSlide {
  kind: "lesson-tips";
  heading: string;
  tips: { problem: string; fix: string }[];
  narration: string;
}

// The diagram slide (src/cards/Diagrams.tsx). Shapes mirror validateVisual in
// scripts/content-format.mjs, which caps every string to the space it gets.
export interface CompareSide {
  label: string;
  result: string;
  strength: number; // 1-5, how dark the cup is
}

export interface FlowBrewer {
  shape: "cone" | "flat" | "immersion";
  label: string;
  note: string;
  speed?: "fast" | "slow";
  pour?: "center" | "wide";
  height?: "high" | "low";
  bed?: "even" | "uneven";
}

export type LessonVisual =
  | { type: "compare"; caption: string; left: CompareSide; right: CompareSide; pick?: "left" | "right" }
  | {
      type: "graph";
      caption: string;
      xLabel: string;
      yLabel: string;
      points: { label: string; value: number }[];
      mark?: number;
      zones?: string[];
    }
  | { type: "flow"; caption: string; brewers: FlowBrewer[] }
  | {
      type: "scale";
      caption: string;
      label: string;
      from?: number; // 0-100 along the gauge (no numbers are shown)
      to: number; // 0-100
      zones: string[]; // 2-3 names, left to right, equal width
    };

export interface LessonVisualSlide {
  kind: "lesson-visual";
  heading: string;
  visual: LessonVisual;
  narration: string;
}

export type CardSlide =
  | LessonTitleSlide
  | LessonVisualSlide
  | LessonWhySlide
  | LessonEffectSlide
  | LessonTipsSlide;

export interface CtaEnding {
  kind: "lesson-cta";
  heading: string;
  topic: string;
  lead: string;
  lines: string[];
  next?: string; // tomorrow's one change (or 用語「…」) — the series teaser
  narration: string;
}

export interface CardTimeline {
  slides: number[];
  ending: number;
  total: number;
}

export interface CoffeeCardsProps {
  format: "brew-lesson";
  slides: CardSlide[];
  ending: CtaEnding;
  timeline: CardTimeline;
  withAudio?: boolean;
  look?: "lab" | "photo" | "still"; // preview a candidate look (src/looks/); unset = PRODUCTION_LOOK
}
