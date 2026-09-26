import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FONT_FAMILY, PHRASE_BREAK } from "../cards/theme";
import { DrawnPlate, Flow, MovingPhoto, Ripples, Steam, thermoFor, WhyChain } from "./Explain";

/**
 * Second round of the 2026-09-26 redesign. The owner rejected the first three
 * looks as dated (thick outlines, flat primary fills, neon, oversized type).
 * Made in two steps (owner's process): Codex generated a reference image per
 * look (docs/previews/ref/), then this file reproduces it — the picture is a
 * text-free plate Codex drew in the same style (public/looks/), and every word,
 * rule and movement is typeset here, so the text is always exact.
 *
 * Type follows docs/typography-scale.md: Noto Sans JP only, four sizes
 * 128 / 64 / 48 / 40 px, weight 700 at most, one accent per episode.
 *
 *   lab   — ラボノート: warm paper, ink text, a fine pencil illustration
 *   photo — 自然光の写真: a full-bleed photo, white text over a soft top fade
 *   still — 色の面と静物: a muted colour field per topic, one matte clay object
 *
 * Cover text sits in y 300-1240 (Reels UI covers the top 14% / bottom 35%); the
 * picture sits lower, still inside the 3:4 band (y 240-1680) the grid shows.
 */

export type Look = "lab" | "photo" | "still";

export interface LookEpisode {
  id: string;
  pillar?: string; // curriculum pillar (temp → thermometer in the why scene)
  series: string; // 初級 第6回
  word: string;
  ask: string;
  topic: string;
  hook: string;
  why: string;
  effect: { label: string; taste: string }[];
  accent: string; // lab: the one accent colour
  field: string; // still: background
  deep: string; // still: text in a deeper shade of the same hue
  plate: string; // public/looks/<file>
}

export const SIZE = { word: 128, head: 64, body: 48, aux: 40 };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** Quiet entrance: fade + 24px rise over 18 frames. No springs, no pops. */
const In: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 18], [0, 1], { ...clamp, easing: easeOut });
  return <div style={{ position: "absolute", opacity: p, transform: `translateY(${(1 - p) * 24}px)`, ...style }}>{children}</div>;
};

