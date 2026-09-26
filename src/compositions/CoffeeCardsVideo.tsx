import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import {
  CtaSlide,
  LessonEffect,
  LessonWhy,
  LessonTips,
  LessonTitle,
} from "../cards/LessonSlides";
import { LessonVisualView } from "../cards/Diagrams";
import { COLORS } from "../cards/theme";
import type { CardSlide, CoffeeCardsProps } from "../cards/types";
import { LookVideo, PRODUCTION_LOOK } from "../looks/LookVideo";

const SlideView: React.FC<{ slide: CardSlide; page: string; index: number }> = ({
  slide,
  page,
  index,
}) => {
  switch (slide.kind) {
    case "lesson-title":
      return <LessonTitle slide={slide} index={index} />;
    case "lesson-visual":
      return <LessonVisualView slide={slide} page={page} index={index} />;
    case "lesson-why":
      return <LessonWhy slide={slide} page={page} index={index} />;
    case "lesson-effect":
      return <LessonEffect slide={slide} page={page} index={index} />;
    case "lesson-tips":
      return <LessonTips slide={slide} page={page} index={index} />;
    default:
      return null;
  }
};

/**
 * 「今日の抽出メモ」 — one episode of the series 「味をコントロールする技術」 a day
 * (data/curriculum.json): cover, why, diagram (src/cards/Diagrams.tsx), both ways, tips;
 * narration is audio only (the cards carry the information, so no subtitle
 * overlay). Segment lengths come from props.timeline (scripts/content-format.mjs
 * computeCardTimeline), audio files from scripts/generate-audio.mjs.
 */
export const CoffeeCardsVideo: React.FC<CoffeeCardsProps> = (props) => {
  // A look passed in the props (previews of a candidate) wins over the production one.
  const look = props.look === "classic" ? null : (props.look ?? PRODUCTION_LOOK);
  if (look) return <LookVideo {...props} look={look} />;
  const { slides, ending, timeline, withAudio = true } = props;
  const pages = slides.length + 1;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {withAudio ? <Audio src={staticFile("audio/bgm.wav")} volume={0.12} /> : null}
      <Series>
        {slides.map((slide, i) => (
          <Series.Sequence key={`${slide.kind}-${i}`} durationInFrames={timeline.slides[i] ?? 150}>
            <SlideView slide={slide} page={`${i + 1} / ${pages}`} index={i} />
            {withAudio ? <Audio src={staticFile(`audio/project-${i + 1}.mp3`)} volume={1} /> : null}
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={timeline.ending}>
          <CtaSlide ending={ending} index={slides.length} />
          {withAudio ? <Audio src={staticFile("audio/ending.mp3")} volume={1} /> : null}
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
