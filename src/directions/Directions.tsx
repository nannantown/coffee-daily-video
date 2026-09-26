import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, PHRASE_BREAK } from "../cards/theme";
import { Motif, type MotifKind, type MotifStyle } from "./motifs";

/**
 * Three candidate looks for the 2026-09-26 redesign (owner: the grid all looks
 * the same and every cover is a table of recipe numbers). Same information in
 * all three — one big word for the topic, one picture, one line of what it does
 * to the taste, no numbers — so the owner compares taste, not content.
 *
 * Frames 0-59 are the cover (IG takes the grid thumbnail at 1.5s = frame 45);
 * 60-239 are the start of the explanation: the one change → why → how the taste
 * moves both ways. Content that must survive the profile grid sits inside the
 * centre 3:4 band (y 240-1680), everything else inside the Reels safe area
 * (y 180-1560, right 80px clear below y 1000).
 */

export interface DirEpisode {
  series: string;
  topic: string; // the giant word: 湯温 / 挽き目 / TDS
  move: string; // を上げると？
  motif: MotifKind;
  hue: string; // the topic's colour — what tells the grid tiles apart
  onHue: string; // text colour on hue (≥4.5:1)
  pastel: string; // hue mixed into paper, for direction B
  accent: string; // the part of the picture that changes
  action: string;
  reason: string;
  result: string; // one line under the cover
  up: { label: string; taste: string };
  down: { label: string; taste: string };
  from: number;
  to: number;
}

export type Direction = "A" | "B" | "C";

export interface DirectionProps {
  direction: Direction;
  episode: DirEpisode;
}

export const SAMPLE_EPISODES: DirEpisode[] = [
  {
    series: "初級 第6回",
    topic: "湯温",
    move: "を上げると？",
    motif: "kettle",
    hue: "#B8391B",
    onHue: "#FFFFFF",
    pastel: "#EBC2AE",
    accent: "#E4402B",
    action: "お湯の温度を上げる",
    reason: "熱いほど、粉の成分がよく溶ける",
    result: "苦味とコクが増える",
    up: { label: "上げる", taste: "苦味・コクが増える" },
    down: { label: "下げる", taste: "酸味が立ち、すっきり" },
    from: 0.35,
    to: 0.92,
  },
  {
    series: "初級 第4回",
    topic: "挽き目",
    move: "を細かくすると？",
    motif: "grind",
    hue: "#E3A42B",
    onHue: "#1E130C",
    pastel: "#F2D9A2",
    accent: "#6B3F22",
    action: "挽き目を細かくする",
    reason: "粉の表面が増えて、早く溶ける",
    result: "濃く、苦くなる",
    up: { label: "細かく", taste: "濃く、苦くなる" },
    down: { label: "粗く", taste: "軽く、すっきり" },
    from: 0,
    to: 1,
  },
  {
    series: "上級 第1回",
    topic: "TDS",
    move: "ってなに？",
    motif: "cup",
    hue: "#2A5580",
    onHue: "#FFFFFF",
    pastel: "#B9CBDD",
    accent: "#F2C274",
    action: "TDS＝カップに溶けた成分の量",
    reason: "溶けた成分が多いほど、濃く感じる",
    result: "「濃さ」の正体",
    up: { label: "高い", taste: "濃く、重たい" },
    down: { label: "低い", taste: "薄く、軽い" },
    from: 0.15,
    to: 0.9,
  },
];

const SERIF = "'Noto Serif CJK JP', 'Noto Serif JP', 'Hiragino Mincho ProN', serif";
const INK = "#1E130C";
const CREAM = "#FFF6EA";
const PAPER = "#F3EBDD";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({
  at,
  children,
  style,
  from = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - at), fps, config: { damping: 13, stiffness: 140 } });
  return (
    <div style={{ opacity: interpolate(frame, [at, at + 8], [0, 1], clamp), transform: `translateY(${(1 - p) * from}px)`, ...style }}>
      {children}
    </div>
  );
};

/** The explain scene animates the motif from `from` to `to`, then holds. */
const useAmount = (ep: DirEpisode, start: number, end: number) =>
  interpolate(useCurrentFrame(), [start, end], [ep.from, ep.to], { ...clamp, easing: Easing.inOut(Easing.cubic) });

