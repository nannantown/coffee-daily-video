import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PHRASE_BREAK } from "../cards/theme";
import type { LessonMotion } from "../cards/types";
import { coffeeColor } from "./Motion";
import { VESSELS, type Vessel } from "./vessels";
import { whyLayout } from "./safe-layout.mjs";
import { withTo } from "./art";

/**
 * The why scene of the lab look (ラボノート), after the owner / commander notes
 * of 2026-09-26: keep the Codex pencil drawing's texture (not flat vector
 * fills) and use the whole 1080x1920 frame. The vessel is a Codex pencil
 * drawing (public/looks/lab-vessel-*.png); the coffee is poured into it in
 * code — a colour masked by the glass's inside (…-mask*.png, flood-filled from
 * the drawing by scripts/make-vessel-masks.mjs) and multiplied so the pencil
 * lines and hatching stay visible through it. Meters are hatched pencil bars.
 */

const INK = "#22201C";
// Fades the drawing out towards its edges, so the plate's paper never shows a rectangle.
const EDGE = "radial-gradient(ellipse 62% 48% at 50% 46%, #000 70%, transparent 100%)";
const GREY = "#6B655C";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.inOut(Easing.cubic);
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const prog = (f: number, a: number, b: number, e = easeOut) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

const T = (size: number, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.45,
  letterSpacing: "0.03em",
  fontFeatureSettings: '"palt"',
  ...PHRASE_BREAK,
  ...extra,
});

/** Pencil grain over the whole frame, so code-drawn parts share the paper. */
export const PaperGrain: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "multiply", opacity: 0.35 }}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} />
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.34  0 0 0 0.16 0" />
    </filter>
    <rect width={1080} height={1920} filter="url(#grain)" />
  </svg>
);

/** Coffee poured into the drawn glass: a colour inside the mask, lines kept by multiply. */
const Pour: React.FC<{ mask: string; shade: number; top: number; drawIn: number }> = ({ mask, shade, top, drawIn }) => {
  const m = `url(${staticFile(`looks/${mask}`)})`;
  return (
    <AbsoluteFill style={{ WebkitMaskImage: m, maskImage: m, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", mixBlendMode: "multiply", opacity: drawIn }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top,
          bottom: 0,
          // pencil-hatched and see-through near the surface, like the storyboard's glass
          background: `repeating-linear-gradient(128deg, rgba(0,0,0,0.16) 0 2px, rgba(0,0,0,0) 2px 10px), linear-gradient(180deg, rgba(255,214,150,0.35) 0%, rgba(255,214,150,0.08) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.14) 100%), ${coffeeColor(shade)}`,
          opacity: 0.94,
        }}
      />
    </AbsoluteFill>
  );
};

