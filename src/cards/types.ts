// Mirrors the slide objects built by scripts/content-format.mjs
// (buildRecipeSlides / buildNewsTop5Slides) and the frame timeline from
// computeCardTimeline — the pipeline passes them as Remotion input props.

export interface NumberTile {
  label: string;
  value: string;
  unit: string;
}

export interface RecipeTitleSlide {
  kind: "recipe-title";
  heading: string;
  date: string;
  beanName: string;
  beanFullName?: string;
  beanMeta: string;
  methodLabel: string;
  sceneLabel: string;
  hook: string;
  tiles: NumberTile[];
  narration: string;
}

export interface RecipeStepsSlide {
  kind: "recipe-steps";
  heading: string;
  steps: { time: string; action: string; amount: string }[];
  narration: string;
}

export interface RecipeTasteSlide {
  kind: "recipe-taste";
  heading: string;
  notes: string[];
  summary: string;
  meters: { label: string; value: number }[];
  narration: string;
}

export interface RecipeTipsSlide {
  kind: "recipe-tips";
  heading: string;
  tips: { problem: string; fix: string }[];
  narration: string;
}

export interface NewsCoverSlide {
  kind: "news-cover";
  heading: string;
  date: string;
  weekLabel: string;
  headlines: string[];
  narration: string;
}

export interface NewsItemSlide {
  kind: "news-item";
  heading: string;
  rank: number;
  headline: string;
  number: string;
  numberLabel: string;
  summary: string;
  source: string;
  narration: string;
}

export type CardSlide =
  | RecipeTitleSlide
  | RecipeStepsSlide
  | RecipeTasteSlide
  | RecipeTipsSlide
  | NewsCoverSlide
  | NewsItemSlide;

export interface CtaEnding {
  kind: "recipe-cta" | "news-cta";
  heading: string;
  beanName: string;
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
  format: "recipe" | "news-top5";
  slides: CardSlide[];
  ending: CtaEnding;
  timeline: CardTimeline;
  withAudio?: boolean;
}