// ---------------------------------------------------------------------------
// A — poster: flat colour field per topic, heavy gothic, sticker-like picture
// ---------------------------------------------------------------------------

const aStyle = (ep: DirEpisode): MotifStyle => ({ ink: INK, fill: CREAM, accent: ep.accent, liquid: "#3A2216", stroke: 14 });

const CoverA: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const t = useCurrentFrame() / 30;
  return (
    <AbsoluteFill style={{ background: ep.hue, color: ep.onHue }}>
      <Pop at={0} style={{ position: "absolute", top: 270, left: 88, fontSize: 40, fontWeight: 800, letterSpacing: 4 }}>
        味をコントロールする技術　{ep.series}
      </Pop>
      <Pop at={2} style={{ position: "absolute", top: 330, left: 80, fontSize: 250, fontWeight: 900, lineHeight: 1, letterSpacing: -6 }}>
        {ep.topic}
      </Pop>
      <Pop at={6} style={{ position: "absolute", top: 600, left: 88, fontSize: 92, fontWeight: 900 }}>
        {ep.move}
      </Pop>
      <Pop at={9} style={{ position: "absolute", top: 760, left: 170, width: 740, height: 620, transform: "rotate(-4deg)" }}>
        <Motif kind={ep.motif} style={aStyle(ep)} amount={ep.to} t={t} />
      </Pop>
      <Pop at={14} style={{ position: "absolute", top: 1430, left: 60, right: 60, display: "flex", justifyContent: "center" }}>
        <div style={{ background: INK, color: "#fff", fontSize: 68, fontWeight: 900, padding: "18px 44px", borderRadius: 18, transform: "rotate(-2deg)" }}>
          → {ep.result}
        </div>
      </Pop>
    </AbsoluteFill>
  );
};

const ExplainA: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const frame = useCurrentFrame();
  const amount = useAmount(ep, 12, 70);
  return (
    <AbsoluteFill style={{ background: ep.hue, color: ep.onHue }}>
      <Pop at={0} style={{ position: "absolute", top: 220, left: 88, right: 88 }}>
        <span style={{ background: INK, color: "#fff", fontSize: 40, fontWeight: 800, padding: "8px 24px", borderRadius: 12 }}>やること</span>
        <div style={{ marginTop: 22, fontSize: 84, fontWeight: 900, lineHeight: 1.15, ...PHRASE_BREAK }}>{ep.action}</div>
      </Pop>
      <div style={{ position: "absolute", top: 470, left: 190, width: 700, height: 580 }}>
        <Motif kind={ep.motif} style={aStyle(ep)} amount={amount} t={frame / 30} />
      </div>
      <Pop at={40} style={{ position: "absolute", top: 1070, left: 88, right: 168 }}>
        <span style={{ background: CREAM, color: INK, fontSize: 40, fontWeight: 800, padding: "8px 24px", borderRadius: 12 }}>なぜ？</span>
        <div style={{ marginTop: 18, fontSize: 60, fontWeight: 900, lineHeight: 1.25, ...PHRASE_BREAK }}>{ep.reason}</div>
      </Pop>
      {[ep.up, ep.down].map((row, i) => (
        <Pop key={row.label} at={95 + i * 14} style={{ position: "absolute", top: 1330 + i * 120, left: 88, right: 168 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              background: i === 0 ? INK : CREAM,
              color: i === 0 ? "#fff" : INK,
              borderRadius: 20,
              padding: "14px 32px",
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 900, whiteSpace: "nowrap" }}>{row.label}</span>
            <span style={{ fontSize: 48, fontWeight: 900 }}>→ {row.taste}</span>
          </div>
        </Pop>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// B — field notebook: paper, mincho, pen line-art drawn on, one colour wash
// ---------------------------------------------------------------------------

const bStyle = (ep: DirEpisode, draw = 1): MotifStyle => ({
  ink: "#2A1B12",
  fill: PAPER,
  accent: ep.hue,
  liquid: "#4A2E1E",
  stroke: 8,
  draw,
});

const Paper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: PAPER, color: "#2A1B12", fontFamily: SERIF }}>
    {/* faint ruled lines — a notebook page, not a template box */}
    <AbsoluteFill
      style={{
        backgroundImage: "repeating-linear-gradient(0deg, rgba(42,27,18,0.07) 0 2px, transparent 2px 96px)",
        backgroundPosition: "0 40px",
      }}
    />
    {children}
  </AbsoluteFill>
);

const CoverB: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [4, 36], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Paper>
      <Pop at={0} style={{ position: "absolute", top: 270, left: 96, fontSize: 40, fontWeight: 700, letterSpacing: 6 }}>
        {ep.series}
      </Pop>
      <div style={{ position: "absolute", top: 360, left: 96, width: 10, height: 330, background: ep.hue }} />
      <Pop at={2} style={{ position: "absolute", top: 340, left: 140, fontSize: 230, fontWeight: 900, lineHeight: 1.05 }}>
        {ep.topic}
      </Pop>
      <Pop at={6} style={{ position: "absolute", top: 600, left: 150, fontSize: 84, fontWeight: 700 }}>
        {ep.move}
      </Pop>
      <div style={{ position: "absolute", top: 800, left: 190, width: 700, height: 620, borderRadius: "50%", background: ep.pastel }} />
      <div style={{ position: "absolute", top: 790, left: 190, width: 700, height: 600 }}>
        <Motif kind={ep.motif} style={bStyle(ep, draw)} amount={ep.to} t={frame / 30} />
      </div>
      <Pop at={20} style={{ position: "absolute", top: 1450, left: 96, right: 96, textAlign: "center" }}>
        <span style={{ fontSize: 70, fontWeight: 900, backgroundImage: `linear-gradient(transparent 62%, ${ep.pastel} 62%)`, padding: "0 12px" }}>
          {ep.result}
        </span>
      </Pop>
    </Paper>
  );
};

