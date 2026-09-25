import React from "react";
import { AbsoluteFill } from "remotion";
import { Atmosphere, Drift, useCutIn } from "./atmosphere";
import { AccentLine, Brand, Pill, Reveal, SlideShell } from "./primitives";
import { ACCENTS, CARD_SHADOW, COLORS, DRIFT_MAX, FONT_FAMILY, PHRASE_BREAK, SPACE, TYPE } from "./theme";
import type {
  CtaEnding,
  NumberTile,
  LessonStepsSlide,
  LessonTasteSlide,
  LessonTipsSlide,
  LessonTitleSlide,
} from "./types";

const TILE_COLUMNS = 3;
// Must match the column SlideShell actually gives us, which is inset by
// DRIFT_MAX on each side; using the bare margin overflows by 16px and the
// three tiles wrap to two columns. The gap went 32 -> 24 to pay for the
// inset, which lands TILE_WIDTH back on exactly its pre-drift value (285.33,
// 205px inner) — the width tileValueSize below is tuned against.
const TILE_GAP = 24;
const TILE_WIDTH =
  (1080 - (SPACE.margin + DRIFT_MAX) * 2 - TILE_GAP * (TILE_COLUMNS - 1)) / TILE_COLUMNS;

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
        // No outer outline — outlining every box was one of the template
        // tells (docs/video-style.md §1, cause 5). The edge is carried by the
        // cast shadow instead; the fill alone is only 1.05:1 against the
        // background where the key light falls on it.
        background: COLORS.surface,
        borderTop: `6px solid ${accent}`,
        borderRadius: 24,
        boxShadow: CARD_SHADOW,
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
export const LessonTitle: React.FC<{ slide: LessonTitleSlide; index?: number }> = ({ slide, index = 0 }) => (
  <SlideShell label={slide.heading} right={slide.date} brand index={index}>
    <Reveal delay={2} style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 36 }}>
      {slide.series ? <Pill accent={COLORS.caramel}>{slide.series}</Pill> : null}
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
        {slide.topic}
        <div style={{ marginTop: 8, fontSize: TYPE.body, fontWeight: 600, color: COLORS.textSub }}>{slide.why}</div>
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

export const LessonSteps: React.FC<{ slide: LessonStepsSlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => {
  const rowHeight = slide.steps.length > 4 ? 190 : 230;
  const timeWidth = 190;
  const dotColumn = 84;
  return (
    <SlideShell label={slide.heading} right={page} center index={index}>
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

export const LessonTaste: React.FC<{ slide: LessonTasteSlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => (
  <SlideShell label={slide.heading} right={page} center index={index}>
    <Reveal delay={4} style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textMuted }}>
      味の変化
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

// No sky: RecipeTips is slide index 3, whose header pill takes ACCENTS[3] =
// sky. A tip card in the same colour as the header implies a grouping that
// isn't there.
const TIP_ACCENTS = [COLORS.terracotta, COLORS.caramel, COLORS.sage];

export const LessonTips: React.FC<{ slide: LessonTipsSlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => (
  <SlideShell label={slide.heading} right={page} center index={index}>
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.gutter }}>
      {slide.tips.map((tip, i) => (
        <Reveal key={tip.problem} delay={4 + i * 6}>
          <div
            style={{
              background: COLORS.surface,
              borderLeft: `8px solid ${TIP_ACCENTS[i % TIP_ACCENTS.length]}`,
              borderRadius: 28,
              boxShadow: CARD_SHADOW,
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

/**
 * Last segment: the day's takeaway + the save / follow prompt (no product, ever).
 *
 * Doesn't use SlideShell (no label/page header), so it has to opt into the
 * cut-in and the drift by hand — otherwise the video's final 6 seconds are
 * still a frozen frame arrived at by a hard cut, which is the whole defect.
 */
export const CtaSlide: React.FC<{ ending: CtaEnding; index?: number }> = ({ ending, index = 0 }) => {
  const cutIn = useCutIn();
  return (
  <AbsoluteFill lang="ja" style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
    <Atmosphere index={index} />
    <AbsoluteFill style={{ opacity: cutIn }}>
    <Drift index={index}>
    <div style={{ position: "absolute", top: SPACE.top + DRIFT_MAX, left: SPACE.margin + DRIFT_MAX, right: SPACE.margin + DRIFT_MAX }}>
      <Reveal>
        <Pill accent={COLORS.caramel}>保存がおすすめ</Pill>
      </Reveal>
      <Reveal delay={4} style={{ marginTop: SPACE.sectionS }}>
        <div style={{ fontSize: TYPE.title, fontWeight: 900, lineHeight: 1.2, ...PHRASE_BREAK }}>{ending.heading}</div>
      </Reveal>
      <Reveal delay={12} style={{ marginTop: SPACE.sectionL }}>
        <div
          style={{
            background: COLORS.surface,
            borderLeft: `8px solid ${COLORS.caramel}`,
            borderRadius: 28,
            boxShadow: CARD_SHADOW,
            padding: 48,
            paddingRight: 48 + SPACE.actionColumnClearance,
          }}
        >
          <div style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textSub }}>{ending.lead}</div>
          {ending.topic ? (
            <div style={{ marginTop: 16, fontSize: TYPE.emphasis, fontWeight: 900, lineHeight: 1.3, ...PHRASE_BREAK }}>
              {ending.topic}
            </div>
          ) : null}
          {ending.lines.map((line, i) => (
            <div key={line} style={{ marginTop: i === 0 ? 32 : 12, fontSize: TYPE.heading, fontWeight: 700 }}>
              {line}
            </div>
          ))}
        </div>
      </Reveal>
      {ending.next ? (
        <Reveal delay={20} style={{ marginTop: SPACE.sectionS - 16, display: "flex", alignItems: "center", gap: 24, paddingRight: SPACE.actionColumnClearance }}>
          <Pill accent={COLORS.sage}>次回</Pill>
          <div style={{ fontSize: TYPE.emphasis, fontWeight: 800, lineHeight: 1.3, ...PHRASE_BREAK }}>{ending.next}</div>
        </Reveal>
      ) : null}
    </div>
    <Brand />
    </Drift>
    </AbsoluteFill>
  </AbsoluteFill>
  );
};
