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
      episode: "b06-temp",
      pillar: "temp",
      series: "初級 第6回",
      date: "2026.09.27",
      word: "湯温",
      ask: "を下げると？",
      topic: "苦味が引いて酸が立つ",
      methodLabel: "V60",
      sceneLabel: "ホット",
      narration: "",
    },
    {
      kind: "lesson-why",
      heading: "なぜ変わる？",
      hook: "お湯の温度を下げる",
      why: "熱いほど苦味の成分がよく溶ける",
      narration: "",
    },
    {
      kind: "lesson-visual",
      heading: "目盛りで見る",
      visual: {
        type: "scale",
        caption: "下げるほど苦味が控えめ",
        label: "湯温",
        zones: ["低め", "ふつう", "高め"],
        from: 60,
        to: 35,
      },
      narration: "",
    },
    {
      kind: "lesson-effect",
      heading: "味はこう変わる",
      sides: [
        { label: "下げる", taste: "苦味が引き、すっきり" },
        { label: "上げる", taste: "苦味とコクが増える" },
      ],
      narration: "",
    },
    {
      kind: "lesson-tips",
      heading: "うまくいかない時",
      tips: [
        { problem: "酸っぱい時", fix: "温度を少し戻す" },
        { problem: "まだ苦い時", fix: "挽き目も少し粗くする" },
      ],
      narration: "",
    },
  ],
  ending: {
    kind: "lesson-cta",
    heading: "保存して、次に淹れる時に試そう",
    topic: "苦味が引いて酸が立つ",
    lead: "毎朝ひとつ、味を動かすコツ",
    lines: ["保存して、淹れる前に見返す", "フォローで、明日もひとつ持ち帰る"],
    next: "早く止めるとどうなる？",
    narration: "",
  },
  timeline: { slides: [150, 150, 150, 150, 150], ending: 120, total: 870 },
};
