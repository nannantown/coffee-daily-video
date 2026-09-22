import type React from "react";

// Same font stack as the legacy news slides (CI installs fonts-noto-cjk +
// fonts-noto-cjk-extra in daily-video.yml).
export const FONT_FAMILY =
  "'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', sans-serif";

// Text stays in the white family; accent colors are only used for borders,
// bars and dots — lines never share a color with the text next to them.
export const COLORS = {
  bg: "#1a0e08",
  surface: "#27180f", // solid card
  pill: "#3b2517", // solid pill fill (labels never sit on lines)
  text: "#ffffff",
  textSub: "rgba(255,255,255,0.82)",
  textMuted: "rgba(255,255,255,0.64)",
  hairline: "rgba(255,255,255,0.16)",
  caramel: "#D4A574",
  sage: "#8CB4A0",
  terracotta: "#C97B4B",
  sky: "#7B9DB8",
};

export const ACCENTS = [COLORS.caramel, COLORS.sage, COLORS.terracotta, COLORS.sky];

/**
 * How a card separates from the background now that it has no outline.
 *
 * `surface` is only 1.05:1 against the background once the key light lifts
 * it, so the fill alone cannot hold the edge — but putting the hairline back
 * reinstates the outlined-box look that read as templated in the first place.
 * A cast shadow does the same job the way a physical object would, and it
 * tracks the light instead of fighting it.
 */
export const CARD_SHADOW = "0 12px 28px rgba(0,0,0,0.45)";

// 1080x1920 spacing: outer margin 80, card padding 40, section 80/100.
// Content lives between y=180 and y=1560: IG Reels / YT Shorts overlay the
// top bar and the bottom ~360px (caption, channel, audio). Rows that reach
// y>1000 keep 80px extra right padding so the action-button column
// (x≈930-1060) never covers text.
export const SPACE = {
  margin: 80,
  cardPad: 40,
  gutter: 40,
  sectionS: 80,
  sectionL: 100,
  top: 180,
  contentTop: 340,
  contentBottom: 1560,
  actionColumnClearance: 80,
};

// Typography scale (px on the 1080x1920 canvas). Body copy never below 40px
// (≈30pt); auxiliary lines (tile labels, date / page, source, brand footer)
// never below 30px.
export const TYPE = {
  hero: 96, // recipe numbers / news key number
  rank: 160,
  title: 80,
  emphasis: 48,
  heading: 40,
  pill: 40,
  body: 40,
  bodyMin: 40,
  aux: 32,
  footer: 30,
};

// Japanese phrase-aware line breaking (Chromium, needs lang="ja" ancestor).
export const PHRASE_BREAK = {
  wordBreak: "auto-phrase" as unknown as React.CSSProperties["wordBreak"],
};
