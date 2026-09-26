/**
 * Per-episode art for the looks: which picture (a Codex plate per subject,
 * public/looks/<look>-<subject>.png) and which colours. Two episodes in a row
 * never share a subject, so neighbouring tiles of the profile grid differ;
 * the colour follows the pillar (docs/typography-scale.md §6), term episodes
 * take one of their own.
 */

export type Subject =
  | "pour"
  | "scale"
  | "ratio"
  | "grinder"
  | "dial"
  | "kettle"
  | "drawdown"
  | "bloom"
  | "mug"
  | "press"
  | "cup-light"
  | "cup"
  | "beans-dark"
  | "dripper-top"
  | "timer"
  | "flat-dripper"
  | "clever"
  | "metal-filter"
  | "water"
  | "iced"
  | "bed"
  | "two-cups"
  | "bypass"
  | "sieve"
  | "pour-high"
  | "beans-light"
  | "notebook";

/** What each plate shows — the Codex prompt for scripts/generate-plates (docs/looks.md). */
export const SUBJECTS: Record<Subject, string> = {
  pour: "a gooseneck kettle pouring a thin stream into a paper-filter dripper on a glass server",
  scale: "a pour-over dripper on a small digital kitchen scale (blank display, no digits)",
  ratio: "a small scoop of ground coffee next to a gooseneck kettle, side by side",
  grinder: "a hand coffee grinder with a small mound of fine grounds and two beans",
  dial: "close-up of the adjustment ring of a hand coffee grinder, fine grounds around it",
  kettle: "a gooseneck kettle with soft steam rising from the spout",
  drawdown: "the last drops falling from a dripper into a glass server",
  bloom: "coffee grounds puffing up and bubbling in a paper-filter dripper after the first splash of water",
  mug: "a mug with coffee grounds steeping in hot water and a spoon beside it",
  press: "a French press with the plunger up, coffee steeping inside",
  "cup-light": "a cup of light, thin, amber-coloured coffee",
  cup: "a cup of black coffee",
  "beans-dark": "a small pile of dark, oily roasted coffee beans next to a kettle",
  "dripper-top": "top-down view of water poured into the centre of the coffee bed in a dripper",
  timer: "a small sand timer next to a dripper with a blooming coffee bed",
  "flat-dripper": "a flat-bottom wave dripper on a glass server",
  clever: "an immersion dripper with a valve sitting on a mug",
  "metal-filter": "a fine stainless-steel mesh coffee filter",
  water: "a clear glass of water next to a gooseneck kettle",
  iced: "a glass of iced coffee with large clear ice cubes",
  bed: "the flat, spent coffee bed left in a paper filter after brewing",
  "two-cups": "two cups of coffee side by side, one lighter and one darker",
  bypass: "hot water being poured from a kettle into a cup of coffee",
  sieve: "a small tea strainer sifting fine coffee grounds",
  "pour-high": "a kettle pouring from high above a dripper, a long thin stream",
  "beans-light": "a small pile of light-brown, lightly roasted coffee beans next to a kettle",
  notebook: "an open notebook with a pencil beside a cup of coffee (the notebook pages blank)",
};

export const EPISODE_SUBJECT: Record<string, Subject> = {
  "b01-extraction": "pour",
  "b02-measure": "scale",
  "b03-ratio": "ratio",
  "b04-grind": "grinder",
  "b05-grinder-dial": "dial",
  "b06-temp": "kettle",
  "b07-stop-early": "drawdown",
  "b08-bloom": "bloom",
  "b09-pour-slow": "pour",
  "b10-mug": "mug",
  "b11-percolation-immersion": "press",
  "b12-sour": "kettle",
  "b13-bitter": "grinder",
  "i01-underextraction": "cup-light",
  "i02-overextraction": "cup",
  "i03-dark-roast-temp": "beans-dark",
  "i04-more-pours": "pour",
  "i05-pour-center": "dripper-top",
  "i06-bloom-water": "bloom",
  "i07-bloom-time": "timer",
  "i08-cone-flat": "flat-dripper",
  "i09-press-time": "press",
  "i10-clever": "clever",
  "i11-metal-filter": "metal-filter",
  "i12-soft-water": "water",
  "i13-iced-ratio": "iced",
  "i14-swirl": "dripper-top",
  "a01-tds": "cup",
  "a02-extraction-yield": "bed",
  "a03-brew-chart": "two-cups",
  "a04-bypass": "bypass",
  "a05-fines": "sieve",
  "a06-drawdown": "drawdown",
  "a07-pour-height": "pour-high",
  "a08-light-roast-hot": "beans-light",
  "a09-one-change": "notebook",
};

export interface Tone {
  accent: string; // lab: the one accent colour (taste line, rules)
  field: string; // still: the colour field
  deep: string; // still: text, a deeper shade of the same hue
}

const PILLAR_TONES: Record<string, Tone> = {
  temp: { accent: "#B5563A", field: "#D9B8A3", deep: "#5A3A2C" },
  grind: { accent: "#7A6A58", field: "#CFC6B3", deep: "#4A4336" },
  ratio: { accent: "#4F6D7A", field: "#B9C4C9", deep: "#34454D" },
  time: { accent: "#8A7F3F", field: "#D6CFA8", deep: "#4E4A2A" },
  pour: { accent: "#3F6B5A", field: "#B8C6B6", deep: "#33483A" },
  gear: { accent: "#5B5570", field: "#C4BED0", deep: "#3F3A52" },
  trouble: { accent: "#A0584F", field: "#DDB9B2", deep: "#5C3530" },
  nogear: { accent: "#6F7B4A", field: "#C9CDB0", deep: "#434A2A" },
  water: { accent: "#3E6F80", field: "#B6CCD2", deep: "#2F4A52" },
};

// Term episodes, in curriculum order, each its own colour (cycled; neighbours differ).
const TERM_EPISODES = ["b01-extraction", "b03-ratio", "b08-bloom", "b11-percolation-immersion", "i01-underextraction", "i02-overextraction", "a01-tds", "a02-extraction-yield", "a03-brew-chart", "a05-fines"];
const TERM_TONES: Tone[] = [
  { accent: "#8A6A4A", field: "#D4C3B0", deep: "#4F3E2E" },
  { accent: "#5E7048", field: "#CBD3BD", deep: "#3E4A30" },
  { accent: "#A07A3A", field: "#E0C9A6", deep: "#5A4424" },
  { accent: "#4F6D7A", field: "#B9C4C9", deep: "#34454D" },
  { accent: "#6A5A8A", field: "#C8C0D6", deep: "#403856" },
];

export function toneFor(episode: string, pillar: string): Tone {
  if (pillar === "terms") return TERM_TONES[Math.max(0, TERM_EPISODES.indexOf(episode)) % TERM_TONES.length];
  return PILLAR_TONES[pillar] ?? PILLAR_TONES.temp;
}

export function subjectFor(episode: string): Subject {
  return EPISODE_SUBJECT[episode] ?? "cup";
}

/** "下げる" → "下げると"; a label that already ends in と is left alone (no "とと"). */
export const withTo = (label: string) => (label.endsWith("と") ? label : `${label}と`);
