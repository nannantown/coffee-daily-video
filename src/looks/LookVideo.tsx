import React from "react";
import { AbsoluteFill, Audio, Easing, Img, interpolate, Series, staticFile, useCurrentFrame } from "remotion";
import { DiagramBody } from "../cards/Diagrams";
import { type Ink, InkContext } from "../cards/ink";
import { FONT_FAMILY, PHRASE_BREAK } from "../cards/theme";
import type { CardSlide, CoffeeCardsProps, CtaEnding, LessonTipsSlide, LessonVisualSlide } from "../cards/types";
import { subjectFor, toneFor } from "./art";
import { type Look, type LookEpisode, LOOK_SCENES, SIZE } from "./Looks";

/**
 * The whole episode in one of the round-2 looks (src/looks/Looks.tsx): cover,
 * why, diagram, both ways, tips and the save / follow ending. The picture is
 * the episode's plate (public/looks/<look>-<subject>.png, src/looks/art.ts);
 * the diagram is the same drawing as before (src/cards/Diagrams.tsx), inked
 * with the look's colours.
 */

const clampType = (size: keyof typeof SIZE, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: SIZE[size],
  fontWeight: weight,
  color,
  lineHeight: size === "body" ? 1.5 : 1.4,
  letterSpacing: size === "head" ? "0.02em" : "0.04em",
  fontFeatureSettings: '"palt"',
  ...PHRASE_BREAK,
  ...extra,
});

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

interface Theme {
  ink: Ink;
  head: string;
  sub: string;
  mark: string;
  /** Background of the text-heavy scenes (diagram, tips); the ending always shows the plate. */
  quiet: (ep: LookEpisode) => React.ReactNode;
  plate: (ep: LookEpisode) => React.ReactNode;
}

