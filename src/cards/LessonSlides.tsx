import React from "react";
import { AbsoluteFill } from "remotion";
import { Atmosphere, Drift, useCutIn } from "./atmosphere";
import { AccentLine, Brand, Pill, Reveal, SlideShell } from "./primitives";
import { ACCENTS, CARD_SHADOW, COLORS, DRIFT_MAX, FONT_FAMILY, PHRASE_BREAK, SPACE, TYPE } from "./theme";
import type { CtaEnding, LessonEffectSlide, LessonTipsSlide, LessonTitleSlide, LessonWhySlide } from "./types";

// The cover: one big word + the question, and what it does to the taste. No
// numbers (owner decision 2026-09-26) — the profile grid has to say what the
// episode is about at a glance.
export const LessonTitle: React.FC<{ slide: LessonTitleSlide; index?: number }> = ({ slide, index = 0 }) => (
  <SlideShell label={slide.heading} right={slide.date} brand index={index}>
    <Reveal delay={2} style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 48 }}>
      {slide.series ? <Pill accent={COLORS.caramel}>{slide.series}</Pill> : null}
    </Reveal>
    <Reveal delay={3}>
      <div style={{ fontSize: 160, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-2px" }}>{slide.word}</div>
      <div style={{ marginTop: 8, fontSize: TYPE.title, fontWeight: 800, lineHeight: 1.2 }}>{slide.ask}</div>
    </Reveal>
    <Reveal delay={9} style={{ marginTop: 64 }}>
      <AccentLine>{slide.topic}</AccentLine>
    </Reveal>
  </SlideShell>
);

export const LessonWhy: React.FC<{ slide: LessonWhySlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => (
  <SlideShell label={slide.heading} right={page} center index={index}>
    <Reveal delay={4} style={{ fontSize: TYPE.emphasis, fontWeight: 700, color: COLORS.textMuted, ...PHRASE_BREAK }}>
      {slide.hook}と
    </Reveal>
    <Reveal delay={10} style={{ marginTop: 40, paddingRight: SPACE.actionColumnClearance }}>
      <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.3, ...PHRASE_BREAK }}>{slide.why}</div>
    </Reveal>
  </SlideShell>
);

const SIDE_ACCENTS = [COLORS.terracotta, COLORS.sky];

export const LessonEffect: React.FC<{ slide: LessonEffectSlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => (
  <SlideShell label={slide.heading} right={page} center index={index}>
    <div style={{ display: "flex", flexDirection: "column", gap: 64, paddingRight: SPACE.actionColumnClearance }}>
      {slide.sides.map((s, i) => (
        <Reveal key={s.label} delay={4 + i * 10}>
          <Pill accent={SIDE_ACCENTS[i]} size={44}>
            {s.label}と
          </Pill>
          <div style={{ marginTop: 24, fontSize: 64, fontWeight: 900, lineHeight: 1.25, ...PHRASE_BREAK }}>{s.taste}</div>
        </Reveal>
      ))}
    </div>
  </SlideShell>
);

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
