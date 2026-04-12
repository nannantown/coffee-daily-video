export interface Project {
  rank: number;
  name: string;
  fullName: string;
  description: string;
  detail: string;
  narration: string;
  stars: number;
  todayStars: number;
  language?: string;
  url: string;
}

export const defaultProjects: Project[] = [
  {
    rank: 1,
    name: "イルガチェフェ",
    fullName: "産地",
    description: "エチオピア産の華やかなフレーバー",
    detail:
      "エチオピアのイルガチェフェ地方で栽培されるコーヒー豆。フローラルでフルーティーな風味が特徴で、ジャスミンやベルガモットのようなアロマが楽しめます。浅煎りで淹れると、紅茶のようなエレガントな一杯に。",
    narration:
      "今日のコーヒー豆知識。イルガチェフェ。エチオピア産の華やかなフレーバーが特徴のコーヒーです。フローラルでフルーティーな風味を、浅煎りでお楽しみください。",
    stars: 0,
    todayStars: 0,
    language: "産地",
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

// Default durations for local dev / Remotion Studio (1 project = coffee knowledge)
export const defaultDurations: AudioDurations = {
  opening: 5.0,
  "project-1": 12.5,
  ending: 6.5,
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