const PAPER = "#F3F0EA";
const plateImg = (ep: LookEpisode, overlay?: string) => (
  <AbsoluteFill>
    <Img src={staticFile(`looks/${ep.plate}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {overlay ? <AbsoluteFill style={{ background: overlay }} /> : null}
  </AbsoluteFill>
);

export function themeFor(look: Look, ep: LookEpisode): Theme {
  if (look === "lab") {
    return {
      ink: { text: "#22201C", textSub: "rgba(34,32,28,0.8)", textMuted: "#6B655C", surface: "#FFFFFF", pill: "#EAE4D8", hairline: "#D6D0C4", bg: PAPER },
      head: "#22201C",
      sub: "#6B655C",
      mark: ep.accent,
      quiet: () => <AbsoluteFill style={{ background: PAPER }} />,
      plate: (e) => <AbsoluteFill style={{ background: PAPER }}>{plateImg(e)}</AbsoluteFill>,
    };
  }
  if (look === "photo") {
    return {
      ink: { text: "#FFFFFF", textSub: "rgba(255,255,255,0.82)", textMuted: "rgba(255,255,255,0.64)", surface: "rgba(255,255,255,0.1)", pill: "rgba(20,16,12,0.7)", hairline: "rgba(255,255,255,0.2)", bg: "#1C1511" },
      head: "#FFFFFF",
      sub: "rgba(255,255,255,0.78)",
      mark: "#E3B37A",
      quiet: (e) => <AbsoluteFill style={{ background: "#1C1511" }}>{plateImg(e, "rgba(20,16,12,0.82)")}</AbsoluteFill>,
      plate: (e) => <AbsoluteFill style={{ background: "#1C1511" }}>{plateImg(e, "linear-gradient(180deg, rgba(20,16,12,0.72) 0%, rgba(20,16,12,0.45) 55%, rgba(20,16,12,0.2) 80%)")}</AbsoluteFill>,
    };
  }
  return {
    ink: { text: ep.deep, textSub: rgba(ep.deep, 0.82), textMuted: rgba(ep.deep, 0.64), surface: "rgba(255,255,255,0.34)", pill: "rgba(255,255,255,0.45)", hairline: rgba(ep.deep, 0.2), bg: ep.field },
    head: ep.deep,
    sub: rgba(ep.deep, 0.72),
    mark: ep.deep,
    quiet: (e) => <AbsoluteFill style={{ background: e.field }} />,
    plate: (e) => <AbsoluteFill style={{ background: e.field }}>{plateImg(e)}</AbsoluteFill>,
  };
}

/** Placed text with the looks' quiet entrance (fade + 24px rise), `at` frames in. */
const At: React.FC<{ top: number; at?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ top, at = 0, children, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return <div style={{ position: "absolute", top, left: 96, right: 96, opacity: p, transform: `translateY(${(1 - p) * 24}px)`, ...style }}>{children}</div>;
};

const VisualScene: React.FC<{ look: Look; ep: LookEpisode; slide: LessonVisualSlide }> = ({ look, ep, slide }) => {
  const t = themeFor(look, ep);
  return (
    <AbsoluteFill style={{ color: t.ink.text }}>
      {t.quiet(ep)}
      <At top={300} style={clampType("aux", 500, t.sub)}>
        {slide.heading}
      </At>
      <InkContext.Provider value={t.ink}>
        <div style={{ position: "absolute", top: 380, left: 96, width: 888, display: "flex", flexDirection: "column", gap: 48 }}>
          <DiagramBody v={slide.visual} />
          <div style={clampType("body", 700, t.head)}>{slide.visual.caption}</div>
        </div>
      </InkContext.Provider>
    </AbsoluteFill>
  );
};

const TipsScene: React.FC<{ look: Look; ep: LookEpisode; slide: LessonTipsSlide }> = ({ look, ep, slide }) => {
  const t = themeFor(look, ep);
  return (
    <AbsoluteFill>
      {t.quiet(ep)}
      <At top={300} style={clampType("aux", 500, t.sub)}>
        {ep.word}
        {ep.ask}
      </At>
      <At top={380} at={4} style={clampType("head", 700, t.head)}>
        {slide.heading}
      </At>
      {slide.tips.map((tip, i) => (
        <At key={tip.problem} top={560 + i * 210} at={12 + i * 10} style={{ right: 176 }}>
          <div style={{ height: 2, background: t.ink.hairline, marginBottom: 26 }} />
          <div style={clampType("aux", 500, t.mark)}>{tip.problem}</div>
          <div style={clampType("body", 700, t.head, { marginTop: 6 })}>→ {tip.fix}</div>
        </At>
      ))}
    </AbsoluteFill>
  );
};

const EndingScene: React.FC<{ look: Look; ep: LookEpisode; ending: CtaEnding }> = ({ look, ep, ending }) => {
  const t = themeFor(look, ep);
  return (
    <AbsoluteFill>
      {look === "photo" ? t.plate(ep) : t.quiet(ep)}
      <At top={300} style={clampType("aux", 500, t.sub)}>
        {ending.lead}
      </At>
      <At top={380} at={4} style={clampType("head", 700, t.head)}>
        {ending.heading}
      </At>
      <At top={600} at={10}>
        {ending.lines.map((l) => (
          <div key={l} style={clampType("body", 500, t.head)}>
            {l}
          </div>
        ))}
      </At>
      {ending.next ? (
        <At top={800} at={18}>
          <div style={clampType("aux", 500, t.sub)}>次回</div>
          <div style={clampType("body", 700, t.mark)}>{ending.next}</div>
        </At>
      ) : null}
      <At top={1000} at={24} style={clampType("aux", 500, t.sub, { letterSpacing: "0.12em" })}>
        OPEN GROUND COFFEE ROASTERS
      </At>
    </AbsoluteFill>
  );
};

/** The look's picture of this episode + the texts the cover / why / both-ways scenes show. */
export function lookEpisode(look: Look, slides: CardSlide[]): LookEpisode {
  const title = slides.find((s) => s.kind === "lesson-title");
  const why = slides.find((s) => s.kind === "lesson-why");
  const effect = slides.find((s) => s.kind === "lesson-effect");
  if (!title || title.kind !== "lesson-title") throw new Error("no cover slide");
  const tone = toneFor(title.episode, title.pillar);
  return {
    id: title.episode,
    pillar: title.pillar,
    series: title.series,
    word: title.word,
    ask: title.ask,
    topic: title.topic,
    hook: why?.kind === "lesson-why" ? why.hook : "",
    why: why?.kind === "lesson-why" ? why.why : "",
    effect: effect?.kind === "lesson-effect" ? effect.sides : [],
    ...tone,
    plate: `${look}-${subjectFor(title.episode)}.png`,
  };
}

const Scene: React.FC<{ look: Look; ep: LookEpisode; slide: CardSlide }> = ({ look, ep, slide }) => {
  const S = LOOK_SCENES[look];
  switch (slide.kind) {
    case "lesson-title":
      return <S.cover ep={ep} />;
    case "lesson-why":
      return <S.why ep={ep} />;
    case "lesson-visual":
      return <VisualScene look={look} ep={ep} slide={slide} />;
    case "lesson-effect":
      return <S.effect ep={ep} />;
    case "lesson-tips":
      return <TipsScene look={look} ep={ep} slide={slide} />;
    default:
      return null;
  }
};

export const LookVideo: React.FC<CoffeeCardsProps & { look: Look }> = ({ look, slides, ending, timeline, withAudio = true }) => {
  const ep = lookEpisode(look, slides);
  return (
    <AbsoluteFill lang="ja" style={{ fontFamily: FONT_FAMILY, background: "#000" }}>
      {withAudio ? <Audio src={staticFile("audio/bgm.wav")} volume={0.12} /> : null}
      <Series>
        {slides.map((slide, i) => (
          <Series.Sequence key={`${slide.kind}-${i}`} durationInFrames={timeline.slides[i] ?? 150}>
            <Scene look={look} ep={ep} slide={slide} />
            {withAudio ? <Audio src={staticFile(`audio/project-${i + 1}.mp3`)} volume={1} /> : null}
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={timeline.ending}>
          <EndingScene look={look} ep={ep} ending={ending} />
          {withAudio ? <Audio src={staticFile("audio/ending.mp3")} volume={1} /> : null}
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

/**
 * The look the daily video is drawn in. null = the classic dark cards
 * (src/cards/). Set once the owner picks a direction (2026-09-26 redesign).
 */
export const PRODUCTION_LOOK: Look | null = null;