const Note: React.FC<{ at: number; top: number; label: string; hue: string; children: React.ReactNode }> = ({ at, top, label, hue, children }) => (
  <Pop at={at} from={16} style={{ position: "absolute", top, left: 96, right: 176, display: "flex", gap: 28, alignItems: "baseline" }}>
    <span style={{ fontSize: 40, fontWeight: 700, color: hue, whiteSpace: "nowrap", borderBottom: `4px solid ${hue}` }}>{label}</span>
    <span style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.3, ...PHRASE_BREAK }}>{children}</span>
  </Pop>
);

const ExplainB: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const amount = useAmount(ep, 26, 80);
  return (
    <Paper>
      <Note at={0} top={230} label="やること" hue={ep.hue}>
        {ep.action}
      </Note>
      <div style={{ position: "absolute", top: 440, left: 240, width: 600, height: 520, borderRadius: "50%", background: ep.pastel, opacity: 0.8 }} />
      <div style={{ position: "absolute", top: 420, left: 240, width: 600, height: 540 }}>
        <Motif kind={ep.motif} style={bStyle(ep, draw)} amount={amount} t={frame / 30} />
      </div>
      <Note at={45} top={1030} label="なぜ" hue={ep.hue}>
        {ep.reason}
      </Note>
      <div style={{ position: "absolute", top: 1240, left: 96, right: 176, height: 3, background: "rgba(42,27,18,0.35)" }} />
      {[ep.up, ep.down].map((row, i) => (
        <Note key={row.label} at={95 + i * 14} top={1280 + i * 120} label={row.label} hue={ep.hue}>
          → {row.taste}
        </Note>
      ))}
    </Paper>
  );
};

// ---------------------------------------------------------------------------
// C — dark cinema: black stage, the object lit in the topic's colour
// ---------------------------------------------------------------------------

const cStyle = (ep: DirEpisode): MotifStyle => ({
  ink: ep.pastel,
  fill: "#17100B",
  accent: ep.hue === "#E3A42B" ? "#E3A42B" : ep.accent,
  liquid: "#2B1A10",
  stroke: 9,
  glow: true,
});

const Stage: React.FC<{ ep: DirEpisode; children: React.ReactNode }> = ({ ep, children }) => (
  <AbsoluteFill style={{ background: "#0A0705", color: "#fff" }}>
    <AbsoluteFill style={{ background: `radial-gradient(70% 40% at 50% 36%, ${ep.hue} 0%, ${ep.hue}66 40%, transparent 78%)` }} />
    {children}
  </AbsoluteFill>
);

