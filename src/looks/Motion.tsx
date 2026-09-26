import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { PHRASE_BREAK } from "../cards/theme";
import type { LessonMotion } from "../cards/types";

/**
 * The why scene's picture: the change the episode is about, shown as a change
 * you can see (owner 2026-09-26: 「お湯の色が濃くなって…苦味とか味のパラメーター
 * みたいなのを出してグラフが動くとか」). Four kinds, one per episode
 * (data/curriculum.json lesson.motion.type):
 *
 *   liquid   — a glass server whose coffee turns darker / lighter + taste meters
 *   meter    — the taste meters are the picture (+ a colour strip of the coffee)
 *   compare  — the other way vs today's way: two cups drifting apart in colour
 *   dissolve — particles stream out of the grounds into the water, more or fewer
 *
 * Values are 0-100 positions; nothing is printed as a number. Text is secondary:
 * the meter names and one short line (lesson.core) under the picture.
 */

export interface MotionInk {
  line: string; // outlines
  text: string;
  sub: string;
  accent: string; // bars, arrows
  track: string; // meter track
  glass: string; // glass body tint
  card?: string; // photo: a frosted card behind the picture
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.inOut(Easing.cubic);
const prog = (f: number, a: number, b: number, e = easeOut) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

const LIGHT = [232, 199, 155]; // pale amber
const DARK = [43, 21, 10]; // near-black brown
export const coffeeColor = (shade: number) => {
  const t = Math.max(0, Math.min(1, shade / 100));
  const c = LIGHT.map((l, i) => Math.round(l + (DARK[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

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

/** A stroke that draws itself between frames a and b. */
const Draw: React.FC<{ d: string; a: number; b: number; color: string; width?: number; fill?: string }> = ({ d, a, b, color, width = 3, fill = "none" }) => {
  const p = prog(useCurrentFrame(), a, b, inOut);
  return <path d={d} fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
};

// ---------------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------------

/** Taste meters: bars move from `from` to `to`, then an arrow says which way. */
const Meters: React.FC<{ meters: LessonMotion["meters"]; ink: MotionInk; width: number; gap?: number; start?: number }> = ({ meters, ink, width, gap = 110, start = 36 }) => {
  const f = useCurrentFrame();
  const labelW = width < 600 ? 150 : 190;
  const barW = width - labelW - 20;
  return (
    <div style={{ position: "relative", width, height: meters.length * gap }}>
      {meters.map((m, i) => {
        const t0 = start + i * 8;
        const v = interpolate(f, [t0, t0 + 60], [m.from, m.to], { ...clamp, easing: inOut });
        const up = m.to > m.from + 2;
        const down = m.to < m.from - 2;
        const arrowIn = prog(f, t0 + 50, t0 + 66);
        return (
          <div key={m.label} style={{ position: "absolute", top: i * gap, left: 0, width, height: 60, display: "flex", alignItems: "center", opacity: prog(f, 14 + i * 6, 30 + i * 6) }}>
            <div style={{ width: labelW, display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
              <span style={T(40, 500, ink.text)}>{m.label}</span>
              {up || down ? (
                <svg width={34} height={46} viewBox="0 0 34 46" style={{ opacity: arrowIn }}>
                  <path d={up ? "M17 42 V6 M5 18 L17 4 L29 18" : "M17 4 V40 M5 28 L17 42 L29 28"} stroke={ink.accent} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
            <div style={{ position: "relative", width: barW, height: 22, borderRadius: 11, background: ink.track }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v}%`, borderRadius: 11, background: ink.accent }} />
              {/* where it was: a faint tick */}
              <div style={{ position: "absolute", left: `calc(${m.from}% - 2px)`, top: -9, width: 4, height: 40, borderRadius: 2, background: ink.sub, opacity: 0.5 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** A glass server (a coffee carafe) drawn in thin lines; the coffee inside takes the shade. */
const Server: React.FC<{ shade: number; ink: MotionInk; width: number; level?: number; drawAt?: number }> = ({ shade, ink, width, level = 0.55, drawAt = 0 }) => {
  const w = width;
  const h = w * 1.05;
  // straight-sided carafe, slightly wider at the base, with a lip and a spout on the left
  const body = `M ${w * 0.16} ${h * 0.14} L ${w * 0.76} ${h * 0.14} L ${w * 0.8} ${h * 0.86} Q ${w * 0.8} ${h * 0.97} ${w * 0.68} ${h * 0.97} L ${w * 0.24} ${h * 0.97} Q ${w * 0.12} ${h * 0.97} ${w * 0.12} ${h * 0.86} Z`;
  const top = h * (0.97 - 0.8 * level);
  const id = `srv${Math.round(w)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={id}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill={ink.glass} />
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={top} width={w} height={h} fill={coffeeColor(shade)} />
        <ellipse cx={w * 0.46} cy={top} rx={w * 0.36} ry={w * 0.035} fill={coffeeColor(Math.max(0, shade - 14))} />
        <rect x={w * 0.2} y={top + 12} width={w * 0.04} height={h * 0.97 - top - 30} rx={w * 0.02} fill="rgba(255,255,255,0.22)" />
      </g>
      <Draw d={body} a={drawAt} b={drawAt + 24} color={ink.line} />
      {/* lip + spout */}
      <Draw d={`M ${w * 0.12} ${h * 0.1} Q ${w * 0.16} ${h * 0.14} ${w * 0.2} ${h * 0.14} M ${w * 0.16} ${h * 0.14} L ${w * 0.05} ${h * 0.07}`} a={drawAt + 10} b={drawAt + 24} color={ink.line} />
      {/* handle */}
      <Draw d={`M ${w * 0.77} ${h * 0.24} Q ${w * 1.0} ${h * 0.24} ${w * 0.99} ${h * 0.5} Q ${w * 0.98} ${h * 0.72} ${w * 0.79} ${h * 0.74}`} a={drawAt + 12} b={drawAt + 30} color={ink.line} width={4} />
    </svg>
  );
};

/** Five cups from light to dark; a ring slides from the usual cup colour to today's. */
const ColourScale: React.FC<{ from: number; to: number; ink: MotionInk; width: number }> = ({ from, to, ink, width }) => {
  const f = useCurrentFrame();
  const shades = [10, 30, 50, 70, 90];
  const cell = width / shades.length;
  const at = interpolate(f, [40, 100], [from, to], { ...clamp, easing: inOut });
  const x = ((at - 10) / 80) * (width - cell) + cell / 2;
  return (
    <div style={{ position: "relative", width, height: 250 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, display: "flex", justifyContent: "space-between", ...T(40, 500, ink.sub) }}>
        <span>薄い</span>
        <span>濃い</span>
      </div>
      {shades.map((s, i) => (
        <div key={s} style={{ position: "absolute", left: i * cell + (cell - 120) / 2, top: 80, width: 120, height: 120, borderRadius: 60, background: coffeeColor(s), boxShadow: `inset 0 0 0 6px ${ink.glass}, 0 6px 16px rgba(0,0,0,0.25)`, opacity: prog(f, 6 + i * 4, 22 + i * 4) }} />
      ))}
      <div style={{ position: "absolute", left: x - 76, top: 58, width: 152, height: 164, borderRadius: 40, border: `5px solid ${ink.accent}`, opacity: prog(f, 30, 42) }} />
    </div>
  );
};

/** A cup, front view, in thin lines. */
const Cup: React.FC<{ shade: number; ink: MotionInk; width: number; drawAt?: number }> = ({ shade, ink, width, drawAt = 0 }) => {
  const h = width * 0.85;
  const body = `M ${width * 0.08} ${h * 0.12} L ${width * 0.82} ${h * 0.12} L ${width * 0.74} ${h * 0.86} Q ${width * 0.72} ${h * 0.96} ${width * 0.6} ${h * 0.96} L ${width * 0.3} ${h * 0.96} Q ${width * 0.18} ${h * 0.96} ${width * 0.16} ${h * 0.86} Z`;
  const id = `cup${width}${Math.round(shade)}`;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={id}>
          <path d={body} />
        </clipPath>
      </defs>
      <path d={body} fill={ink.glass} />
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={h * 0.2} width={width} height={h} fill={coffeeColor(shade)} />
      </g>
      <Draw d={body} a={drawAt} b={drawAt + 22} color={ink.line} />
      <Draw d={`M ${width * 0.8} ${h * 0.3} q ${width * 0.22} 0 ${width * 0.18} ${h * 0.2} q -${width * 0.04} ${h * 0.18} -${width * 0.23} ${h * 0.2}`} a={drawAt + 8} b={drawAt + 26} color={ink.line} />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// the four kinds
// ---------------------------------------------------------------------------

const useShade = (m: LessonMotion, a = 40, b = 100) => interpolate(useCurrentFrame(), [a, b], [m.shade.from, m.shade.to], { ...clamp, easing: inOut });

const Liquid: React.FC<{ m: LessonMotion; ink: MotionInk }> = ({ m, ink }) => {
  const shade = useShade(m);
  if (ink.card) {
    // photo: the coffee's colour on a scale of cups, the meters under it
    return (
      <div style={{ position: "relative", height: 600 }}>
        <ColourScale from={m.shade.from} to={m.shade.to} ink={ink} width={888} />
        <div style={{ position: "absolute", left: 0, top: 268 }}>
          <Meters meters={m.meters} ink={ink} width={888} gap={96} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height: 600 }}>
      <div style={{ position: "absolute", left: 0, top: 10 }}>
        <Server shade={shade} ink={ink} width={420} />
      </div>
      <div style={{ position: "absolute", left: 470, top: 90 }}>
        <Meters meters={m.meters} ink={ink} width={418} gap={120} />
      </div>
    </div>
  );
};

const MeterKind: React.FC<{ m: LessonMotion; ink: MotionInk }> = ({ m, ink }) => {
  const f = useCurrentFrame();
  const shade = useShade(m);
  return (
    <div style={{ position: "relative", height: 600 }}>
      {/* the coffee, as a strip that shifts colour */}
      <div style={{ position: "absolute", left: 0, top: 10, width: 888, height: 64, borderRadius: 32, background: coffeeColor(shade), opacity: prog(f, 6, 24) }} />
      <div style={{ position: "absolute", left: 0, top: 150 }}>
        <Meters meters={m.meters} ink={ink} width={888} gap={120} />
      </div>
    </div>
  );
};

const Compare: React.FC<{ m: LessonMotion; ink: MotionInk; sides: { label: string }[] }> = ({ m, ink, sides }) => {
  const shade = useShade(m);
  const f = useCurrentFrame();
  const cup = (label: string, s: number, x: number, at: number, mark: boolean) => (
    <div style={{ position: "absolute", left: x, top: 0, width: 400, textAlign: "center", opacity: prog(f, at, at + 16) }}>
      <Cup shade={s} ink={ink} width={260} drawAt={at} />
      <div style={T(40, mark ? 700 : 500, mark ? ink.accent : ink.sub, { marginTop: 10 })}>{label}と</div>
    </div>
  );
  return (
    <div style={{ position: "relative", height: 640 }}>
      {cup(sides[1]?.label ?? "いつも", m.shade.from, 0, 0, false)}
      {cup(sides[0]?.label ?? "今日", shade, 460, 10, true)}
      <div style={{ position: "absolute", left: 0, top: 320 }}>
        <Meters meters={m.meters} ink={ink} width={888} gap={110} start={44} />
      </div>
    </div>
  );
};

const Dissolve: React.FC<{ m: LessonMotion; ink: MotionInk }> = ({ m, ink }) => {
  const f = useCurrentFrame();
  const shade = useShade(m, 30, 110);
  // particles flowing from the grounds bed into the server; how many follows the change
  const density = interpolate(f, [30, 110], [m.shade.from, m.shade.to], { ...clamp, easing: inOut });
  const count = Math.round(8 + (density / 100) * 46);
  const W = 380;
  return (
    <div style={{ position: "relative", height: 620 }}>
      <svg width={W} height={620} viewBox={`0 0 ${W} 620`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {/* dripper cone with the grounds bed */}
        <path d={`M40 30 L${W - 40} 30 L${W / 2 + 34} 230 L${W / 2 - 34} 230 Z`} fill={ink.glass} />
        <path d={`M78 80 L${W - 78} 80 L${W / 2 + 30} 200 L${W / 2 - 30} 200 Z`} fill={coffeeColor(85)} opacity={0.9} />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={100 + rand(i + 1) * (W - 200)} cy={92 + rand(i + 9) * 60} r={4 + rand(i + 3) * 3} fill={coffeeColor(95)} />
        ))}
        <Draw d={`M40 30 L${W - 40} 30 L${W / 2 + 34} 230 L${W / 2 - 34} 230 Z`} a={0} b={22} color={ink.line} />
        {/* particles: leave the bed, fall, fade into the coffee */}
        {Array.from({ length: count }, (_, i) => {
          const life = ((f * 1.6 + i * 37) % 160) / 160;
          const x = W / 2 + (rand(i + 21) - 0.5) * 60 * (1 - life) + (rand(i + 5) - 0.5) * 120 * life;
          const y = 200 + life * 260;
          return <circle key={`p${i}`} cx={x} cy={y} r={5 - life * 2} fill={ink.accent} opacity={Math.sin(life * Math.PI) * 0.9} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 70, top: 270 }}>
        <Server shade={shade} ink={ink} width={240} level={0.6} drawAt={6} />
      </div>
      <div style={{ position: "absolute", left: 460, top: 90 }}>
        <Meters meters={m.meters} ink={ink} width={428} />
      </div>
    </div>
  );
};

/** The picture + the one-line core change under it (band y 500-1240). */
export const MotionPicture: React.FC<{ motion: LessonMotion; core: string; sides: { label: string }[]; ink: MotionInk }> = ({ motion, core, sides, ink }) => {
  const f = useCurrentFrame();
  const body =
    motion.type === "liquid" ? <Liquid m={motion} ink={ink} /> : motion.type === "meter" ? <MeterKind m={motion} ink={ink} /> : motion.type === "compare" ? <Compare m={motion} ink={ink} sides={sides} /> : <Dissolve m={motion} ink={ink} />;
  return (
    <AbsoluteFill>
      {ink.card ? <div style={{ position: "absolute", left: 60, right: 60, top: 480, height: 790, borderRadius: 40, background: ink.card, backdropFilter: "blur(14px)", opacity: prog(f, 0, 16) }} /> : null}
      <div style={{ position: "absolute", left: 96, top: 520, width: 888 }}>{body}</div>
      <div style={{ position: "absolute", left: 96, right: 96, top: 1110, opacity: prog(f, 96, 116), transform: `translateY(${(1 - prog(f, 96, 116)) * 20}px)`, ...T(48, 700, ink.accent) }}>{core}</div>
    </AbsoluteFill>
  );
};
