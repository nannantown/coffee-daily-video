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
  heading: string; // the pillar, e.g. 湯温
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

export type CardSlide =
  | LessonTitleSlide
  | LessonStepsSlide
  | LessonTasteSlide
  | LessonTipsSlide;

export interface CtaEnding {
  kind: "lesson-cta";
  heading: string;
  topic: string;
  lead: string;
  lines: string[];
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