const CoverC: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, 60], [1.06, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <Stage ep={ep}>
      <Pop at={0} style={{ position: "absolute", top: 270, left: 0, right: 0, textAlign: "center", fontSize: 40, fontWeight: 700, letterSpacing: 8, color: "rgba(255,255,255,0.85)" }}>
        {ep.series}
      </Pop>
      <div style={{ position: "absolute", top: 380, left: 150, width: 780, height: 700, transform: `scale(${push})` }}>
        <Motif kind={ep.motif} style={cStyle(ep)} amount={ep.to} t={frame / 30} />
      </div>
      <Pop at={4} style={{ position: "absolute", top: 1110, left: 0, right: 0, textAlign: "center", fontSize: 240, fontWeight: 900, lineHeight: 1, letterSpacing: 4, textShadow: `0 0 40px ${ep.hue}` }}>
        {ep.topic}
      </Pop>
      <Pop at={8} style={{ position: "absolute", top: 1360, left: 0, right: 0, textAlign: "center", fontSize: 84, fontWeight: 800 }}>
        {ep.move}
      </Pop>
      <Pop at={16} style={{ position: "absolute", top: 1480, left: 0, right: 0, textAlign: "center", fontSize: 52, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
        {ep.result}
      </Pop>
    </Stage>
  );
};

const Caption: React.FC<{ from: number; to?: number; kicker: string; hue: string; children: React.ReactNode }> = ({ from, to = 999, kicker, hue, children }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [to - 8, to], [1, 0], clamp);
  if (frame < from || frame > to) return null;
  return (
    <Pop at={from} from={24} style={{ position: "absolute", top: 1180, left: 96, right: 176, opacity: out }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: hue, letterSpacing: 6 }}>{kicker}</div>
      <div style={{ marginTop: 16, fontSize: 70, fontWeight: 900, lineHeight: 1.25, ...PHRASE_BREAK }}>{children}</div>
    </Pop>
  );
};

const ExplainC: React.FC<{ ep: DirEpisode }> = ({ ep }) => {
  const frame = useCurrentFrame();
  const amount = useAmount(ep, 10, 70);
  const push = interpolate(frame, [0, 180], [1, 1.08], clamp);
  const kicker = ep.pastel;
  return (
    <Stage ep={ep}>
      <div style={{ position: "absolute", top: 260, left: 150, width: 780, height: 760, transform: `scale(${push})` }}>
        <Motif kind={ep.motif} style={cStyle(ep)} amount={amount} t={frame / 30} />
      </div>
      <Caption from={0} to={60} kicker="やること" hue={kicker}>
        {ep.action}
      </Caption>
      <Caption from={56} to={112} kicker="なぜ" hue={kicker}>
        {ep.reason}
      </Caption>
      {[ep.up, ep.down].map((row, i) => (
        <Pop key={row.label} at={110 + i * 12} style={{ position: "absolute", top: 1170 + i * 190, left: 96, right: 176 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: kicker, letterSpacing: 6 }}>{row.label}と</div>
          <div style={{ marginTop: 8, fontSize: 64, fontWeight: 900 }}>{row.taste}</div>
        </Pop>
      ))}
    </Stage>
  );
};

// ---------------------------------------------------------------------------

const COVERS = { A: CoverA, B: CoverB, C: CoverC };
const EXPLAINS = { A: ExplainA, B: ExplainB, C: ExplainC };

export const DIRECTION_FRAMES = 240;

export const DirectionPreview: React.FC<{ direction: Direction; episodeIndex: number }> = ({ direction, episodeIndex }) => {
  const episode = SAMPLE_EPISODES[episodeIndex] ?? SAMPLE_EPISODES[0];
  const Cover = COVERS[direction];
  const Explain = EXPLAINS[direction];
  return (
    <AbsoluteFill lang="ja" style={{ fontFamily: FONT_FAMILY }}>
      <Sequence durationInFrames={60}>
        <Cover ep={episode} />
      </Sequence>
      <Sequence from={60}>
        <Explain ep={episode} />
      </Sequence>
    </AbsoluteFill>
  );
};
