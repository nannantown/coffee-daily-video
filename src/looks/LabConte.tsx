import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { DiagramBody } from "../cards/Diagrams";
import { InkContext } from "../cards/ink";
import { FONT_FAMILY, PHRASE_BREAK } from "../cards/theme";
import type { CtaEnding, LessonMotion, LessonTipsSlide, LessonVisualSlide } from "../cards/types";
import { coffeeColor } from "./Motion";
import type { LookEpisode } from "./Looks";
import { PaperGrain, PencilMotion } from "./PencilMotion";
import { subjectFor, withTo } from "./art";
import { CONTENT_BOTTOM, DIAGRAM_TOP, EFFECT, END, LOW_Y, NOTE_SIZE, TIPS, effectLayout, endLayout, tipsLayout, visualLayout } from "./safe-layout.mjs";

/**
 * The lab look (ラボノート, owner's pick 2026-09-26), every scene after the
 * cover, reproduced from the Codex storyboard (docs/previews/ref/conte-*.png):
 * a big underlined heading, a big pencil picture, hatched meters, and the
 * frame filled top to bottom (a coffee branch top right, beans at the foot —
 * both cut from the storyboard). Pencil art comes from Codex plates; the
 * coffee colour, needles and bars move in code.
 */

const PAPER = "#F3F0EA";
const INK = "#22201C";
const GREY = "#6B655C";
const RULE = "#D6D0C4";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.inOut(Easing.cubic);
const prog = (f: number, a: number, b: number, e = easeOut) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

export const LAB_TYPE = { head: 96, body: 56, label: 44 };

const T = (size: number, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: size >= 64 ? 1.3 : 1.5,
  letterSpacing: size >= 64 ? "0.01em" : "0.03em",
  fontFeatureSettings: '"palt"',
  ...PHRASE_BREAK,
  ...extra,
});

const In: React.FC<{ at: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, style, children }) => {
  const p = prog(useCurrentFrame(), at, at + 18);
  return <div style={{ position: "absolute", opacity: p, transform: `translateY(${(1 - p) * 22}px)`, ...style }}>{children}</div>;
};

const EDGE = "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)";

/** Paper, grain, the coffee branch (top right) and beans (bottom left) of the storyboard. */
export const LabFrame: React.FC<{ children: React.ReactNode; beans?: boolean; sprig?: boolean }> = ({ children, beans = true, sprig = true }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill lang="ja" style={{ background: PAPER, fontFamily: FONT_FAMILY, color: INK }}>
      <Img src={staticFile("looks/lab-decor-branch.png")} style={{ position: "absolute", right: -20, top: -30, width: 300, mixBlendMode: "darken", WebkitMaskImage: EDGE, maskImage: EDGE, opacity: prog(f, 0, 20) }} />
      {sprig ? (
        // a leaf sprig at the foot, right (the storyboard's second decoration)
        <div style={{ position: "absolute", right: -40, bottom: 40, width: 420, height: 420, overflow: "hidden", opacity: prog(f, 6, 26) }}>
          <Img src={staticFile("looks/lab-decor-sprig.png")} style={{ position: "absolute", left: -150, top: -520, width: 720, height: 1280, mixBlendMode: "darken" }} />
        </div>
      ) : null}
      {beans ? <Img src={staticFile("looks/lab-decor-beans.png")} style={{ position: "absolute", left: 20, bottom: 60, width: 460, mixBlendMode: "darken", WebkitMaskImage: EDGE, maskImage: EDGE, opacity: prog(f, 6, 26) }} /> : null}
      {children}
      <PaperGrain />
    </AbsoluteFill>
  );
};

/** Small grey label + hairline, then the big heading with the accent underline. */
export const LabHeading: React.FC<{ label: string; heading: string; accent: string; centerLabel?: boolean }> = ({ label, heading, accent, centerLabel }) => (
  <>
    <In at={0} style={{ top: 290, left: 96, right: 96 }}>
      {centerLabel ? (
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flex: 1, height: 2, background: RULE }} />
          <span style={T(LAB_TYPE.label, 500, GREY)}>{label}</span>
          <div style={{ flex: 1, height: 2, background: RULE }} />
        </div>
      ) : (
        <>
          <div style={T(LAB_TYPE.label, 500, GREY)}>{label}</div>
          <div style={{ height: 2, background: RULE, marginTop: 14, width: 560 }} />
        </>
      )}
    </In>
    <In at={4} style={{ top: 372, left: 96, right: 96 }}>
      <span style={{ ...T(LAB_TYPE.head, 700, INK), borderBottom: `4px solid ${accent}`, paddingBottom: 6 }}>{heading}</span>
    </In>
  </>
);

