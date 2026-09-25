// Mirrors the slide objects built by scripts/content-format.mjs
// (buildLessonSlides) and the frame timeline from computeCardTimeline — the
// pipeline passes them as Remotion input props.
//
// There is no product here on purpose: the channel is in its audience-growth
// phase and never names a coffee of its own (owner decision 2026-09-22).

export interface NumberTile {
  label: string;
  value: string;
  unit: string;
}

export interface LessonTitleSlide {
  kind: "lesson-title";
  heading: string; // the pillar, e.g. 湯温 — or 用語「TDS」 on a term episode
  series: string; // e.g. 初級 第4回 (the episode's place in data/curriculum.json)
  date: string;
  hook: string; // the question of the day
  topic: string; // the answer in one line
  why: string; // why it happens
  methodLabel: string;
  sceneLabel: string;
  tiles: NumberTile[];
  narration: string;
}

export interface LessonStepsSlide {
  kind: "lesson-steps";
  heading: string;
  steps: { time: string; action: string; amount: string }[];
  narration: string;
}

export interface LessonTasteSlide {
  kind: "lesson-taste";
  heading: string;
  notes: string[];
  summary: string;
  meters: { label: string; value: number }[];
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
      unit: string;
      format?: "ratio";
      min: number;
      max: number;
      from?: number;
      to: number;
      zones: { upTo: number; label: string }[];
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
  | LessonStepsSlide
  | LessonTasteSlide
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
}
