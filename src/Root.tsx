import React from "react";
import { Composition } from "remotion";
import { CoffeeCardsVideo } from "./compositions/CoffeeCardsVideo";
import { defaultCardsProps } from "./cards/defaults";
import type { CoffeeCardsProps } from "./cards/types";
import { DIRECTION_FRAMES, DirectionPreview } from "./directions/Directions";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 「今日の抽出メモ」 — 汎用抽出知識カード (data/enriched-coffee-news.json) */}
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
      {/* 2026-09-26 redesign: the three candidate looks, preview only (scripts/render-directions.mjs) */}
      <Composition
        id="DirectionPreview"
        component={DirectionPreview as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={DIRECTION_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ direction: "A", episodeIndex: 0 }}
      />
    </>
  );
};
