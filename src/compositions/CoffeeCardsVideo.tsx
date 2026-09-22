import React from "react";
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { NewsCover, NewsItem } from "../cards/NewsSlides";
import {
  CtaSlide,
  RecipeSteps,
  RecipeTaste,
  RecipeTips,
  RecipeTitle,
} from "../cards/RecipeSlides";
import { COLORS } from "../cards/theme";
import type { CardSlide, CoffeeCardsProps } from "../cards/types";

const SlideView: React.FC<{ slide: CardSlide; page: string; index: number }> = ({
  slide,
  page,
  index,
}) => {
  switch (slide.kind) {
    case "recipe-title":
      return <RecipeTitle slide={slide} index={index} />;
    case "recipe-steps":
      return <RecipeSteps slide={slide} page={page} index={index} />;
    case "recipe-taste":
      return <RecipeTaste slide={slide} page={page} index={index} />;
    case "recipe-tips":
      return <RecipeTips slide={slide} page={page} index={index} />;
    case "news-cover":
      return <NewsCover slide={slide} index={index} />;
    case "news-item":
      return <NewsItem slide={slide} page={page} index={index} />;
    default:
      return null;
  }
};

/**
 * "今日の一杯" recipe cards / weekly news TOP5. Text-only slides; narration
 * is audio only (the cards carry the information, so no subtitle overlay).
 * Segment lengths come from props.timeline (scripts/content-format.mjs
 * computeCardTimeline), audio files from scripts/generate-audio.mjs.
 */
export const CoffeeCardsVideo: React.FC<CoffeeCardsProps> = ({ slides, ending, timeline, withAudio = true }) => {
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
