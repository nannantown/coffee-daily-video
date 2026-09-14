import type { CoffeeCardsProps } from "./types";

// Studio preview only (`npx remotion studio`). The pipeline always passes
// real props built by scripts/content-format.mjs.
// No `withAudio` here on purpose: Remotion merges defaultProps under the
// input props, so a default of false would silently mute production renders.
export const defaultCardsProps: CoffeeCardsProps = {
  format: "recipe",
  slides: [
    {
      kind: "recipe-title",
      heading: "今日の一杯",
      date: "2026.09.15",
      beanName: "イルガチェフェ コチャレ",
      beanMeta: "エチオピア・ウォッシュド・浅煎り",
      methodLabel: "V60",
      sceneLabel: "ホット",
      hook: "浅煎りが酸っぱい人のV60",
      tiles: [
        { label: "豆", value: "15", unit: "g" },
        { label: "お湯", value: "225", unit: "g" },
        { label: "湯温", value: "93", unit: "℃" },
        { label: "時間", value: "2:30", unit: "" },
        { label: "挽き目", value: "中細挽き", unit: "" },
        { label: "比率", value: "1:15", unit: "" },
      ],
      narration: "",
    },
    {
      kind: "recipe-steps",
      heading: "手順",
      steps: [
        { time: "0:00", action: "蒸らし", amount: "45g" },
        { time: "0:45", action: "2投目", amount: "135g" },
        { time: "1:15", action: "3投目", amount: "225g" },
        { time: "2:30", action: "落ち切り", amount: "" },
      ],
      narration: "",
    },
    {
      kind: "recipe-taste",
      heading: "味わい",
      notes: ["レモン", "シトラス", "甘い余韻"],
      summary: "酸味が甘さに変わる一杯",
      meters: [
        { label: "酸味", value: 3 },
        { label: "甘み", value: 4 },
        { label: "コク", value: 2 },
      ],
      narration: "",
    },
    {
      kind: "recipe-tips",
      heading: "悩み別のコツ",
      tips: [
        { problem: "酸っぱい時", fix: "湯温を2℃上げて95℃に" },
        { problem: "苦い時", fix: "挽き目を1段粗くする" },
        { problem: "薄い時", fix: "豆を1g増やして16gに" },
      ],
      narration: "",
    },
  ],
  ending: {
    kind: "recipe-cta",
    heading: "保存して、淹れる時に見返そう",
    beanName: "エチオピア イルガチェフェ コチャレ ウォッシュド",
    lead: "この豆は OPEN GROUND で販売中",
    lines: ["ご購入・卸のご相談は DM へ", "@open_ground_coffee_roasters"],
    narration: "",
  },
  timeline: { slides: [240, 150, 150, 180], ending: 120, total: 840 },
};
