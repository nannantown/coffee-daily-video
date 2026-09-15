import React from "react";
import { AbsoluteFill } from "remotion";
import { AccentLine, Brand, Pill, Reveal, SlideShell } from "./primitives";
import { ACCENTS, COLORS, FONT_FAMILY, PHRASE_BREAK, SPACE, TYPE } from "./theme";
import type {
  CtaEnding,
  NumberTile,
  RecipeStepsSlide,
  RecipeTasteSlide,
  RecipeTipsSlide,
  RecipeTitleSlide,
} from "./types";

const TILE_COLUMNS = 3;
const TILE_GAP = 32;
const TILE_WIDTH = (1080 - SPACE.margin * 2 - TILE_GAP * (TILE_COLUMNS - 1)) / TILE_COLUMNS;

/**
 * Value size by what has to fit in the tile's 205px inner width: short
 * numbers at 80, longer numbers (1200g) and ratios (1対15 — written with 対 so
 * it never reads as a time like 2:30) at 60, words (中細挽き) at 48.
 */
export function tileValueSize(value: string, unit: string): number {
  if (value.includes("対")) return 60;
  const numeric = /^[\d.:,+-]+$/.test(value);
  if (!numeric) return TYPE.emphasis;
  return value.length + (unit === "g" || unit === "℃" ? 1 : 0) <= 4 ? TYPE.title : 60;
}

