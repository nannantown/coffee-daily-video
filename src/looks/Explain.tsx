import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, PHRASE_BREAK } from "../cards/theme";

/**
 * Motion samples for the explanation scene (owner, 2026-09-26: "説明は文章だけ
 * で、イラストにはアニメーションつけれない？"). Same episode (湯温を下げる) in
 * the two looks the owner liked:
 *
 *   lab   — the pencil drawing is revealed as if drawn, steam wisps rise, the
 *           poured water flows, ripples spread; above it a cause → taste chain
 *           is drawn stroke by stroke: the thermometer drops, arrows grow,
 *           the result arrows point down (苦味) and up (酸味).
 *   photo — the photo pushes in and drifts (camera move), window light breathes,
 *           soft steam rises from the spout, a highlight runs down the stream;
 *           the same chain is drawn over the photo in thin white / amber lines.
 *
 * Coordinates of the spout / stream / steam were measured on the plates
 * (public/looks/lab-kettle.png, photo-kettle.png, scaled to 1080x1920).
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.inOut(Easing.cubic);
const prog = (f: number, a: number, b: number, ease = easeOut) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });

const text = (size: number, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: size >= 64 ? 1.35 : 1.45,
  letterSpacing: "0.03em",
  fontFeatureSettings: '"palt"',
  ...PHRASE_BREAK,
  ...extra,
});

const Fade: React.FC<{ at: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, style, children }) => {
  const p = prog(useCurrentFrame(), at, at + 18);
  return <div style={{ position: "absolute", opacity: p, transform: `translateY(${(1 - p) * 20}px)`, ...style }}>{children}</div>;
};

interface Ink {
  line: string; // strokes of the chain
  text: string;
  sub: string;
  accent: string; // the thing that changes (mercury, 苦味)
  glass: string; // thermometer tube fill
  shadow?: string;
}

/** A stroke that draws itself between frames a and b. */
const Draw: React.FC<{ d: string; a: number; b: number; color: string; width?: number; fill?: string }> = ({ d, a, b, color, width = 4, fill = "none" }) => {
  const p = prog(useCurrentFrame(), a, b, inOut);
  return <path d={d} fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />;
};

/**
 * 温度を下げる → 苦味の成分が溶けにくい → 苦味↓ 酸味↑, drawn left to right in
 * the band y 500-900. Thermometer: its outline draws, then the mercury falls.
 */
const Chain: React.FC<{ ink: Ink }> = ({ ink }) => {
  const f = useCurrentFrame();
  const mercury = interpolate(f, [34, 84], [0.86, 0.34], { ...clamp, easing: inOut });
  const tubeTop = 40;
  const tubeBottom = 250;
  const mercuryTop = tubeBottom - (tubeBottom - tubeTop) * mercury;
  const shadow = ink.shadow ? { filter: `drop-shadow(0 2px 6px ${ink.shadow})` } : {};
  return (
    <div style={{ position: "absolute", top: 500, left: 0, width: 1080, height: 420, ...shadow }}>
      <svg width={1080} height={420} viewBox="0 0 1080 420" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* thermometer */}
        <Draw d={`M130 ${tubeTop + 16} a16 16 0 0 1 32 0 V${tubeBottom} a36 36 0 1 1 -32 0 Z`} a={0} b={30} color={ink.line} width={4} />
        <rect x={138} y={mercuryTop} width={16} height={tubeBottom - mercuryTop + 20} rx={8} fill={ink.accent} opacity={prog(f, 20, 34)} />
        <circle cx={146} cy={tubeBottom + 30} r={24} fill={ink.accent} opacity={prog(f, 20, 34)} />
        {[0.25, 0.5, 0.75].map((k, i) => (
          <Draw key={k} d={`M176 ${tubeBottom - (tubeBottom - tubeTop) * k} h22`} a={12 + i * 4} b={26 + i * 4} color={ink.line} width={3} />
        ))}
        {/* falling arrow beside the tube */}
        <Draw d="M226 90 V210 M206 186 L226 212 L246 186" a={70} b={96} color={ink.accent} width={5} />
        {/* arrow 1 */}
        <Draw d="M290 160 H392 M372 140 L394 160 L372 180" a={92} b={112} color={ink.line} width={4} />
        {/* arrow 2 */}
        <Draw d="M700 160 H772 M752 140 L774 160 L752 180" a={128} b={146} color={ink.line} width={4} />
        {/* result arrows */}
        <Draw d="M826 96 V150 M810 132 L826 152 L842 132" a={150} b={166} color={ink.accent} width={5} />
        <Draw d="M826 290 V236 M810 254 L826 234 L842 254" a={160} b={176} color={ink.line} width={5} />
      </svg>
      <Fade at={40} style={{ top: 330, left: 96, width: 200, ...text(40, 500, ink.sub) }}>
        温度を下げる
      </Fade>
      <Fade at={104} style={{ top: 96, left: 420, width: 270, ...text(48, 700, ink.text) }}>
        苦味の成分が溶けにくい
      </Fade>
      <Fade at={150} style={{ top: 88, left: 860, ...text(48, 700, ink.accent) }}>
        苦味
      </Fade>
      <Fade at={160} style={{ top: 226, left: 860, ...text(48, 700, ink.text) }}>
        酸味
      </Fade>
    </div>
  );
};

