import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AccentLine, Pill, Reveal, SlideShell } from "./primitives";
import { CARD_SHADOW, COLORS, DRIFT_MAX, PHRASE_BREAK, SPACE, TYPE } from "./theme";
import type { CompareSide, FlowBrewer, LessonVisual, LessonVisualSlide } from "./types";

/**
 * The diagram slide: the day's one change, drawn instead of told (owner
 * request 2026-09-25 — more kinds of animation so the change is easy to see).
 * Four kinds, picked per lesson by the script (lesson.visual.type):
 *
 *   compare — two cups side by side: condition → how dark / what it tastes like
 *   graph   — how one taste moves along a variable (time, bloom …), today marked
 *   flow    — a brewer in cross-section: where the water goes (percolation vs immersion, shapes, pours)
 *   scale   — a gauge with named zones; the needle moves from the usual spot to today's (no numbers)
 *
 * House rules kept from the other cards (docs/video-style.md): body text ≥ 40px,
 * auxiliary ≥ 32px, text stays white, accent colours only on lines / fills,
 * no outlined boxes. The whole diagram keeps the 80px action-column clearance
 * on the right because most of it sits below y=1000.
 */

// Content column minus the action-column clearance.
const WIDTH = 1080 - (SPACE.margin + DRIFT_MAX) * 2 - SPACE.actionColumnClearance; // 824
const HALF_GAP = 40;
const HALF = (WIDTH - HALF_GAP) / 2; // 392

// Where the main build-up of each diagram has settled: render-previews shoots
// frame 48, so everything that carries meaning lands before ~frame 42. Motion
// after that is ambient (steam, drips, particles).
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.33, 0, 0.2, 1);
function progress(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], { ...clampOpts, easing: ease });
}

// Coffee colour by strength 1 (light) … 5 (dark).
const BREW = ["#d8b081", "#b67d4b", "#8b552f", "#613519", "#40200d"];
const GROUNDS = "#6e4326";
const GROUNDS_DARK = "#4b2b16";
const WATER = "rgba(123,157,184,0.34)";
const STREAM = "#a9c6dd";

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------

const Cup: React.FC<{ strength: number; accent: string; delay: number }> = ({ strength, accent, delay }) => {
  const frame = useCurrentFrame();
  const fill = progress(frame, delay, delay + 26);
  const color = BREW[Math.min(5, Math.max(1, strength)) - 1];
  const top = 70;
  const bottom = 236;
  const level = bottom - (bottom - top - 22) * fill;
  const id = `cup-${delay}`;
  return (
    <svg width={300} height={300} viewBox="0 0 260 260">
      <defs>
        <clipPath id={id}>
          <path d="M34 70 L226 70 L204 226 Q202 236 190 236 L70 236 Q58 236 56 226 Z" />
        </clipPath>
      </defs>
      {/* steam — ambient, starts once the cup is full */}
      {[70, 130, 190].map((x, i) => {
        const t = (frame + i * 11) % 40;
        const o = fill >= 1 ? interpolate(t, [0, 12, 40], [0, 0.55, 0]) : 0;
        return (
          <path
            key={x}
            d={`M${x} ${58 - t * 0.6} c -10 -12, 10 -20, 0 -34`}
            stroke={accent}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            opacity={o}
          />
        );
      })}
      <path d="M34 70 L226 70 L204 226 Q202 236 190 236 L70 236 Q58 236 56 226 Z" fill={COLORS.surface} />
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={level} width={260} height={260} fill={color} />
        <rect x={0} y={level} width={260} height={8} fill="rgba(255,255,255,0.22)" />
      </g>
      <path
        d="M34 70 L226 70 L204 226 Q202 236 190 236 L70 236 Q58 236 56 226 Z"
        fill="none"
        stroke={accent}
        strokeWidth={8}
        strokeLinejoin="round"
      />
      <path d="M220 100 C 262 100, 262 176, 210 178" fill="none" stroke={accent} strokeWidth={10} strokeLinecap="round" />
    </svg>
  );
};