const NumberTileView: React.FC<{ tile: NumberTile; accent: string }> = ({ tile, accent }) => {
  const size = tileValueSize(tile.value, tile.unit);
  return (
    <div
      style={{
        width: TILE_WIDTH,
        height: 220,
        boxSizing: "border-box",
        background: COLORS.surface,
        border: `2px solid ${COLORS.hairline}`,
        borderTop: `6px solid ${accent}`,
        borderRadius: 24,
        padding: `28px ${SPACE.cardPad}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: TYPE.aux, fontWeight: 700, color: COLORS.textMuted }}>{tile.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: size >= 60 ? "-2px" : "0",
          }}
        >
          {tile.value}
        </span>
        {tile.unit ? <span style={{ fontSize: TYPE.body, fontWeight: 700, color: COLORS.textSub }}>{tile.unit}</span> : null}
      </div>
    </div>
  );
};

// The method + scene pills sit in their own row under the header: next to the
// date, a long method name (カリタウェーブ) + アイス pushed the date past the margin.
export const RecipeTitle: React.FC<{ slide: RecipeTitleSlide }> = ({ slide }) => (
  <SlideShell label={slide.heading} right={slide.date} brand>
    <Reveal delay={2} style={{ display: "flex", gap: 16, marginBottom: 36 }}>
      <Pill accent={COLORS.sky}>{slide.methodLabel}</Pill>
      <Pill accent={slide.sceneLabel === "アイス" ? COLORS.sage : COLORS.terracotta}>{slide.sceneLabel}</Pill>
    </Reveal>
    <Reveal delay={3}>
      <div style={{ fontSize: TYPE.title, fontWeight: 900, lineHeight: 1.18, letterSpacing: "-1px", ...PHRASE_BREAK }}>
        {slide.hook}
      </div>
    </Reveal>
    <Reveal delay={9} style={{ marginTop: 56 }}>
      <AccentLine>
        {slide.beanName}
        <div style={{ marginTop: 8, fontSize: TYPE.body, fontWeight: 600, color: COLORS.textSub }}>{slide.beanMeta}</div>
      </AccentLine>
    </Reveal>
    <div style={{ marginTop: SPACE.sectionS, display: "flex", flexWrap: "wrap", gap: TILE_GAP }}>
      {slide.tiles.map((tile, i) => (
        <Reveal key={tile.label} delay={15 + i * 3}>
          <NumberTileView tile={tile} accent={ACCENTS[i % ACCENTS.length]} />
        </Reveal>
      ))}
    </div>
  </SlideShell>
);

export const RecipeSteps: React.FC<{ slide: RecipeStepsSlide; page: string }> = ({ slide, page }) => {
  const rowHeight = slide.steps.length > 4 ? 190 : 230;
  const timeWidth = 190;
  const dotColumn = 84;
  return (
    <SlideShell label={slide.heading} right={page} center>
      <div style={{ position: "relative", paddingRight: SPACE.actionColumnClearance }}>
        {/* timeline rail — caramel, while all step text is white */}
        <div
          style={{
            position: "absolute",
            left: timeWidth + dotColumn / 2 - 2,
            top: rowHeight / 2,
            height: rowHeight * (slide.steps.length - 1),
            width: 4,
            background: COLORS.caramel,
            opacity: 0.7,
          }}
        />
        {slide.steps.map((step, i) => (
          <Reveal key={`${step.time}-${i}`} delay={4 + i * 5}>
            <div style={{ height: rowHeight, display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: timeWidth,
                  textAlign: "right",
                  fontSize: 56,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {step.time}
              </div>
              <div style={{ width: dotColumn, display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: COLORS.bg,
                    border: `7px solid ${COLORS.caramel}`,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1, fontSize: 44, fontWeight: 700 }}>{step.action}</div>
              {step.amount ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 56, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{step.amount}</span>
                  <span style={{ fontSize: TYPE.aux, fontWeight: 600, color: COLORS.textMuted }}>まで</span>
                </div>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={30} style={{ marginTop: SPACE.sectionS - 20, fontSize: TYPE.body, color: COLORS.textMuted, fontWeight: 600 }}>
        g はスケールの目盛り（注いだ合計）
      </Reveal>
    </SlideShell>
  );
};

const Meter: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
    <div style={{ width: 130, fontSize: 44, fontWeight: 700 }}>{label}</div>
    <div style={{ display: "flex", gap: 24 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: n <= value ? COLORS.caramel : "transparent",
            border: `3px solid ${n <= value ? COLORS.caramel : COLORS.hairline}`,
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  </div>
);

export const RecipeTaste: React.FC<{ slide: RecipeTasteSlide; page: string }> = ({ slide, page }) => (
  <SlideShell label={slide.heading} right={page} center>
    <Reveal delay={4} style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textMuted }}>
      フレーバー
    </Reveal>
    <Reveal delay={8} style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 24 }}>
      {slide.notes.map((note, i) => (
        <Pill key={note} accent={ACCENTS[i % ACCENTS.length]} size={40}>
          {note}
        </Pill>
      ))}
    </Reveal>
    <Reveal delay={14} style={{ marginTop: SPACE.sectionS }}>
      <AccentLine size={56}>{slide.summary}</AccentLine>
    </Reveal>
    <Reveal delay={20} style={{ marginTop: SPACE.sectionL, display: "flex", flexDirection: "column", gap: 44 }}>
      {slide.meters.map((m) => (
        <Meter key={m.label} label={m.label} value={m.value} />
      ))}
    </Reveal>
  </SlideShell>
);

const TIP_ACCENTS = [COLORS.terracotta, COLORS.sky, COLORS.sage];

export const RecipeTips: React.FC<{ slide: RecipeTipsSlide; page: string }> = ({ slide, page }) => (
  <SlideShell label={slide.heading} right={page} center>
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.gutter }}>
      {slide.tips.map((tip, i) => (
        <Reveal key={tip.problem} delay={4 + i * 6}>
          <div
            style={{
              background: COLORS.surface,
              border: `2px solid ${COLORS.hairline}`,
              borderRadius: 28,
              padding: SPACE.cardPad,
              paddingRight: SPACE.cardPad + SPACE.actionColumnClearance,
            }}
          >
            <Pill accent={TIP_ACCENTS[i % TIP_ACCENTS.length]}>{tip.problem}</Pill>
            <div
              style={{
                marginTop: 24,
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1.35,
                ...PHRASE_BREAK,
              }}
            >
              → {tip.fix}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  </SlideShell>
);

/** Last segment: save prompt + fixed sales line (bean name for recipes). */
export const CtaSlide: React.FC<{ ending: CtaEnding }> = ({ ending }) => (
  <AbsoluteFill lang="ja" style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
    <div style={{ position: "absolute", top: SPACE.top, left: SPACE.margin, right: SPACE.margin }}>
      <Reveal>
        <Pill accent={COLORS.caramel}>{ending.kind === "recipe-cta" ? "保存がおすすめ" : "毎週日曜"}</Pill>
      </Reveal>
      <Reveal delay={4} style={{ marginTop: SPACE.sectionS }}>
        <div style={{ fontSize: TYPE.title, fontWeight: 900, lineHeight: 1.2, ...PHRASE_BREAK }}>{ending.heading}</div>
      </Reveal>
      <Reveal delay={12} style={{ marginTop: SPACE.sectionL }}>
        <div
          style={{
            background: COLORS.surface,
            border: `2px solid ${COLORS.hairline}`,
            borderLeft: `8px solid ${COLORS.caramel}`,
            borderRadius: 28,
            padding: 48,
            paddingRight: 48 + SPACE.actionColumnClearance,
          }}
        >
          <div style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textSub }}>{ending.lead}</div>
          {ending.beanName ? (
            <div style={{ marginTop: 16, fontSize: TYPE.emphasis, fontWeight: 900, lineHeight: 1.3, ...PHRASE_BREAK }}>
              {ending.beanName}
            </div>
          ) : null}
          {ending.lines.map((line, i) => (
            <div key={line} style={{ marginTop: i === 0 ? 32 : 12, fontSize: TYPE.heading, fontWeight: 700 }}>
              {line}
            </div>
          ))}
        </div>
      </Reveal>
    </div>
    <Brand />
  </AbsoluteFill>
);
