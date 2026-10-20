import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { FONT_FAMILY } from "../cards/theme";
import { coffeeColor } from "./Motion";
import { SCENE_ART, artText, artTextBox } from "./safe-layout.mjs";

/**
 * The drawings of a script episode's scenes (lesson.script, owner 2026-10-20),
 * redrawn in code from the Codex reference frames (docs/previews/ref/soft-water-*.jpg):
 * graphite lines roughened by a displacement filter, light hatching, one accent
 * colour. Each drawing is laid out on its own design size (SCENE_ART, the viewBox)
 * and the scene gives it a box (safe-layout.mjs sceneLayout). Labels inside a
 * drawing are set in the gothic face like every other text.
 */

const INK = "#22201C";
const GREY = "#6B655C";
const PAPER = "#F3F0EA";
const WATER = "rgba(120,160,175,0.16)";
const AMBER = "#D9963E";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const prog = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });

/** Deterministic scatter (same grains every frame and every render). */
const scatter = (seed: number, n: number) => {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: n }, () => [r(), r(), r()] as const);
};

const Defs: React.FC<{ id: string; accent: string }> = ({ id, accent }) => (
  <defs>
    <filter id={`${id}-rough`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={7} />
      <feDisplacementMap in="SourceGraphic" scale={3} />
    </filter>
    <pattern id={`${id}-hatch`} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1={0} y1={0} x2={0} y2={10} stroke={GREY} strokeWidth={1.6} opacity={0.55} />
    </pattern>
    <pattern id={`${id}-hatch-ink`} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1={0} y1={0} x2={0} y2={9} stroke={GREY} strokeWidth={2.5} />
    </pattern>
    <pattern id={`${id}-hatch-accent`} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1={0} y1={0} x2={0} y2={9} stroke={accent} strokeWidth={3} />
    </pattern>
  </defs>
);

/** The table line and a hatched contact shadow under the objects. */
const Table: React.FC<{ id: string; y: number; x0?: number; x1?: number }> = ({ id, y, x0 = 20, x1 = 980 }) => (
  <g>
    <path d={`M${x0} ${y} L${x1} ${y}`} stroke={GREY} strokeWidth={2} opacity={0.6} />
    <rect x={x0 + 40} y={y + 6} width={x1 - x0 - 80} height={26} fill={`url(#${id}-hatch)`} opacity={0.5} />
  </g>
);

/** A tumbler of water: rim, glass walls, the water and its grains. Grains bob a little. */
const Glass: React.FC<{
  id: string;
  cx: number;
  top: number;
  w: number;
  h: number;
  grains?: number;
  seed?: number;
  accent: string;
  appear?: number;
}> = ({ id, cx, top, w, h, grains = 0, seed = 3, accent, appear = 0 }) => {
  const f = useCurrentFrame();
  const wb = w * 0.84;
  const bottom = top + h;
  const level = top + h * 0.2;
  const xAt = (y: number, side: -1 | 1) => cx + side * (w / 2 - ((w - wb) / 2) * ((y - top) / h));
  const ry = w * 0.06;
  const pts = scatter(seed, grains);
  const shown = prog(f, appear, appear + 20);
  return (
    <g opacity={shown}>
      <path d={`M${xAt(level, -1)} ${level} L${xAt(bottom, -1)} ${bottom - 10} Q${cx} ${bottom + ry} ${xAt(bottom, 1)} ${bottom - 10} L${xAt(level, 1)} ${level} Z`} fill={WATER} />
      <g filter={`url(#${id}-rough)`} fill="none" strokeLinecap="round">
        <ellipse cx={cx} cy={top} rx={w / 2} ry={ry} stroke={INK} strokeWidth={3.5} />
        <path d={`M${cx - w / 2} ${top} L${xAt(bottom, -1)} ${bottom - 10} Q${cx} ${bottom + ry} ${xAt(bottom, 1)} ${bottom - 10} L${cx + w / 2} ${top}`} stroke={INK} strokeWidth={3.5} />
        <ellipse cx={cx} cy={level} rx={xAt(level, 1) - cx} ry={ry * 0.8} stroke={GREY} strokeWidth={2.5} />
        <path d={`M${xAt(bottom - 40, -1) + 6} ${bottom - 40} Q${cx} ${bottom - 40 + ry} ${xAt(bottom - 40, 1) - 6} ${bottom - 40}`} stroke={GREY} strokeWidth={2.5} />
        <path d={`M${cx - w / 2 + 26} ${top + 30} L${cx - w / 2 + 40} ${bottom - 60}`} stroke={GREY} strokeWidth={2} opacity={0.45} />
        <path d={`M${cx + w / 2 - 34} ${top + 40} L${cx + w / 2 - 44} ${bottom - 70}`} stroke={GREY} strokeWidth={2} opacity={0.3} />
      </g>
      {pts.map(([a, b, c], i) => {
        const y = level + 26 + b * (bottom - level - 80);
        const half = xAt(y, 1) - cx - 26;
        const x = cx + (a * 2 - 1) * half;
        const r = 6 + c * 6;
        return <circle key={i} cx={x} cy={y + Math.sin(f / 18 + i) * 3} r={r} fill={accent} fillOpacity={0.35 + c * 0.3} stroke={INK} strokeWidth={1.5} strokeOpacity={0.7} />;
      })}
    </g>
  );
};

/** A glass coffee mug with the coffee at `shade` (0 light amber → 100 near black). */
const Mug: React.FC<{ id: string; cx: number; top: number; w: number; h: number; shade: number; appear?: number }> = ({ id, cx, top, w, h, shade, appear = 0 }) => {
  const f = useCurrentFrame();
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const body = `M${x0} ${top} L${x0 + 10} ${top + h * 0.72} Q${cx} ${top + h + 16} ${x1 - 10} ${top + h * 0.72} L${x1} ${top}`;
  const fill = prog(f, appear + 6, appear + 40);
  const level = top + h * (0.95 - 0.7 * fill);
  return (
    <g opacity={prog(f, appear, appear + 20)}>
      <clipPath id={`${id}-mug-${cx}`}>
        <path d={`${body} Z`} />
      </clipPath>
      <rect x={x0} y={level} width={w} height={h + 20} fill={coffeeColor(shade)} opacity={0.92} clipPath={`url(#${id}-mug-${cx})`} />
      <g filter={`url(#${id}-rough)`} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round">
        <ellipse cx={cx} cy={top} rx={w / 2} ry={w * 0.07} />
        <path d={body} />
        <path d={`M${x1 - 4} ${top + h * 0.18} C ${x1 + w * 0.32} ${top + h * 0.12}, ${x1 + w * 0.3} ${top + h * 0.66}, ${x1 - 16} ${top + h * 0.64}`} />
        <path d={`M${x1 - 8} ${top + h * 0.28} C ${x1 + w * 0.18} ${top + h * 0.26}, ${x1 + w * 0.17} ${top + h * 0.54}, ${x1 - 18} ${top + h * 0.54}`} stroke={GREY} strokeWidth={2.5} />
      </g>
    </g>
  );
};

// ---------------------------------------------------------------------------
// the drawings
// ---------------------------------------------------------------------------

type ArtProps = { id: string; accent: string };

/** Cover: a big pale 水 behind two identical glasses — nothing says which is which yet. */
const Glasses: React.FC<ArtProps> = ({ id, accent }) => {
  const f = useCurrentFrame();
  return (
    <>
      <text x={500} y={540} textAnchor="middle" fontSize={600} fontWeight={700} fontFamily={FONT_FAMILY} fill="#E3DCCF" stroke={GREY} strokeWidth={2} strokeOpacity={0.35} opacity={prog(f, 0, 30)} filter={`url(#${id}-rough)`}>
        水
      </text>
      <Glass id={id} cx={300} top={440} w={270} h={320} accent={accent} appear={6} />
      <Glass id={id} cx={700} top={440} w={270} h={320} accent={accent} appear={12} />
      <Table id={id} y={782} />
    </>
  );
};

/** A word drawn inside a picture, placed by SCENE_ART (safe-layout.mjs checks where it lands). */
const Word: React.FC<{ name: keyof typeof SCENE_ART; k: string; fill: string; opacity?: number; dy?: number }> = ({ name, k, fill, opacity = 1, dy = 0 }) => {
  const t = artText(name, k);
  return (
    <text x={t.cx} y={t.cy + dy} textAnchor="middle" dominantBaseline="central" fontSize={t.size} fontWeight={700} fill={fill} fontFamily={FONT_FAMILY} opacity={opacity}>
      {t.label}
    </text>
  );
};

/** Few grains (soft) vs many grains (hard); a few grains carry the Ca / Mg mark; each glass is named under it. */
const Minerals: React.FC<ArtProps> = ({ id, accent }) => {
  const f = useCurrentFrame();
  const marks: [string, string, number][] = [
    ["soft-ca", accent, 0],
    ["hard-ca1", accent, 10],
    ["hard-mg", GREY, 10],
    ["hard-ca2", accent, 10],
  ];
  return (
    <>
      <Glass id={id} cx={265} top={20} w={330} h={400} grains={4} seed={11} accent={accent} />
      <Glass id={id} cx={735} top={20} w={330} h={400} grains={46} seed={29} accent={accent} appear={10} />
      {marks.map(([k, color, at], i) => {
        const t = artText("minerals", k);
        const bob = Math.sin(f / 22 + i) * 3;
        return (
          <g key={k} opacity={prog(f, at + 8, at + 26)}>
            <circle cx={t.cx} cy={t.cy + bob} r={t.size * 0.85} fill={PAPER} stroke={color} strokeWidth={4} />
            <Word name="minerals" k={k} fill={color} dy={bob} />
          </g>
        );
      })}
      <Table id={id} y={445} />
      <Word name="minerals" k="soft-name" fill={INK} opacity={prog(f, 4, 20)} />
      <Word name="minerals" k="hard-name" fill={INK} opacity={prog(f, 14, 30)} />
    </>
  );
};

/** A legend entry: a grain, then the word it stands for (the word is placed by SCENE_ART). */
const Key: React.FC<{ k: string; color: string; at: number }> = ({ k, color, at }) => {
  const f = useCurrentFrame();
  const t = artText("acid", k);
  const b = artTextBox(t);
  return (
    <g opacity={prog(f, at, at + 16)}>
      <circle cx={b.left - 28} cy={t.cy} r={16} fill={color} fillOpacity={0.9} stroke={INK} strokeWidth={1.5} />
      <Word name="acid" k={k} fill={INK} />
    </g>
  );
};

/** Hard water: acid grains (amber) meet the grains that cancel them (accent) and fade; a baking-soda pouch beside. */
const Acid: React.FC<ArtProps> = ({ id, accent }) => {
  const f = useCurrentFrame();
  const pairs = scatter(41, 7);
  const cx = 340;
  return (
    <>
      <Key k="acid" color={AMBER} at={0} />
      <Key k="base" color={accent} at={6} />
      <Glass id={id} cx={cx} top={130} w={440} h={420} accent={accent} />
      {pairs.map(([a, b], i) => {
        const x = cx + (a * 2 - 1) * 130;
        const y = 250 + b * 220;
        const t = prog(f, 24 + i * 6, 54 + i * 6);
        const gone = i < 5; // most of the acid is cancelled; a little stays
        return (
          <g key={i}>
            <circle cx={x - 30 + 22 * t} cy={y} r={15} fill={AMBER} fillOpacity={gone ? 0.9 * (1 - t) : 0.9} stroke={AMBER} strokeWidth={2.5} strokeDasharray={gone && t > 0.5 ? "4 5" : undefined} />
            <circle cx={x + 30 - 6 * t} cy={y} r={15} fill={accent} fillOpacity={0.85} stroke={INK} strokeWidth={1.5} />
            {gone ? <path d={`M${x - 14} ${y - 30} q 12 -12 24 0`} stroke={GREY} strokeWidth={2.5} fill="none" opacity={t} /> : null}
          </g>
        );
      })}
      {/* the pouch */}
      <g filter={`url(#${id}-rough)`} opacity={prog(f, 10, 30)}>
        <path d="M700 300 L900 300 L915 560 L690 560 Z" fill="#FBF9F4" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <path d="M700 300 L712 272 L888 272 L900 300" fill="none" stroke={INK} strokeWidth={3} />
        <rect x={706} y={420} width={196} height={130} fill={`url(#${id}-hatch)`} opacity={0.4} />
        <path d="M630 568 q 40 -46 90 -40 q 40 -4 70 40 Z" fill="#FFFFFF" stroke={GREY} strokeWidth={2} />
      </g>
      <Word name="acid" k="soda" fill={INK} opacity={prog(f, 14, 32)} />
      <Table id={id} y={576} />
    </>
  );
};

/**
 * Left 硬水: many grains → a dark cup; its 酸味 meter drops and its 苦み meter stands out.
 * Right 軟水: few grains → a light cup; its 酸味 meter stays, its 苦み meter stays low.
 */
const Compare: React.FC<ArtProps> = ({ id, accent }) => {
  const f = useCurrentFrame();
  const Meter: React.FC<{ k: string; to: number; at: number; strong?: boolean }> = ({ k, to, at, strong }) => {
    const p = interpolate(f, [at + 20, at + 60], [0.55, to], { ...clamp, easing: ease });
    const t = artText("compare", k);
    return (
      <g opacity={prog(f, at + 16, at + 30)}>
        <Word name="compare" k={k} fill={strong ? accent : INK} />
        <rect x={t.cx - 25} y={430 + 180 * (1 - p)} width={50} height={180 * p} fill={`url(#${id}-hatch-${strong ? "accent" : "ink"})`} />
        <rect x={t.cx - 25} y={430} width={50} height={180} fill="none" stroke={strong ? accent : INK} strokeWidth={strong ? 5 : 3} filter={`url(#${id}-rough)`} />
      </g>
    );
  };
  const Half: React.FC<{ x0: number; name: string; grains: number; seed: number; shade: number; at: number; children: React.ReactNode }> = ({ x0, name, grains, seed, shade, at, children }) => (
    <g>
      <Word name="compare" k={name} fill={INK} opacity={prog(f, at, at + 16)} />
      <Glass id={id} cx={x0 + 330} top={110} w={190} h={210} grains={grains} seed={seed} accent={accent} appear={at} />
      <path d={`M${x0 + 330} 338 L${x0 + 330} 390 M${x0 + 316} 376 L${x0 + 330} 392 L${x0 + 344} 376`} stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" opacity={prog(f, at + 8, at + 20)} />
      <Mug id={id} cx={x0 + 320} top={430} w={200} h={170} shade={shade} appear={at + 10} />
      <Table id={id} y={630} x0={x0 + 10} x1={x0 + 480} />
      {children}
    </g>
  );
  return (
    <>
      <path d="M500 20 L500 640" stroke={GREY} strokeWidth={2} opacity={0.4} />
      <Half x0={0} name="hard-name" grains={22} seed={5} shade={88} at={0}>
        <Meter k="hard-acid" to={0.18} at={0} />
        <Meter k="hard-bitter" to={0.9} at={6} strong />
      </Half>
      <Half x0={510} name="soft-name" grains={3} seed={17} shade={22} at={8}>
        <Meter k="soft-acid" to={0.88} at={8} strong />
        <Meter k="soft-bitter" to={0.25} at={14} />
      </Half>
    </>
  );
};

/** Which is yours: the tap's glass (soft), two cups to compare, an imported bottle whose label shows 硬度 big (hard). */
const Which: React.FC<ArtProps> = ({ id, accent }) => {
  const f = useCurrentFrame();
  const stream = (f * 3) % 24;
  const t = artText("which", "hardness");
  return (
    <>
      <g filter={`url(#${id}-rough)`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={prog(f, 0, 18)}>
        {/* the tap */}
        <path d="M40 470 L40 150 Q40 90 110 90 L230 90 Q270 90 270 130 L270 150" />
        <path d="M70 470 L70 160 Q70 120 116 120 L226 120 Q240 120 240 140 L240 150" stroke={GREY} strokeWidth={2.5} />
        <path d="M232 150 L278 150" />
      </g>
      <path d="M255 158 L255 300" stroke="rgba(90,120,140,0.7)" strokeWidth={6} strokeDasharray="14 10" strokeDashoffset={-stream} opacity={prog(f, 10, 24)} />
      <Glass id={id} cx={255} top={260} w={170} h={200} accent={accent} appear={4} />
      <Mug id={id} cx={465} top={350} w={130} h={110} shade={30} appear={22} />
      <Mug id={id} cx={640} top={350} w={130} h={110} shade={62} appear={28} />
      {/* the bottle */}
      <g filter={`url(#${id}-rough)`} opacity={prog(f, 6, 26)}>
        <path d="M830 110 L830 70 L900 70 L900 110 Q960 140 960 200 L960 450 Q960 466 944 466 L786 466 Q770 466 770 450 L770 200 Q770 140 830 110 Z" fill="rgba(120,160,175,0.12)" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <rect x={824} y={46} width={82} height={28} rx={6} fill="#FBF9F4" stroke={INK} strokeWidth={3.5} />
        <rect x={774} y={200} width={182} height={180} fill="#FBF9F4" stroke={GREY} strokeWidth={2.5} />
      </g>
      <g opacity={prog(f, 20, 36)}>
        <rect x={t.cx - 77} y={t.cy - 49} width={154} height={98} fill="none" stroke={accent} strokeWidth={6} rx={6} />
        <Word name="which" k="hardness" fill={accent} />
      </g>
      <Table id={id} y={474} />
    </>
  );
};

const ART: Record<keyof typeof SCENE_ART, React.FC<ArtProps>> = { glasses: Glasses, minerals: Minerals, acid: Acid, compare: Compare, which: Which };

export const SceneArt: React.FC<{ name: string; width: number; accent: string }> = ({ name, width, accent }) => {
  const size = SCENE_ART[name as keyof typeof SCENE_ART];
  const Draw = ART[name as keyof typeof SCENE_ART];
  if (!size || !Draw) return null;
  const id = `art-${name}`;
  return (
    <svg width={width} height={(width * size.h) / size.w} viewBox={`0 0 ${size.w} ${size.h}`} style={{ overflow: "visible" }}>
      <Defs id={id} accent={accent} />
      <Draw id={id} accent={accent} />
    </svg>
  );
};