const CompareColumn: React.FC<{
  side: CompareSide;
  accent: string;
  delay: number;
  dim: boolean;
  picked: boolean;
}> = ({ side, accent, delay, dim, picked }) => {
  const frame = useCurrentFrame();
  const opacity = dim ? interpolate(frame, [34, 44], [1, 0.62], clampOpts) : 1;
  return (
    <div style={{ width: HALF, display: "flex", flexDirection: "column", alignItems: "center", opacity }}>
      <Reveal delay={delay}>
        <Pill accent={accent} size={48}>
          {side.label}
        </Pill>
      </Reveal>
      <div style={{ height: 56, marginTop: 20, display: "flex", alignItems: "center" }}>
        {picked ? (
          <Reveal delay={36}>
            <Pill accent={COLORS.sage} size={32}>
              今日はこっち
            </Pill>
          </Reveal>
        ) : null}
      </div>
      <Cup strength={side.strength} accent={accent} delay={delay + 4} />
      <Reveal delay={delay + 24} style={{ width: "100%", marginTop: 24 }}>
        <div
          style={{
            background: COLORS.surface,
            borderTop: `6px solid ${accent}`,
            borderRadius: 24,
            boxShadow: CARD_SHADOW,
            minHeight: 168,
            boxSizing: "border-box",
            padding: "24px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: TYPE.body,
            fontWeight: 800,
            lineHeight: 1.35,
            ...PHRASE_BREAK,
          }}
        >
          {side.result}
        </div>
      </Reveal>
    </div>
  );
};

