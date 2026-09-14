import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT_FAMILY, SPACE, TYPE } from "./theme";

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

/** Fade + rise entrance, `delay` in frames from the start of the slide. */
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
    config: { damping: 16, stiffness: 120 },
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

/** Background, header (label pill + page/date) and the content column. */
export const SlideShell: React.FC<{
  label: string;
  accent?: string;
  right?: string;
  extra?: React.ReactNode;
  /** vertically center the content inside the safe band (cards with little content) */
  center?: boolean;
  brand?: boolean;
  children: React.ReactNode;
}> = ({ label, accent = COLORS.caramel, right, extra, center = false, brand = false, children }) => (
  <AbsoluteFill
    lang="ja"
    style={{
      background: COLORS.bg,
      fontFamily: FONT_FAMILY,
      color: COLORS.text,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: SPACE.top,
        left: SPACE.margin,
        right: SPACE.margin,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Reveal style={{ display: "flex", gap: 16 }}>
        <Pill accent={accent}>{label}</Pill>
        {extra}
      </Reveal>
      {right ? (
        <div
          style={{
            fontSize: TYPE.bodyMin,
            fontWeight: 600,
            color: COLORS.textMuted,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "2px",
          }}
        >
          {right}
        </div>
      ) : null}
    </div>
    <div
      style={{
        position: "absolute",
        top: SPACE.contentTop,
        left: SPACE.margin,
        right: SPACE.margin,
        bottom: 1920 - SPACE.contentBottom,
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
      }}
    >
      {children}
    </div>
    {brand ? <Brand /> : null}
  </AbsoluteFill>
);