// ---------------------------------------------------------------------------
// why
// ---------------------------------------------------------------------------

export const LabWhyConte: React.FC<{ ep: LookEpisode }> = ({ ep }) => (
  <LabFrame beans={false} sprig={false}>
    {ep.motion ? <PencilMotion motion={ep.motion} core={ep.core ?? ep.why} sides={ep.effect} accent={ep.accent} heading={`${ep.hook}と`} /> : null}
    <LabHeading label="なぜ変わる？" heading={`${ep.hook}と`} accent={ep.accent} centerLabel />
  </LabFrame>
);

// ---------------------------------------------------------------------------
// diagram — the scale is a hand-drawn half gauge; the other kinds are the
// shared drawings inked in pencil tones
// ---------------------------------------------------------------------------

const Gauge: React.FC<{ v: Extract<LessonVisualSlide["visual"], { type: "scale" }>; accent: string }> = ({ v, accent }) => {
  const f = useCurrentFrame();
  const cx = 540;
  const cy = 1130; // leaves room for a two-line heading above the top zone label
  const r = 400;
  const pos = interpolate(f, [30, 90], [v.from ?? v.to, v.to], { ...clamp, easing: inOut });
  const ang = (p: number) => Math.PI * (1 - p / 100); // 0 → left, 100 → right
  const pt = (p: number, rr: number) => [cx + rr * Math.cos(ang(p)), cy - rr * Math.sin(ang(p))];
  const draw = prog(f, 0, 30, inOut);
  const n = v.zones.length;
  const arc = (a: number, b: number, rr: number) => {
    const [x1, y1] = pt(a, rr);
    const [x2, y2] = pt(b, rr);
    return `M${x1} ${y1} A${rr} ${rr} 0 0 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(pos, r - 60);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter id="rough2">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={9} />
          <feDisplacementMap in="SourceGraphic" scale={3} />
        </filter>
        <pattern id="hatch2" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={accent} strokeWidth={3} />
        </pattern>
      </defs>
      <g filter="url(#rough2)">
        {/* the band the needle points into, hatched */}
        <path d={arc(Math.floor(Math.min(99, pos) / (100 / n)) * (100 / n), Math.floor(Math.min(99, pos) / (100 / n)) * (100 / n) + 100 / n, r - 20)} stroke="url(#hatch2)" strokeWidth={40} fill="none" opacity={0.8} />
        <path d={arc(0, 100, r + 16)} stroke={INK} strokeWidth={3} fill="none" opacity={draw} />
        <path d={arc(0, 100, r)} stroke={INK} strokeWidth={6} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={arc(0, 100, r - 40)} stroke={GREY} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        {Array.from({ length: 21 }, (_, i) => {
          const [x1, y1] = pt(i * 5, r);
          const [x2, y2] = pt(i * 5, r - (i % 5 === 0 ? 36 : 20));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={i % 5 === 0 ? 4 : 2} opacity={draw} />;
        })}
        <line x1={cx - r - 30} y1={cy} x2={cx + r + 30} y2={cy} stroke={INK} strokeWidth={3} opacity={draw} />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={accent} strokeWidth={16} strokeLinecap="round" opacity={prog(f, 20, 30)} />
        <circle cx={cx} cy={cy} r={34} fill={PAPER} stroke={INK} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={12} fill={INK} />
      </g>
      {v.zones.map((z, i) => {
        const [x, y] = pt((i + 0.5) * (100 / n), r + 70);
        return (
          <text key={z} x={x} y={y} textAnchor="middle" fontSize={56} fontWeight={700} fill={INK} fontFamily={FONT_FAMILY} opacity={prog(f, 10 + i * 4, 24 + i * 4)}>
            {z}
          </text>
        );
      })}
    </svg>
  );
};

export const LabVisualConte: React.FC<{ ep: LookEpisode; slide: LessonVisualSlide }> = ({ ep, slide }) => {
  const v = slide.visual;
  const L = visualLayout({ type: v.type, caption: v.caption, why: ep.why });
  return (
    <LabFrame sprig={false} beans={false}>
      <LabHeading label={slide.heading} heading={`${ep.word}${ep.ask}`} accent={ep.accent} />
      {v.type === "scale" ? (
        <Gauge v={v} accent={ep.accent} />
      ) : (
        <InkContext.Provider value={{ text: INK, textSub: "rgba(34,32,28,0.8)", textMuted: GREY, surface: "#FFFFFF", pill: "#EAE4D8", hairline: RULE, bg: PAPER }}>
          <div style={{ position: "absolute", top: DIAGRAM_TOP, left: 96, width: 888 }}>
            <DiagramBody v={v} flowHeight={480} />
          </div>
        </InkContext.Provider>
      )}
      <In at={60} style={{ top: L.captionTop, left: 96, right: L.captionTop > LOW_Y ? 176 : 96 }}>
        <div style={T(L.captionSize, 700, ep.accent)}>{v.caption}</div>
      </In>
      {L.showNote ? (
        <In at={80} style={{ top: L.noteTop - 26, left: 96, right: 176 }}>
          <div style={{ height: 2, background: RULE, marginBottom: 24 }} />
          <div style={T(NOTE_SIZE, 500, GREY)}>{ep.why}</div>
        </In>
      ) : null}
      {/* the storyboard's lower band: the episode's drawing, under the text (pictures may pass CONTENT_BOTTOM) */}
      <In at={70} style={{ top: Math.max(L.pictureTop, CONTENT_BOTTOM - 180), left: 40 }}>
        <Doodle subject={subjectFor(ep.id)} size={380} />
      </In>
    </LabFrame>
  );
};

// ---------------------------------------------------------------------------
// both ways — a pencil cup per row, the coffee darker or lighter
// ---------------------------------------------------------------------------

/** The left cup of the cups plate, cropped, with the coffee poured in through its mask. */
const PencilCup: React.FC<{ shade: number; width: number }> = ({ shade, width }) => {
  const box = { x: 100, y: 870, w: 460, h: 380 }; // the left cup + handle on lab-vessel-cups.png (1080x1920)
  const s = width / box.w;
  const mask = `url(${staticFile("looks/lab-vessel-cups-mask-left.png")})`;
  return (
    <div style={{ position: "relative", width, height: box.h * s, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -box.x * s, top: -box.y * s, width: 1080 * s, height: 1920 * s }}>
        <Img src={staticFile("looks/lab-vessel-cups.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "darken" }} />
        <div style={{ position: "absolute", inset: 0, WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", mixBlendMode: "multiply" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: `${(1000 / 1920) * 100}%`, bottom: 0, background: `repeating-linear-gradient(128deg, rgba(0,0,0,0.16) 0 2px, rgba(0,0,0,0) 2px 10px), linear-gradient(180deg, rgba(255,214,150,0.35) 0%, rgba(255,214,150,0.08) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.14) 100%), ${coffeeColor(shade)}`, opacity: 0.94 }} />
        </div>
      </div>
    </div>
  );
};

export const LabEffectConte: React.FC<{ ep: LookEpisode }> = ({ ep }) => {
  const f = useCurrentFrame();
  const m: LessonMotion | undefined = ep.motion;
  const today = m ? m.shade.to : 45;
  const other = m ? Math.max(5, Math.min(95, 2 * m.shade.from - m.shade.to)) : 70;
  const rows = [
    { ...ep.effect[0], shade: interpolate(f, [20, 70], [m?.shade.from ?? today, today], { ...clamp, easing: inOut }) },
    { ...ep.effect[1], shade: interpolate(f, [34, 84], [m?.shade.from ?? other, other], { ...clamp, easing: inOut }) },
  ];
  const L = effectLayout(rows);
  return (
    <LabFrame>
      <LabHeading label={`${ep.word}${ep.ask}`} heading="味はこう変わる" accent={ep.accent} />
      {rows.map((r, i) => (
        <In key={r.label} at={10 + i * 14} style={{ top: L[i].top, left: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <PencilCup shade={r.shade} width={EFFECT.cup} />
            <div style={{ width: L[i].width }}>
              <div style={T(EFFECT.labelSize, 700, INK)}>
                {withTo(r.label)} <span style={{ color: ep.accent }}>→</span>
              </div>
              <div style={T(EFFECT.tasteSize, 500, INK, { marginTop: 12 })}>{r.taste}</div>
            </div>
          </div>
          {i === 0 ? <div style={{ height: 2, background: RULE, marginTop: 30, width: 1080 - 60 - 96 }} /> : null}
        </In>
      ))}
    </LabFrame>
  );
};

// ---------------------------------------------------------------------------
// tips — notebook entries with a pencil doodle each
// ---------------------------------------------------------------------------

/** A square crop of a subject plate (its lower half holds the drawing). */
const Doodle: React.FC<{ subject: string; size: number }> = ({ subject, size }) => {
  const box = { x: 200, y: 880, w: 720, h: 720 };
  const s = size / box.w;
  return (
    <div style={{ position: "relative", width: size, height: size, overflow: "hidden", WebkitMaskImage: EDGE, maskImage: EDGE }}>
      <Img src={staticFile(`looks/lab-${subject}.png`)} style={{ position: "absolute", left: -box.x * s, top: -box.y * s, width: 1080 * s, height: 1920 * s, mixBlendMode: "darken" }} />
    </div>
  );
};

export const LabTipsConte: React.FC<{ ep: LookEpisode; slide: LessonTipsSlide }> = ({ ep, slide }) => {
  const own = subjectFor(ep.id);
  const doodles = [own, own === "grinder" ? "kettle" : "grinder", "cup"];
  const tips = slide.tips.slice(0, 3);
  const L = tipsLayout(tips);
  const f = useCurrentFrame();
  return (
    <LabFrame beans={false} sprig={false}>
      {/* the storyboard's foot: an open notebook and spilled grounds, edge to edge */}
      <div style={{ position: "absolute", left: 0, top: 1640, width: 1080, height: 280, overflow: "hidden", opacity: prog(f, 0, 24), WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 45%)", maskImage: "linear-gradient(180deg, transparent 0%, #000 45%)" }}>
        <Img src={staticFile("looks/lab-end-still.png")} style={{ position: "absolute", left: 0, top: -1380, width: 1080, height: 1920, mixBlendMode: "darken" }} />
      </div>
      <LabHeading label={`${ep.word}${ep.ask}`} heading={slide.heading} accent={ep.accent} />
      {tips.map((t, i) => (
        <In key={t.problem} at={10 + i * 12} style={{ top: L[i].top, left: 96 }}>
          <div style={{ display: "flex", alignItems: "center", gap: TIPS.gap }}>
            <div style={{ width: L[i].width }}>
              <div style={T(L[i].problemSize, 700, INK)}>{t.problem}</div>
              <div style={T(L[i].fixSize, 700, ep.accent, { marginTop: 10 })}>→ {t.fix}</div>
            </div>
            <Doodle subject={doodles[i]} size={L[i].doodle} />
          </div>
          {i < tips.length - 1 ? <div style={{ height: 2, background: RULE, marginTop: 20, width: 1080 - 96 * 2 }} /> : null}
        </In>
      ))}
    </LabFrame>
  );
};

// ---------------------------------------------------------------------------
// ending
// ---------------------------------------------------------------------------

export const LabEndConte: React.FC<{ ep: LookEpisode; ending: CtaEnding }> = ({ ep, ending }) => {
  const f = useCurrentFrame();
  const L = endLayout({ heading: ending.heading, lines: ending.lines, next: ending.next });
  return (
    <LabFrame beans={false} sprig={false}>
      {/* the still life (cup, kettle, notebook, beans) below the text, filling the lower half edge to edge */}
      <div style={{ position: "absolute", left: 0, top: L.stillTop - 860, width: 1080, height: 1920 - (L.stillTop - 860), overflow: "hidden", opacity: prog(f, 0, 24) }}>
        <Img src={staticFile("looks/lab-end-still.png")} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, mixBlendMode: "darken" }} />
      </div>
      <LabHeading label={ending.lead} heading={ending.heading} accent={ep.accent} />
      <In at={12} style={{ top: L.linesTop, left: 96, right: 96 }}>
        {ending.lines.map((l) => (
          <div key={l} style={T(END.lineSize, 500, INK)}>
            {l}
          </div>
        ))}
        <div style={{ height: 2, background: RULE, margin: "32px 0 24px" }} />
      </In>
      {ending.next ? (
        <In at={22} style={{ top: L.nextTop, left: 96, right: 96 }}>
          <div style={T(END.labelSize, 500, GREY)}>次回</div>
          <div style={{ ...T(END.nextSize, 700, ep.accent), display: "inline-block", borderBottom: `3px solid ${ep.accent}` }}>{ending.next}</div>
        </In>
      ) : null}
      <In at={30} style={{ top: L.signatureTop, left: 96, ...T(END.signatureSize, 500, GREY, { letterSpacing: "0.14em" }) }}>
        OPEN GROUND COFFEE ROASTERS
      </In>
    </LabFrame>
  );
};