const CompareDiagram: React.FC<{ v: Extract<LessonVisual, { type: "compare" }> }> = ({ v }) => {
  const frame = useCurrentFrame();
  const arrowIn = progress(frame, 20, 32);
  // The chip in the middle points at today's side; without a pick it just joins them.
  const rotate = v.pick === "left" ? 180 : 0;
  return (
    <div style={{ position: "relative", display: "flex", gap: HALF_GAP, width: WIDTH }}>
      <CompareColumn side={v.left} accent={COLORS.sky} delay={2} dim={v.pick === "right"} picked={v.pick === "left"} />
      <CompareColumn side={v.right} accent={COLORS.caramel} delay={8} dim={v.pick === "left"} picked={v.pick === "right"} />
      <div
        style={{
          position: "absolute",
          left: WIDTH / 2 - 48,
          top: 76 + 56 + 20 + 150 - 48,
          width: 96,
          height: 96,
          borderRadius: 48,
          background: COLORS.pill,
          boxShadow: CARD_SHADOW,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: arrowIn,
          transform: `scale(${0.6 + 0.4 * arrowIn})`,
        }}
      >
        {v.pick ? (
          <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: `rotate(${rotate}deg)` }}>
            <path d="M8 28 H44 M30 12 L46 28 L30 44" stroke={COLORS.terracotta} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width={56} height={56} viewBox="0 0 56 56">
            <path d="M12 20 H44 M12 36 H44" stroke={COLORS.terracotta} strokeWidth={7} strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// graph
// ---------------------------------------------------------------------------

const G = { w: WIDTH, h: 600, x0: 56, x1: WIDTH - 56, yTop: 96, yBottom: 500 };
const ZONE_FILLS = ["rgba(123,157,184,0.13)", "rgba(140,180,160,0.13)", "rgba(201,123,75,0.15)"];

const GraphDiagram: React.FC<{ v: Extract<LessonVisual, { type: "graph" }> }> = ({ v }) => {
  const frame = useCurrentFrame();
  const n = v.points.length;
  const xs = v.points.map((_, i) => G.x0 + ((G.x1 - G.x0) * i) / (n - 1));
  const ys = v.points.map((p) => G.yBottom - ((G.yBottom - G.yTop) * (p.value - 1)) / 4);
  let length = 0;
  for (let i = 1; i < n; i++) length += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const drawn = progress(frame, 10, 38);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x} ${ys[i]}`).join(" ");
  const zones = v.zones ?? [];
  const markIn = progress(frame, 36, 44);
  const mark = v.mark;

  return (
    <div style={{ width: WIDTH }}>
      <Reveal delay={2} style={{ fontSize: TYPE.body, fontWeight: 700, color: COLORS.textSub }}>
        ↑ {v.yLabel}
      </Reveal>
      <div style={{ position: "relative", width: G.w, height: G.h, marginTop: 8 }}>
        <svg width={G.w} height={G.h} viewBox={`0 0 ${G.w} ${G.h}`} style={{ position: "absolute", inset: 0 }}>
          {zones.map((label, i) => {
            const zx = G.x0 - 28 + ((G.x1 - G.x0 + 56) * i) / zones.length;
            const zw = (G.x1 - G.x0 + 56) / zones.length;
            return (
              <g key={label} opacity={progress(frame, 4 + i * 3, 14 + i * 3)}>
                <rect x={zx} y={G.yTop - 70} width={zw} height={G.yBottom - G.yTop + 90} fill={ZONE_FILLS[i % ZONE_FILLS.length]} />
                <text x={zx + zw / 2} y={G.yTop - 30} textAnchor="middle" fill={COLORS.text} fontSize={TYPE.aux} fontWeight={700}>
                  {label}
                </text>
              </g>
            );
          })}
          {[1, 2, 3, 4, 5].map((k) => {
            const y = G.yBottom - ((G.yBottom - G.yTop) * (k - 1)) / 4;
            return <line key={k} x1={G.x0 - 28} x2={G.x1 + 28} y1={y} y2={y} stroke={COLORS.hairline} strokeWidth={2} />;
          })}
          <line x1={G.x0 - 28} x2={G.x1 + 28} y1={G.yBottom + 20} y2={G.yBottom + 20} stroke={COLORS.textMuted} strokeWidth={3} />
          {mark != null ? (
            <line
              x1={xs[mark]}
              x2={xs[mark]}
              y1={ys[mark]}
              y2={G.yBottom + 20}
              stroke={COLORS.sage}
              strokeWidth={5}
              strokeDasharray="12 10"
              opacity={markIn}
            />
          ) : null}
          <path
            d={d}
            fill="none"
            stroke={COLORS.caramel}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - drawn)}
          />
          {v.points.map((p, i) => {
            const shown = drawn >= (n === 1 ? 0 : i / (n - 1)) - 0.001;
            const isMark = i === mark;
            const r = isMark ? 13 + 9 * markIn : 13;
            return (
              <g key={`${p.label}-${i}`} opacity={shown ? 1 : 0}>
                <circle cx={xs[i]} cy={ys[i]} r={r} fill={isMark && markIn > 0 ? COLORS.sage : COLORS.bg} stroke={isMark ? COLORS.sage : COLORS.caramel} strokeWidth={6} />
                <text x={xs[i]} y={G.yBottom + 72} textAnchor="middle" fill={COLORS.text} fontSize={TYPE.aux} fontWeight={700}>
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
        {mark != null ? (
          <div
            style={{
              position: "absolute",
              left: Math.min(Math.max(xs[mark] - 70, 0), G.w - 140),
              top: ys[mark] - 110,
              width: 140,
              display: "flex",
              justifyContent: "center",
              opacity: markIn,
            }}
          >
            <Pill accent={COLORS.sage} size={36}>
              今日
            </Pill>
          </div>
        ) : null}
      </div>
      <Reveal delay={6} style={{ fontSize: TYPE.body, fontWeight: 700, color: COLORS.textSub, textAlign: "right" }}>
        {v.xLabel} →
      </Reveal>
    </div>
  );
};

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------

const F = { w: HALF, h: 600, cx: HALF / 2, top: 170, bottom: 400 };

/** Half-width of the brewer's inside at height y. */
function innerHalf(shape: FlowBrewer["shape"], y: number): number {
  const topHalf = 150;
  const bottomHalf = shape === "flat" ? 72 : 24;
  const t = (y - F.top) / (F.bottom - F.top);
  return topHalf - (topHalf - bottomHalf) * t;
}

// Deterministic grain speckles for the coffee bed.
const SPECKLES = Array.from({ length: 26 }, (_, i) => ({
  fx: ((i * 37) % 100) / 100,
  fy: ((i * 61) % 100) / 100,
  r: 3 + (i % 3),
}));

const Percolation: React.FC<{ b: FlowBrewer; delay: number }> = ({ b, delay }) => {
  const frame = useCurrentFrame();
  const { cx } = F;
  const uneven = b.bed === "uneven";
  const bedL = uneven ? 278 : 300;
  const bedR = uneven ? 334 : 300;
  const bedBottom = F.bottom - 4;
  const hw = (y: number) => innerHalf(b.shape, y) - 6;
  const outline =
    b.shape === "flat"
      ? `M${cx - 150} ${F.top} L${cx + 150} ${F.top} L${cx + 72} ${F.bottom} L${cx - 72} ${F.bottom} Z`
      : `M${cx - 150} ${F.top} L${cx + 150} ${F.top} L${cx + 24} ${F.bottom} L${cx - 24} ${F.bottom} Z`;
  const bed = `M${cx - hw(bedL)} ${bedL} L${cx + hw(bedR)} ${bedR} L${cx + hw(bedBottom)} ${bedBottom} L${cx - hw(bedBottom)} ${bedBottom} Z`;
  // Slow pouring keeps a taller water column over the bed; fast drains through.
  const waterTop = interpolate(progress(frame, delay + 4, delay + 30), [0, 1], [bedL, b.speed === "slow" ? 226 : b.speed === "fast" ? 270 : 246]);
  const water = `M${cx - hw(waterTop)} ${waterTop} L${cx + hw(waterTop)} ${waterTop} L${cx + hw(bedR)} ${bedR} L${cx - hw(bedL)} ${bedL} Z`;
  const period = b.speed === "fast" ? 14 : b.speed === "slow" ? 32 : 22;
  const outlets = b.shape === "flat" ? [-34, 0, 34] : [0];
  const started = frame >= delay + 10;
  // Channelling on an uneven bed: the water rushes down the low side.
  const arrowXs = uneven ? [18, 44, 70] : [-50, 0, 50];
  const server = progress(frame, delay + 10, delay + 120);

  return (
    <>
      <path d={outline} fill="rgba(255,255,255,0.035)" />
      <path d={water} fill={WATER} opacity={progress(frame, delay + 2, delay + 10)} />
      <path d={bed} fill={GROUNDS} />
      {SPECKLES.map((s, i) => {
        const y = bedL + (bedBottom - bedL) * (0.15 + 0.75 * s.fy);
        const x = cx + (s.fx * 2 - 1) * (hw(y) - 12);
        return <circle key={i} cx={x} cy={y} r={s.r} fill={GROUNDS_DARK} />;
      })}
      {started
        ? arrowXs.map((ax, i) => {
            const t = ((frame - delay + i * (period / 3)) % period) / period;
            const top = Math.max(bedL, bedR) - 30;
            const y = top + (bedBottom - top - 20) * t;
            const x = cx + ax * (1 - (y - F.top) / (F.bottom - F.top) * 0.6);
            return (
              <path
                key={i}
                d={`M${x - 12} ${y - 10} L${x} ${y + 2} L${x + 12} ${y - 10}`}
                stroke={COLORS.caramel}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={interpolate(t, [0, 0.2, 0.8, 1], [0, 1, 1, 0])}
              />
            );
          })
        : null}
      <path d={outline} fill="none" stroke={COLORS.terracotta} strokeWidth={8} strokeLinejoin="round" />
      {started
        ? outlets.flatMap((ox, oi) =>
            [0, 0.5].map((phase) => {
              const t = (((frame - delay) / period + phase + oi * 0.33) % 1 + 1) % 1;
              return <circle key={`${oi}-${phase}`} cx={cx + ox} cy={F.bottom + 8 + 70 * t} r={7} fill={BREW[2]} opacity={interpolate(t, [0, 0.1, 0.85, 1], [0, 1, 1, 0])} />;
            })
          )
        : null}
      {/* server */}
      <clipPath id={`server-${delay}`}>
        <rect x={cx - 104} y={484} width={208} height={96} rx={22} />
      </clipPath>
      <rect x={cx - 104} y={580 - 90 * server * 0.55} width={208} height={96} fill={BREW[2]} clipPath={`url(#server-${delay})`} />
      <rect x={cx - 110} y={478} width={220} height={108} rx={26} fill="none" stroke={COLORS.sky} strokeWidth={7} />
    </>
  );
};

const Immersion: React.FC<{ b: FlowBrewer; delay: number }> = ({ b, delay }) => {
  const frame = useCurrentFrame();
  const { cx } = F;
  const steep = progress(frame, delay + 6, delay + 90);
  const fillIn = progress(frame, delay + 4, delay + 28);
  const waterTop = interpolate(fillIn, [0, 1], [556, 200]);
  return (
    <>
      <clipPath id={`vessel-${delay}`}>
        <rect x={cx - 124} y={156} width={248} height={404} rx={30} />
      </clipPath>
      <g clipPath={`url(#vessel-${delay})`}>
        <rect x={cx - 130} y={waterTop} width={260} height={420} fill={WATER} />
        <rect x={cx - 130} y={waterTop} width={260} height={420} fill={BREW[1]} opacity={0.15 + 0.5 * steep} />
        {Array.from({ length: 16 }, (_, i) => {
          const phase = (i * 2.3) % (Math.PI * 2);
          const baseY = 250 + ((i * 53) % 280);
          const x = cx + Math.sin(frame / 26 + phase) * (40 + ((i * 29) % 70));
          const y = Math.max(waterTop + 16, baseY + Math.cos(frame / 34 + phase) * 26);
          return <circle key={i} cx={x} cy={y} r={7 + (i % 3) * 2} fill={GROUNDS} opacity={fillIn} />;
        })}
      </g>
      <rect x={cx - 130} y={150} width={260} height={416} rx={34} fill="none" stroke={COLORS.terracotta} strokeWidth={8} />
    </>
  );
};

const Brewer: React.FC<{ b: FlowBrewer; delay: number; width: number }> = ({ b, delay, width }) => {
  const frame = useCurrentFrame();
  const { cx } = F;
  const immersion = b.shape === "immersion";
  // Kettle spout + stream. Immersion pours everything at once and stops.
  const spoutY = b.height === "high" ? 16 : b.height === "low" ? 160 : 64;
  const swing = b.pour === "wide" ? Math.sin(frame / 7) * 76 : 0;
  const streamOn = immersion ? interpolate(frame, [delay, delay + 4, delay + 30, delay + 36], [0, 1, 1, 0], clampOpts) : progress(frame, delay, delay + 6);
  const surface = immersion ? 200 : 250;
  const thick = b.speed === "fast" ? 16 : b.speed === "slow" ? 6 : 10;
  // Agitation: a high pour churns a ring of ripples where it lands.
  const ripple = b.height === "high" ? ((frame - delay) % 18) / 18 : null;
  return (
    <div style={{ width, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={F.w} height={F.h} viewBox={`0 0 ${F.w} ${F.h}`}>
        {immersion ? <Immersion b={b} delay={delay} /> : <Percolation b={b} delay={delay} />}
        <line
          x1={cx + swing * 0.3}
          y1={spoutY + 6}
          x2={cx + swing}
          y2={surface}
          stroke={STREAM}
          strokeWidth={thick}
          strokeLinecap="round"
          opacity={streamOn}
        />
        {ripple != null && frame > delay + 8 ? (
          <ellipse
            cx={cx + swing}
            cy={surface + 4}
            rx={20 + 70 * ripple}
            ry={6 + 16 * ripple}
            fill="none"
            stroke={STREAM}
            strokeWidth={4}
            opacity={(1 - ripple) * streamOn}
          />
        ) : null}
        <path
          d={`M${cx + 96 + swing * 0.3} ${spoutY - 34} L${cx + 6 + swing * 0.3} ${spoutY + 6}`}
          stroke={COLORS.sky}
          strokeWidth={22}
          strokeLinecap="round"
          opacity={immersion ? Math.max(streamOn, 0) : progress(frame, delay - 2, delay + 4)}
        />
      </svg>
      <Reveal delay={delay + 6}>
        <Pill accent={immersion ? COLORS.sage : COLORS.caramel} size={44}>
          {b.label}
        </Pill>
      </Reveal>
      <Reveal delay={delay + 12} style={{ marginTop: 20, fontSize: TYPE.body, fontWeight: 700, textAlign: "center", lineHeight: 1.35, ...PHRASE_BREAK }}>
        {b.note}
      </Reveal>
    </div>
  );
};

const FlowDiagram: React.FC<{ v: Extract<LessonVisual, { type: "flow" }> }> = ({ v }) => (
  <div style={{ display: "flex", gap: HALF_GAP, width: WIDTH, justifyContent: "center" }}>
    {v.brewers.map((b, i) => (
      <Brewer key={`${b.label}-${i}`} b={b} delay={2 + i * 8} width={HALF} />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// scale — a gauge without numbers (owner decision 2026-09-26): named zones of
// equal width, the needle moving from the usual spot to today's (0-100).
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<number, string[]> = {
  2: [COLORS.sky, COLORS.terracotta],
  3: [COLORS.sky, COLORS.sage, COLORS.terracotta],
};

const ScaleDiagram: React.FC<{ v: Extract<LessonVisual, { type: "scale" }> }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = (n: number) => (n / 100) * WIDTH;
  const from = v.from ?? v.to;
  const move = spring({ frame: Math.max(0, frame - 14), fps, config: { damping: 16, stiffness: 70 } });
  const current = from + (v.to - from) * Math.min(1, move);
  const needleX = x(current);
  const colors = ZONE_COLORS[v.zones.length] ?? ZONE_COLORS[3];
  const zoneW = WIDTH / v.zones.length;
  const zoneAt = (n: number) => v.zones[Math.min(v.zones.length - 1, Math.floor((n / 100) * v.zones.length))];
  const barIn = progress(frame, 4, 16);
  const BAR_Y = 210;
  const BAR_H = 52;

  return (
    <div style={{ width: WIDTH }}>
      <Reveal delay={2}>
        <Pill accent={COLORS.caramel} size={44}>
          {v.label}
        </Pill>
      </Reveal>
      <Reveal delay={6} style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 28, whiteSpace: "nowrap" }}>
        {v.from != null && zoneAt(v.from) !== zoneAt(v.to) ? (
          <>
            <span style={{ fontSize: 64, fontWeight: 800, color: COLORS.textMuted }}>{zoneAt(v.from)}</span>
            <svg width={72} height={48} viewBox="0 0 72 48">
              <path d="M6 24 H60 M44 8 L62 24 L44 40" stroke={COLORS.caramel} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : null}
        <span style={{ fontSize: 96, fontWeight: 900 }}>{zoneAt(v.to)}</span>
      </Reveal>
      <div style={{ position: "relative", width: WIDTH, height: BAR_Y + BAR_H + 140, marginTop: 40 }}>
        <div style={{ position: "absolute", left: 0, top: BAR_Y, width: WIDTH * barIn, height: BAR_H, borderRadius: BAR_H / 2, overflow: "hidden", display: "flex" }}>
          {v.zones.map((z, i) => (
            <div key={z} style={{ flex: `0 0 ${zoneW}px`, background: colors[i], opacity: 0.85 }} />
          ))}
        </div>
        {v.from != null ? (
          <div
            style={{
              position: "absolute",
              left: x(v.from) - 22,
              top: BAR_Y + BAR_H / 2 - 22,
              width: 44,
              height: 44,
              borderRadius: 22,
              border: `6px solid ${COLORS.text}`,
              boxSizing: "border-box",
              opacity: 0.7 * barIn,
            }}
          />
        ) : null}
        <div style={{ position: "absolute", left: needleX - 5, top: 60, width: 10, height: BAR_Y - 60 + BAR_H + 26, borderRadius: 5, background: COLORS.caramel, boxShadow: "0 0 0 3px rgba(26,14,8,0.9)", opacity: barIn }} />
        {v.zones.map((z, i) => (
          <div
            key={z}
            style={{
              position: "absolute",
              left: i * zoneW,
              width: zoneW,
              top: BAR_Y + BAR_H + 40,
              textAlign: "center",
              fontSize: TYPE.body,
              fontWeight: 800,
              whiteSpace: "nowrap",
              opacity: progress(frame, 10 + i * 3, 20 + i * 3),
            }}
          >
            {z}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// the slide
// ---------------------------------------------------------------------------

const DiagramBody: React.FC<{ v: LessonVisual }> = ({ v }) => {
  switch (v.type) {
    case "compare":
      return <CompareDiagram v={v} />;
    case "graph":
      return <GraphDiagram v={v} />;
    case "flow":
      return <FlowDiagram v={v} />;
    case "scale":
      return <ScaleDiagram v={v} />;
    default:
      return null;
  }
};

export const LessonVisualView: React.FC<{ slide: LessonVisualSlide; page: string; index?: number }> = ({ slide, page, index = 0 }) => (
  <SlideShell label={slide.heading} right={page} center index={index}>
    <div style={{ paddingRight: SPACE.actionColumnClearance }}>
      <DiagramBody v={slide.visual} />
      <Reveal delay={30} style={{ marginTop: 64 }}>
        <AccentLine size={52}>{slide.visual.caption}</AccentLine>
      </Reveal>
    </div>
  </SlideShell>
);