const Header: React.FC<{ sub: string; head: string }> = ({ sub, head }) => (
  <>
    <Fade at={0} style={{ top: 300, left: 96, ...text(40, 500, sub) }}>
      なぜ変わる？
    </Fade>
    <Fade at={4} style={{ top: 370, left: 96, right: 96, ...text(64, 700, head) }}>
      お湯の温度を下げると
    </Fade>
  </>
);

// ---------------------------------------------------------------------------
// lab
// ---------------------------------------------------------------------------

const PAPER = "#F3F0EA";
const INK = "#22201C";
const TERRACOTTA = "#B5563A";

/** Steam wisps: wavy strokes that rise, sway and fade, in a loop. */
const Steam: React.FC<{ x: number; y: number; color: string; width: number; blur?: number; spread?: number; height?: number }> = ({ x, y, color, width, blur = 0, spread = 70, height = 300 }) => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {blur ? (
        <defs>
          <filter id={`b${blur}`} filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
      ) : null}
      {[0, 1, 2].map((i) => {
        const t = ((f + i * 34) % 100) / 100; // 0..1 life of one wisp
        const sway = Math.sin((f + i * 20) / 14) * 16;
        const x0 = x + (i - 1) * spread * 0.5 + sway;
        const y0 = y - t * height;
        const d = `M${x0} ${y0} c 24 -40 -24 -80 0 -120 s -24 -80 0 -120`;
        const o = Math.sin(t * Math.PI) * 0.8;
        return <path key={i} d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={o} filter={blur ? `url(#b${blur})` : undefined} />;
      })}
    </svg>
  );
};

/** Water flowing along the stream: short dashes that travel down the path. */
const Flow: React.FC<{ d: string; color: string; width: number; dash: string; speed: number; blur?: number }> = ({ d, color, width, dash, speed, blur }) => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, filter: blur ? `blur(${blur}px)` : undefined }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={-f * speed} />
    </svg>
  );
};

const Ripples: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {[0, 1, 2].map((i) => {
        const t = ((f + i * 20) % 60) / 60;
        return <ellipse key={i} cx={x} cy={y} rx={20 + t * 150} ry={5 + t * 30} fill="none" stroke={color} strokeWidth={2.5} opacity={(1 - t) * 0.7} />;
      })}
    </svg>
  );
};

export const ExplainLab: React.FC = () => {
  const f = useCurrentFrame();
  // "being drawn": a soft diagonal wipe uncovers the pencil plate
  const reveal = interpolate(f, [0, 45], [-30, 130], { ...clamp, easing: inOut });
  const mask = `linear-gradient(160deg, #000 ${reveal - 25}%, transparent ${reveal}%)`;
  return (
    <AbsoluteFill lang="ja" style={{ background: PAPER, fontFamily: FONT_FAMILY }}>
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <Img src={staticFile("looks/lab-kettle.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: prog(f, 40, 60) }}>
        <Steam x={360} y={1290} color="rgba(181,86,58,0.55)" width={4} />
        <Flow d="M478 1102 C 452 1180 418 1300 412 1486" color="rgba(90,120,140,0.75)" width={4} dash="10 26" speed={3.2} />
        <Ripples x={402} y={1492} color="rgba(181,86,58,0.7)" />
      </AbsoluteFill>
      <Header sub="#6B655C" head={INK} />
      <Chain ink={{ line: INK, text: INK, sub: "#6B655C", accent: TERRACOTTA, glass: PAPER }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// photo
// ---------------------------------------------------------------------------

const AMBER = "#E3B37A";

export const ExplainPhoto: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [0, 195], [1.06, 1.16]);
  const pan = interpolate(f, [0, 195], [10, -40]);
  const glow = 0.18 + 0.1 * Math.sin(f / 22);
  return (
    <AbsoluteFill lang="ja" style={{ background: "#1C1511", fontFamily: FONT_FAMILY, overflow: "hidden" }}>
      {/* camera: slow push-in and drift; the overlays ride the same transform so they stay on the spout */}
      <AbsoluteFill style={{ transform: `translateX(${pan}px) scale(${zoom})`, transformOrigin: "62% 60%" }}>
        <Img src={staticFile("looks/photo-kettle.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <Steam x={690} y={1080} color="rgba(255,248,238,0.5)" width={22} blur={9} spread={90} height={380} />
        <Flow d="M690 1092 C 720 1180 780 1330 868 1680" color="rgba(255,236,200,0.95)" width={3} dash="18 90" speed={6} blur={0.8} />
      </AbsoluteFill>
      {/* window light breathing from the upper right */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 88% 22%, rgba(255,190,120,${glow}) 0%, rgba(255,190,120,0) 55%)`, mixBlendMode: "screen" }} />
      {/* keep the text legible */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(20,16,12,0.78) 0%, rgba(20,16,12,0.55) 42%, rgba(20,16,12,0) 58%)" }} />
      <Header sub="rgba(255,255,255,0.78)" head="#FFFFFF" />
      <Chain ink={{ line: "rgba(255,255,255,0.92)", text: "#FFFFFF", sub: "rgba(255,255,255,0.8)", accent: AMBER, glass: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.45)" }} />
    </AbsoluteFill>
  );
};

export const EXPLAIN_FRAMES = 195;

export const ExplainPreview: React.FC<{ look: "lab" | "photo" }> = ({ look }) => (look === "lab" ? <ExplainLab /> : <ExplainPhoto />);
