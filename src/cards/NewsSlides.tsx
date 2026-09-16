import React from "react";
import { Pill, Reveal, SlideShell } from "./primitives";
import { COLORS, PHRASE_BREAK, SPACE, TYPE } from "./theme";
import type { NewsCoverSlide, NewsItemSlide } from "./types";

export const NewsCover: React.FC<{ slide: NewsCoverSlide }> = ({ slide }) => (
  <SlideShell label="毎週日曜" accent={COLORS.sky} right={slide.date}>
    <Reveal delay={4}>
      <div style={{ fontSize: TYPE.title, fontWeight: 900, lineHeight: 1.2, ...PHRASE_BREAK }}>{slide.heading}</div>
    </Reveal>
    <Reveal delay={10} style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 28 }}>
      <Pill accent={COLORS.caramel} size={38}>
        TOP5
      </Pill>
      {slide.weekLabel ? (
        <span style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textSub }}>{slide.weekLabel}</span>
      ) : null}
    </Reveal>
    <div style={{ marginTop: SPACE.sectionS, paddingRight: SPACE.actionColumnClearance }}>
      {slide.headlines.map((headline, i) => (
        <Reveal key={headline} delay={16 + i * 4}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 24,
              padding: "22px 0",
              borderTop: i === 0 ? "none" : `2px solid ${COLORS.hairline}`,
            }}
          >
            <div style={{ width: 56, fontSize: TYPE.emphasis, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, fontSize: TYPE.body, fontWeight: 700, lineHeight: 1.4, ...PHRASE_BREAK }}>{headline}</div>
          </div>
        </Reveal>
      ))}
    </div>
  </SlideShell>
);

export const NewsItem: React.FC<{ slide: NewsItemSlide; page: string }> = ({ slide, page }) => (
  <SlideShell label="今週のニュース" accent={COLORS.sky} right={page} center>
    <Reveal delay={2} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: TYPE.rank, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{slide.rank}</span>
      <span style={{ fontSize: 56, fontWeight: 800, color: COLORS.textSub }}>位</span>
    </Reveal>
    <Reveal delay={8} style={{ marginTop: 40 }}>
      <div style={{ fontSize: TYPE.emphasis + 8, fontWeight: 900, lineHeight: 1.3, ...PHRASE_BREAK }}>{slide.headline}</div>
    </Reveal>
    {slide.number ? (
      <Reveal delay={14} style={{ marginTop: SPACE.sectionS }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 24,
            background: COLORS.surface,
            border: `2px solid ${COLORS.hairline}`,
            borderTop: `6px solid ${COLORS.caramel}`,
            borderRadius: 28,
            padding: SPACE.cardPad,
          }}
        >
          <span style={{ fontSize: TYPE.hero, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{slide.number}</span>
          {slide.numberLabel ? (
            <span style={{ fontSize: TYPE.heading, fontWeight: 700, color: COLORS.textSub }}>{slide.numberLabel}</span>
          ) : null}
        </div>
      </Reveal>
    ) : null}
    <Reveal delay={20} style={{ marginTop: SPACE.sectionS, paddingRight: SPACE.actionColumnClearance }}>
      <div style={{ fontSize: TYPE.body + 2, fontWeight: 600, lineHeight: 1.5, color: COLORS.textSub, ...PHRASE_BREAK }}>
        {slide.summary}
      </div>
      <div style={{ marginTop: 32, fontSize: TYPE.footer, fontWeight: 600, color: COLORS.textMuted }}>出典: {slide.source}</div>
    </Reveal>
  </SlideShell>
);
