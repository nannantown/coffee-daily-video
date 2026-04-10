import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";


export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Date appears first (frame 0-15)
  const dateOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const dateY = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
    from: 40,
    to: 0,
  });

  // GitHub icon + title (frame 10-30)
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleY = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, stiffness: 100 },
    from: 60,
    to: 0,
  });

  // Divider (frame 20+)
  const lineScale = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 15, stiffness: 120 },
    from: 0,
    to: 1,
  });

  // Subtitle (frame 30-50)
  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleY = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, stiffness: 80 },
    from: 40,
    to: 0,
  });

  const glowOpacity = interpolate(frame, [0, 30, 60], [0, 0.6, 0.3]);

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #1a0e08 0%, #2C1810 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212, 165, 116, 0.2) 0%, transparent 70%)",
          opacity: glowOpacity,
        }}
      />

      {/* Date - prominent, appears first */}
      <div
        style={{
          opacity: dateOpacity,
          transform: `translateY(${dateY}px)`,
          marginBottom: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 68,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "6px",
          }}
        >
          {dateStr}
        </div>
      </div>

      {/* Coffee icon */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 40,
          fontSize: 100,
        }}
      >
        {"☕"}
      </div>

      {/* Main title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#F5E6D3",
            letterSpacing: "-1px",
            lineHeight: 1.1,
          }}
        >
          Coffee
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            background: "linear-gradient(90deg, #D4A574, #E8C5A0)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-1px",
            lineHeight: 1.1,
          }}
        >
          Daily
        </div>
      </div>

      {/* Divider line */}
      <div
        style={{
          width: 200 * lineScale,
          height: 3,
          background: "linear-gradient(90deg, #D4A574, #E8C5A0)",
          borderRadius: 2,
          margin: "32px 0",
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          fontSize: 42,
          fontWeight: 700,
          color: "rgba(245, 230, 211, 0.9)",
          letterSpacing: "2px",
        }}
      >
        今日のコーヒートレンド
      </div>

    </AbsoluteFill>
  );
};