const type = (size: keyof typeof SIZE, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: SIZE[size],
  fontWeight: weight,
  color,
  lineHeight: size === "word" ? 1.15 : size === "body" ? 1.5 : 1.4,
  letterSpacing: size === "word" ? "0" : size === "head" ? "0.02em" : "0.04em",
  fontFeatureSettings: '"palt"',
  ...PHRASE_BREAK,
  ...extra,
});

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** The picture: full frame, a slow push-in; `reveal` wipes it in from the bottom (lab). */
const Plate: React.FC<{ ep: LookEpisode; dim?: string; reveal?: boolean; rise?: boolean }> = ({ ep, dim, reveal, rise }) => {
  const f = useCurrentFrame();
  const zoom = 1.02 + f * 0.00025;
  const shown = reveal ? interpolate(f, [0, 36], [0, 100], { ...clamp, easing: easeOut }) : 100;
  const lift = rise ? interpolate(f, [0, 40], [40, 0], { ...clamp, easing: easeOut }) + Math.sin(f / 40) * 5 : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(`looks/${ep.plate}`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translateY(${lift}px) scale(${zoom})`,
          clipPath: `inset(${100 - shown}% 0 0 0)`,
        }}
      />
      {dim ? <AbsoluteFill style={{ background: dim }} /> : null}
    </AbsoluteFill>
  );
};

/** Two rows: today's move and the other way, each "label と → taste". */
const EffectRows: React.FC<{
  ep: LookEpisode;
  top: number;
  align: "left" | "center";
  ink: string;
  sub: string;
  mark: string;
  rule?: string;
}> = ({ ep, top, align, ink, sub, mark, rule }) => (
  <>
    {ep.effect.map((e, i) => (
      <In key={e.label} at={14 + i * 14} style={{ top: top + i * 150, left: 96, right: align === "center" ? 96 : 176 }}>
        {rule ? <div style={{ height: 2, background: rule, marginBottom: 26 }} /> : null}
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, justifyContent: align === "center" ? "center" : "flex-start", whiteSpace: "nowrap" }}>
          <span style={type("body", 500, i === 0 ? mark : sub)}>{e.label}と</span>
          <span style={type("body", 500, sub)}>→</span>
          <span style={type("body", 700, ink)}>{e.taste}</span>
        </div>
      </In>
    ))}
  </>
);

// ---------------------------------------------------------------------------
// lab — ラボノート
// ---------------------------------------------------------------------------

const PAPER = "#F3F0EA";
const INK = "#22201C";
const GREY = "#6B655C";
const RULE = "#D6D0C4";

const LabHeader: React.FC<{ label: string }> = ({ label }) => (
  <In at={0} style={{ top: 300, left: 96, ...type("aux", 500, GREY) }}>
    {label}
  </In>
);

const LabCover: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: PAPER }}>
    <Plate ep={ep} reveal />
    <LabHeader label={`${ep.series}　・　抽出メモ`} />
    <In at={2} style={{ top: 372, left: 90, right: 96 }}>
      <div style={type("word", 700, INK)}>{ep.word}</div>
      <div style={type("head", 700, INK, { marginTop: 6 })}>{ep.ask}</div>
    </In>
    <In at={8} style={{ top: 646, left: 96, width: 820 }}>
      <div style={{ height: 2, background: ep.accent, opacity: 0.8 }} />
      <div style={type("head", 500, ep.accent, { marginTop: 24 })}>{ep.topic}</div>
    </In>
  </AbsoluteFill>
);

const LabWhy: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: PAPER }}>
    <DrawnPlate src={`looks/${ep.plate}`} />
    {ep.plate.endsWith("-kettle.png") ? (
      <>
        <Steam x={360} y={1290} color={rgba(ep.accent, 0.55)} width={4} />
        <Flow d="M478 1102 C 452 1180 418 1300 412 1486" color="rgba(90,120,140,0.75)" width={4} dash="10 26" speed={3.2} />
        <Ripples x={402} y={1492} color={rgba(ep.accent, 0.7)} />
      </>
    ) : null}
    <LabHeader label="なぜ変わる？" />
    <In at={4} style={{ top: 380, left: 96, right: 96, ...type("head", 700, INK) }}>
      {ep.hook}と
    </In>
    <WhyChain why={ep.why} topic={ep.topic} thermo={thermoFor(ep.pillar ?? "", ep.effect[0]?.label ?? "")} ink={{ line: INK, text: INK, sub: GREY, accent: ep.accent, glass: PAPER }} />
  </AbsoluteFill>
);

const LabEffect: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: PAPER }}>
    <Plate ep={ep} />
    <LabHeader label={`${ep.word}${ep.ask}`} />
    <In at={2} style={{ top: 380, left: 96, ...type("head", 700, INK) }}>
      味はこう変わる
    </In>
    <EffectRows ep={ep} top={540} align="left" ink={INK} sub={GREY} mark={ep.accent} rule={RULE} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// photo — 自然光の写真
// ---------------------------------------------------------------------------

const AMBER = "#E3B37A";
const WHITE = "#FFFFFF";
const WHITE_SUB = "rgba(255,255,255,0.78)";
const TOP_FADE = "linear-gradient(180deg, rgba(20,16,12,0.62) 0%, rgba(20,16,12,0.3) 40%, rgba(20,16,12,0) 60%)";

const PhotoCover: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: "#2B211B" }}>
    <Plate ep={ep} dim={TOP_FADE} />
    <In at={0} style={{ top: 300, left: 96, ...type("aux", 500, WHITE_SUB) }}>
      {ep.series}
    </In>
    <In at={2} style={{ top: 372, left: 90, right: 96 }}>
      <div style={type("word", 700, WHITE)}>{ep.word}</div>
      <div style={type("head", 700, WHITE, { marginTop: 6 })}>{ep.ask}</div>
    </In>
    <In at={8} style={{ top: 640, left: 96, right: 96, ...type("body", 500, AMBER) }}>
      {ep.topic}
    </In>
  </AbsoluteFill>
);

const PhotoWhy: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill>
    <MovingPhoto src={`looks/${ep.plate}`}>
      {ep.plate.endsWith("-kettle.png") ? (
        <>
          <Steam x={690} y={1080} color="rgba(255,248,238,0.5)" width={22} blur={9} spread={90} height={380} />
          <Flow d="M690 1092 C 720 1180 780 1330 868 1680" color="rgba(255,236,200,0.95)" width={3} dash="18 90" speed={6} blur={0.8} />
        </>
      ) : null}
    </MovingPhoto>
    <In at={0} style={{ top: 300, left: 96, ...type("aux", 500, WHITE_SUB) }}>
      なぜ変わる？
    </In>
    <In at={4} style={{ top: 380, left: 96, right: 96, ...type("head", 700, WHITE) }}>
      {ep.hook}と
    </In>
    <WhyChain
      why={ep.why}
      topic={ep.topic}
      thermo={thermoFor(ep.pillar ?? "", ep.effect[0]?.label ?? "")}
      ink={{ line: "rgba(255,255,255,0.92)", text: WHITE, sub: WHITE_SUB, accent: AMBER, glass: "rgba(255,255,255,0.08)", shadow: "rgba(0,0,0,0.45)" }}
    />
  </AbsoluteFill>
);

const PhotoEffect: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: "#2B211B" }}>
    <Plate ep={ep} dim="linear-gradient(180deg, rgba(20,16,12,0.72) 0%, rgba(20,16,12,0.5) 50%, rgba(20,16,12,0.2) 75%)" />
    <In at={0} style={{ top: 300, left: 96, ...type("aux", 500, WHITE_SUB) }}>
      {ep.word}
      {ep.ask}
    </In>
    <In at={2} style={{ top: 380, left: 96, ...type("head", 700, WHITE) }}>
      味はこう変わる
    </In>
    <EffectRows ep={ep} top={560} align="left" ink={WHITE} sub={WHITE_SUB} mark={AMBER} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// still — 色の面と静物
// ---------------------------------------------------------------------------

const StillCover: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: ep.field }}>
    <Plate ep={ep} rise />
    <In at={0} style={{ top: 300, left: 0, right: 0, textAlign: "center", ...type("aux", 500, rgba(ep.deep, 0.72)) }}>
      {ep.series}
    </In>
    <In at={2} style={{ top: 372, left: 60, right: 60, textAlign: "center" }}>
      <div style={type("word", 700, ep.deep)}>{ep.word}</div>
      <div style={type("head", 700, ep.deep, { marginTop: 6 })}>{ep.ask}</div>
    </In>
    <In at={8} style={{ top: 650, left: 60, right: 60, textAlign: "center", ...type("body", 500, ep.deep) }}>
      {ep.topic}
    </In>
  </AbsoluteFill>
);

const StillWhy: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: ep.field }}>
    <Plate ep={ep} />
    <In at={0} style={{ top: 300, left: 0, right: 0, textAlign: "center", ...type("aux", 500, rgba(ep.deep, 0.72)) }}>
      なぜ変わる？
    </In>
    <In at={4} style={{ top: 380, left: 80, right: 80, textAlign: "center", ...type("head", 700, ep.deep) }}>
      {ep.hook}と
    </In>
    <In at={24} style={{ top: 560, left: 100, right: 100, textAlign: "center", ...type("body", 500, ep.deep) }}>
      {ep.why}
    </In>
  </AbsoluteFill>
);

const StillEffect: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <AbsoluteFill style={{ background: ep.field }}>
    <Plate ep={ep} />
    <In at={0} style={{ top: 300, left: 0, right: 0, textAlign: "center", ...type("aux", 500, rgba(ep.deep, 0.72)) }}>
      {ep.word}
      {ep.ask}
    </In>
    <In at={2} style={{ top: 380, left: 0, right: 0, textAlign: "center", ...type("head", 700, ep.deep) }}>
      味はこう変わる
    </In>
    <EffectRows ep={ep} top={560} align="center" ink={ep.deep} sub={rgba(ep.deep, 0.72)} mark={ep.deep} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------

export const LOOK_SCENES: Record<Look, { cover: React.FC<{ ep: LookEpisode }>; why: React.FC<{ ep: LookEpisode }>; effect: React.FC<{ ep: LookEpisode }> }> = {
  lab: { cover: LabCover, why: LabWhy, effect: LabEffect },
  photo: { cover: PhotoCover, why: PhotoWhy, effect: PhotoEffect },
  still: { cover: StillCover, why: StillWhy, effect: StillEffect },
};

const PREVIEW_EPISODES: Omit<LookEpisode, "plate">[] = [
  {
    id: "kettle",
    pillar: "temp",
    series: "初級 第6回",
    word: "湯温",
    ask: "を下げると？",
    topic: "苦味が引いて酸が立つ",
    hook: "お湯の温度を下げる",
    why: "熱いほど苦味の成分がよく溶ける",
    effect: [
      { label: "下げる", taste: "苦味が引き、すっきり" },
      { label: "上げる", taste: "苦味とコクが増える" },
    ],
    accent: "#B5563A",
    field: "#D9B8A3",
    deep: "#5A3A2C",
  },
  {
    id: "grinder",
    series: "初級 第4回",
    word: "挽き目",
    ask: "を細かくすると？",
    topic: "濃さとコクが増える",
    hook: "挽き目を細かくする",
    why: "細かいほど、お湯に触れる面が増える",
    effect: [
      { label: "細かくする", taste: "濃く、苦味とコク" },
      { label: "粗くする", taste: "軽く、すっきり" },
    ],
    accent: "#7A6A58",
    field: "#CFC6B3",
    deep: "#4A4336",
  },
  {
    id: "cup",
    series: "上級 第28回",
    word: "TDS",
    ask: "ってなに？",
    topic: "TDSが上がり濃く感じる",
    hook: "粉を少し増やす",
    why: "TDS＝コーヒーに溶けた成分の濃さ",
    effect: [
      { label: "粉を増やす", taste: "濃く、重たい" },
      { label: "粉を減らす", taste: "薄く、軽い" },
    ],
    accent: "#4F6D7A",
    field: "#B9C4C9",
    deep: "#34454D",
  },
];

export const LOOK_FRAMES = 300;

/** Cover 2.5s → why 3s → both ways 4.5s (preview only; scripts/render-looks.mjs). */
export const LookPreview: React.FC<{ look: Look; episodeIndex: number }> = ({ look, episodeIndex }) => {
  const base = PREVIEW_EPISODES[episodeIndex];
  const ep = { ...base, plate: `${look}-${base.id}.png` };
  const S = LOOK_SCENES[look];
  return (
    <AbsoluteFill lang="ja" style={{ fontFamily: FONT_FAMILY }}>
      <Sequence durationInFrames={75}>
        <S.cover ep={ep} />
      </Sequence>
      <Sequence from={75} durationInFrames={90}>
        <S.why ep={ep} />
      </Sequence>
      <Sequence from={165}>
        <S.effect ep={ep} />
      </Sequence>
    </AbsoluteFill>
  );
};
