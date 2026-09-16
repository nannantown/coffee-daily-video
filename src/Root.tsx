import React from "react";
import { Composition } from "remotion";
import { TrendingVideo, Props } from "./compositions/TrendingVideo";
import {
  defaultProjects,
  defaultDurations,
  calculateFrameDurations,
} from "./data";
import { CoffeeCardsVideo } from "./compositions/CoffeeCardsVideo";
import { defaultCardsProps } from "./cards/defaults";
import type { CoffeeCardsProps } from "./cards/types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 「今日の一杯」レシピカード + 日曜のニュース TOP5 (data has `format`) */}
      <Composition
        id="CoffeeCardsVideo"
        component={
          CoffeeCardsVideo as unknown as React.FC<Record<string, unknown>>
        }
        durationInFrames={defaultCardsProps.timeline.total}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultCardsProps as unknown as Record<string, unknown>}
        calculateMetadata={async ({ props }) => {
          const p = props as unknown as CoffeeCardsProps;
          return { durationInFrames: p.timeline?.total || defaultCardsProps.timeline.total };
        }}
      />
      {/* Legacy news explainer (content JSON without `format`) */}
      <Composition
        id="CoffeeVideo"
        component={
          TrendingVideo as unknown as React.FC<Record<string, unknown>>
        }
        durationInFrames={calculateFrameDurations(defaultDurations).total}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          projects: defaultProjects,
          audioDurations: defaultDurations,
        }}
        calculateMetadata={async ({ props }) => {
          const p = props as unknown as Props;
          const d = p.audioDurations || defaultDurations;
          return { durationInFrames: calculateFrameDurations(d).total };
        }}
      />
    </>
  );
};