/** The pencil drawing, uncovered as if drawn (soft diagonal wipe). */
const Drawing: React.FC<{ v: Vessel; transform: string; children?: React.ReactNode }> = ({ v, transform, children }) => {
  const f = useCurrentFrame();
  const reveal = interpolate(f, [0, 36], [-30, 130], { ...clamp, easing: inOut });
  const mask = `linear-gradient(160deg, #000 ${reveal - 25}%, transparent ${reveal}%)`;
  return (
    <AbsoluteFill style={{ transform, transformOrigin: "0 0", mixBlendMode: "darken" }}>
      <AbsoluteFill style={{ WebkitMaskImage: `${mask}, ${EDGE}`, maskImage: `${mask}, ${EDGE}`, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}>
        <Img src={staticFile(`looks/${v.file}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};

/** Hatched pencil bars: the fill is diagonal strokes in the accent, the track a rough outline. */
const PencilMeters: React.FC<{ meters: LessonMotion["meters"]; accent: string; top: number; gap: number; start?: number }> = ({ meters, accent, top, gap, start = 40 }) => {
  const f = useCurrentFrame();
  const labelW = 270; // 4 characters at 52px + the arrow
  const barW = 888 - labelW - 20;
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <pattern id="hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <line x1={0} y1={0} x2={0} y2={10} stroke={accent} strokeWidth={4} />
          </pattern>
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} />
            <feDisplacementMap in="SourceGraphic" scale={3} />
          </filter>
        </defs>
      </svg>
      {meters.map((m, i) => {
        const t0 = start + i * 8;
        const v = interpolate(f, [t0, t0 + 60], [m.from, m.to], { ...clamp, easing: inOut });
        const up = m.to > m.from + 2;
        const down = m.to < m.from - 2;
        const w = (barW * v) / 100;
        return (
          <div key={m.label} style={{ position: "absolute", left: 96, top: top + i * gap, width: 888, height: 64, display: "flex", alignItems: "center", opacity: prog(f, 14 + i * 6, 30 + i * 6) }}>
            <div style={{ width: labelW, display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
              <span style={T(52, 700, INK)}>{m.label}</span>
              {up || down ? (
                <svg width={36} height={48} viewBox="0 0 36 48" style={{ opacity: prog(f, t0 + 50, t0 + 66), filter: "url(#rough)" }}>
                  <path d={up ? "M18 44 V6 M5 19 L18 4 L31 19" : "M18 4 V42 M5 29 L18 44 L31 29"} stroke={accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
            <svg width={barW + 8} height={52} style={{ overflow: "visible", filter: "url(#rough)" }}>
              <rect x={2} y={6} width={barW} height={40} rx={4} fill="rgba(34,32,28,0.03)" stroke={GREY} strokeWidth={2.5} />
              <rect x={2} y={6} width={w} height={40} rx={4} fill="url(#hatch)" />
              <rect x={2} y={6} width={w} height={40} rx={4} fill={accent} opacity={0.3} />
              {/* where it was */}
              <line x1={2 + (barW * m.from) / 100} x2={2 + (barW * m.from) / 100} y1={-2} y2={54} stroke={GREY} strokeWidth={3} strokeDasharray="4 4" />
            </svg>
          </div>
        );
      })}
    </>
  );
};

const Particles: React.FC<{ from: { x: number; y: number }; toY: number; density: number; color: string }> = ({ from, toY, density, color }) => {
  const f = useCurrentFrame();
  const count = Math.round(10 + (density / 100) * 60);
  const rand = (s: number) => {
    const x = Math.sin(s * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: count }, (_, i) => {
        const life = ((f * 1.5 + i * 37) % 150) / 150;
        const x = from.x + (rand(i + 5) - 0.5) * 70 * life;
        const y = from.y + life * (toY - from.y);
        return <circle key={i} cx={x} cy={y} r={9 - life * 3} fill={color} opacity={Math.sin(life * Math.PI) * 0.95} />;
      })}
    </svg>
  );
};

/** Full frame: the drawn vessel(s) with coffee poured in, the meters, the core line (all text ≤ CONTENT_BOTTOM). */
export const PencilMotion: React.FC<{ motion: LessonMotion; core: string; sides: { label: string }[]; accent: string; heading: string }> = ({ motion, core, sides, accent, heading }) => {
  const f = useCurrentFrame();
  const shade = interpolate(f, [40, 100], [motion.shade.from, motion.shade.to], { ...clamp, easing: inOut });
  const pourIn = prog(f, 20, 40);
  const kind = motion.type === "compare" ? "cups" : motion.type === "dissolve" ? "dripper" : "server";
  const v = VESSELS[kind];
  const L = whyLayout({ heading, core, meters: motion.meters.length, box: v.box, maxScale: v.maxScale, labels: kind === "cups" });
  const level = (m: number) => v.interiorBottom - (v.interiorBottom - v.interiorTop) * m;
  // plate → screen: scale about the frame's centre line, the box's top at L.top
  const place = `translate(${540 - 540 * L.scale}px, ${L.top - v.box.top * L.scale}px) scale(${L.scale})`;
  return (
    <AbsoluteFill>
      <Drawing v={v} transform={place}>
        {kind === "cups" ? (
          <>
            <Pour mask={v.masks[0]} shade={motion.shade.from} top={level(0.75)} drawIn={pourIn} />
            <Pour mask={v.masks[1]} shade={shade} top={level(0.75)} drawIn={pourIn} />
          </>
        ) : (
          <Pour mask={v.masks[0]} shade={shade} top={level(0.62)} drawIn={pourIn} />
        )}
        {kind === "dripper" && v.tip ? <Particles from={v.tip} toY={level(0.62)} density={interpolate(f, [30, 110], [motion.shade.from, motion.shade.to], clamp)} color={coffeeColor(88)} /> : null}
      </Drawing>
      {kind === "cups"
        ? sides.slice(0, 2).map((s, i) => {
            const x = 540 + ((v.labelX?.[1 - i] ?? 540) - 540) * L.scale;
            return (
              <div key={s.label} style={{ position: "absolute", top: L.labelTop, left: x - 220, width: 440, textAlign: "center", opacity: prog(f, 30, 46), ...T(48, i === 0 ? 700 : 500, i === 0 ? accent : GREY) }}>
                {withTo(s.label)}
              </div>
            );
          })
        : null}
      <PencilMeters meters={motion.meters} accent={accent} top={L.metersTop} gap={L.gap} />
      <div style={{ position: "absolute", left: 96, right: 96, top: L.coreTop - 26, opacity: prog(f, 100, 118), transform: `translateY(${(1 - prog(f, 100, 118)) * 16}px)` }}>
        <div style={{ height: 2, background: "#D6D0C4", marginBottom: 24 }} />
        <div style={T(48, 700, accent, { lineHeight: 1.5 })}>{core}</div>
      </div>
      <PaperGrain />
    </AbsoluteFill>
  );
};
