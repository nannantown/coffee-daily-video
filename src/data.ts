export interface Project {
  rank: number;
  name: string;
  fullName: string;
  description: string;
  detail: string;
  narration: string;
  category?: string;
  url: string;
}

export const defaultProjects: Project[] = [
  {
    rank: 1,
    name: "エチオピア イルガチェフェ",
    fullName: "産地",
    description: "コーヒー発祥の地エチオピアを代表する銘柄",
    detail: "",
    narration:
      "今日のコーヒー豆知識。エチオピア、イルガチェフェ。コーヒー発祥の地エチオピアを代表する銘柄。フローラルで紅茶のような華やかな香りが特徴です。",
    category: "産地",
    url: "",
  },
  {
    rank: 2,
    name: "産地と特徴",
    fullName: "産地",
    description: "イルガチェフェの産地と栽培環境",
    detail: "",
    narration:
      "標高1800メートルから2200メートルの高地で栽培され、ウォッシュド精製が主流。ジャスミンやベルガモットのような花の香り、レモンやピーチのような果実味が楽しめます。浅煎りでその個性が最も引き立ちます。",
    category: "産地",
    url: "",
  },
  {
    rank: 3,
    name: "おすすめポイント",
    fullName: "産地",
    description: "イルガチェフェの楽しみ方",
    detail: "",
    narration:
      "この豆のキーワードは、アフリカ、フローラル、浅煎り向き。ぜひ試してみてください。",
    category: "産地",
    url: "",
  },
];

// Narrations for opening and ending
export const openingNarration =
  "今日のコーヒー豆知識をお届けします。";
export const endingNarration =
  "以上、今日のコーヒー豆知識でした。フォローといいねで、毎日のコーヒー情報をチェックしましょう。";

// Subtitle data (word boundaries from Edge TTS)
export interface WordBoundary {
  offset: number;
  duration: number;
  text: string;
}

export interface SubtitleEntry {
  text: string;
  words: WordBoundary[];
}

export interface SubtitleMap {
  [key: string]: SubtitleEntry;
}

// Audio durations (seconds per audio file)
// Keys: "opening", "project-1" .. "project-N", "ending"
export interface AudioDurations {
  opening: number;
  ending: number;
  [key: string]: number;
}

// Default durations for local dev (3 sections: hook, origin, recommend)
export const defaultDurations: AudioDurations = {
  opening: 4.0,
  "project-1": 12.0,
  "project-2": 18.0,
  "project-3": 8.0,
  ending: 6.0,
};

const FPS = 30;
const PADDING = 15; // 0.5s padding after audio
const ENDING_EXTRA = 30; // 1s extra for ending

export function getProjectCount(d: AudioDurations): number {
  let count = 0;
  while (d[`project-${count + 1}`] !== undefined) count++;
  return Math.max(count, 1);
}

export function calculateFrameDurations(d: AudioDurations) {
  const opening = Math.ceil(d.opening * FPS) + PADDING;
  const count = getProjectCount(d);
  const projects: number[] = [];
  for (let i = 1; i <= count; i++) {
    const dur = d[`project-${i}`];
    projects.push(Math.ceil((dur || 10) * FPS) + PADDING);
  }
  const ending = Math.ceil(d.ending * FPS) + ENDING_EXTRA;
  const total = opening + projects.reduce((a, b) => a + b, 0) + ending;
  return { opening, projects, ending, total };
}
