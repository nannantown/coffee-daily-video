import type { CoffeeCardsProps } from "./types";

// Studio preview only (`npx remotion studio`). The pipeline always passes
// real props built by scripts/content-format.mjs.
// No `withAudio` here on purpose: Remotion merges defaultProps under the
// input props, so a default of false would silently mute production renders.
export const defaultCardsProps: CoffeeCardsProps = {
  format: "brew-lesson",
  slides: [
    {
      kind: "lesson-title",
      heading: "湯温",
      series: "初級 第6回",
      date: "2026.09.23",
      hook: "湯温を3度下げる",
      topic: "苦味が引いて酸が立つ",
      why: "温度が高いほど苦味成分が多く溶ける",
      methodLabel: "V60",
      sceneLabel: "ホット",
      tiles: [
        { label: "粉", value: "15", unit: "g" },
        { label: "お湯", value: "240", unit: "g" },
        { label: "湯温", value: "88", unit: "℃" },
        { label: "時間", value: "2:30", unit: "" },
        { label: "挽き目", value: "中細", unit: "" },
        { label: "比率", value: "1対16", unit: "" },
      ],
      narration: "",
    },
    {
      kind: "lesson-visual",
      heading: "目盛りで見る",
      visual: {
        type: "scale",
        caption: "下げるほど苦味が控えめ",
        label: "湯温",
        unit: "℃",
        min: 80,
        max: 100,
        from: 91,
        to: 88,
        zones: [
          { upTo: 86, label: "軽い" },
          { upTo: 94, label: "標準" },
          { upTo: 100, label: "苦め" },
        ],
      },
      narration: "",
    },
    {
      kind: "lesson-steps",
      heading: "手順",
      steps: [
        { time: "0:00", action: "蒸らす", amount: "45g" },
        { time: "0:40", action: "2投目", amount: "150g" },
        { time: "1:20", action: "3投目", amount: "240g" },
        { time: "2:30", action: "落ち切り", amount: "" },
      ],
      narration: "",
    },
    {
      kind: "lesson-taste",
      heading: "こう変わる",
      notes: ["軽い苦味", "明るい酸"],
      summary: "後味がすっきりする",
      meters: [
        { label: "酸味", value: 4 },
        { label: "甘み", value: 3 },
        { label: "コク", value: 2 },
      ],
      narration: "",
    },
    {
      kind: "lesson-tips",
      heading: "うまくいかない時",
      tips: [
        { problem: "酸っぱい時", fix: "湯温を92度に戻す" },
        { problem: "薄い時", fix: "粉を1g増やす" },
      ],
      narration: "",
    },
  ],
  ending: {
    kind: "lesson-cta",
    heading: "保存して、次に淹れる時に試そう",
    topic: "苦味が引いて酸が立つ",
    lead: "毎朝ひとつ、今日から試せる抽出のコツ",
    lines: ["保存して、淹れる前に見返す", "フォローで、明日もひとつ持ち帰る"],
    next: "30秒早く止める",
    narration: "",
  },
  timeline: { slides: [240, 150, 150, 150, 180], ending: 120, total: 990 },
};
