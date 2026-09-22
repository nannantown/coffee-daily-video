import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Atmosphere, Drift, DRIFT_MAX, useCutIn } from "./atmosphere";
import { ACCENTS, COLORS, FONT_FAMILY, SPACE, TYPE } from "./theme";

/** Solid label chip: opaque fill, white text, color carried by the border. */
export const Pill: React.FC<{
  children: React.ReactNode;
  accent?: string;
  size?: number;
}> = ({ children, accent = COLORS.caramel, size = TYPE.pill }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      background: COLORS.pill,
      border: `3px solid ${accent}`,
      borderRadius: 999,
      padding: "10px 30px",
      color: COLORS.text,
      fontSize: size,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: "1px",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/**
 * Fade + rise entrance, `delay` in frames from the start of the slide.
 *
 * The spring is detuned by `delay` so stacked elements do not all ride the
 * exact same curve — when every item on a slide settles identically the eye
 * reads it as one animated PNG rather than a sequence of decisions.
 */
export const Reveal: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15 + (delay % 5), stiffness: 108 + (delay % 7) * 6 },
    from: 24,
    to: 0,
  });
  return <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>{children}</div>;
};

/** Accent bar + text block (bar color ≠ text color). */
export const AccentLine: React.FC<{
  children: React.ReactNode;
  accent?: string;
  size?: number;
}> = ({ children, accent = COLORS.caramel, size = TYPE.emphasis }) => (
  <div style={{ display: "flex", alignItems: "stretch", gap: 32 }}>
    <div style={{ width: 8, borderRadius: 4, background: accent, flexShrink: 0 }} />
    <div
      style={{
        fontSize: size,
        fontWeight: 800,
        color: COLORS.text,
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  </div>
);

export const Brand: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: SPACE.margin,
      top: SPACE.contentBottom - 80,
      fontSize: TYPE.footer,
      fontWeight: 600,
      letterSpacing: "4px",
      color: COLORS.textMuted,
    }}
  >
    OPEN GROUND COFFEE ROASTERS
  </div>
);

/**
 * Background, header (label pill + page/date) and the content column.
 *
 * `index` is the slide's position in the video. Everything it drives exists
 * for one reason: before it, two completely different recipes rendered to
 * pixel-identical frames (docs/video-style.md §1, causes 1 and 4). It varies
 * the header side, the accent and the key-light position so consecutive cuts
 * no longer share a silhouette. Labels stay solid pills and lines still never
 * share a colour with the text beside them — those are owner rules, not style.
 */
export const SlideShell: React.FC<{
  label: string;
  accent?: string;
  right?: string;
  extra?: React.ReactNode;
  /** vertically center the content inside the safe band (cards with little content) */
  center?: boolean;
  brand?: boolean;
  index?: number;
  children: React.ReactNode;
}> = ({ label, accent, right, extra, center = false, brand = false, index = 0, children }) => {
  const cutIn = useCutIn();
  const slideAccent = accent ?? ACCENTS[index % ACCENTS.length];
  // Mirror the header every other cut. The header sits at y=180, well clear of
  // the action-button column, so either side is safe.
  const mirrored = index % 2 === 1;

  return (
    <AbsoluteFill
      lang="ja"
      style={{
        background: COLORS.bg,
        fontFamily: FONT_FAMILY,
        color: COLORS.text,
      }}
    >
      <Atmosphere index={index} />
      <AbsoluteFill style={{ opacity: cutIn }}>
        <div
          style={{
            position: "absolute",
            top: SPACE.top,
            left: SPACE.margin,
            right: SPACE.margin,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexDirection: mirrored ? "row-reverse" : "row",
          }}
        >
          <Reveal style={{ display: "flex", gap: 16 }}>
            <Pill accent={slideAccent}>{label}</Pill>
            {extra}
          </Reveal>
          {right ? (
            <div
              style={{
                fontSize: TYPE.aux,
                fontWeight: 600,
                color: COLORS.textMuted,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "2px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {right}
            </div>
          ) : null}
        </div>
        <Drift index={index}>
          <div
            style={{
              position: "absolute",
              // Inset by the drift budget on every side, so that at full
              // drift the column is back on the documented safe-area bounds
              // instead of DRIFT_MAX past them.
              top: SPACE.contentTop + DRIFT_MAX,
              left: SPACE.margin + DRIFT_MAX,
              right: SPACE.margin + DRIFT_MAX,
              bottom: 1920 - SPACE.contentBottom + DRIFT_MAX,
              display: "flex",
              flexDirection: "column",
              justifyContent: center ? "center" : "flex-start",
            }}
          >
            {children}
          </div>
          {/* Inside Drift: the footer is part of the frame and should travel
              with the column, not sit still while the content slides. */}
          {brand ? <Brand /> : null}
        </Drift>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
