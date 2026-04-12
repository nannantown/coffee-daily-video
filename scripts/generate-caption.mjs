/**
 * Generate platform-specific captions from trending data.
 * Reads optimization hints (if available) to improve hashtags and titles.
 *
 * Input:  output/trending-data.json, output/optimization-hints.json (optional)
 * Output: output/captions.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", "output");

function getDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { full: `${y}/${m}/${day}`, compact: `${y}${m}${day}` };
}

function loadOptimizationHints() {
  const hintsPath = join(outputDir, "optimization-hints.json");
  if (!existsSync(hintsPath)) return null;
  try {
    return JSON.parse(readFileSync(hintsPath, "utf-8"));
  } catch {
    return null;
  }
}

function generateHashtags(projects, hints) {
  let base;

  if (hints?.recommendedHashtags && hints.recommendedHashtags.length > 0) {
    // Use optimized hashtags from analytics
    base = hints.recommendedHashtags.map((h) =>
      h.startsWith("#") ? h : `#${h}`
    );
    console.log(`  Using optimized hashtags (${base.length} tags)`);
  } else {
    // Default hashtags for coffee content
    base = [
      "#コーヒー",
      "#Coffee",
      "#コーヒー豆知識",
      "#スペシャルティコーヒー",
      "#カフェ",
      "#珈琲",
      "#コーヒー好き",
      "#CoffeeLovers",
      "#Shorts",
    ];
  }

  // Add language-specific tags
  const langs = new Set(projects.map((p) => p.language).filter(Boolean));
  for (const lang of langs) {
    const tag = `#${lang}`;
    if (!base.includes(tag)) {
      base.push(tag);
    }
  }

  // Remove dropped hashtags
  if (hints?.droppedHashtags?.length > 0) {
    const dropped = new Set(
      hints.droppedHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`))
    );
    base = base.filter((h) => !dropped.has(h));
  }

  return base;
}

function generateTitle(data, dateStr, hints) {
  const template = hints?.recommendedTitleTemplate || "standard";
  const topProject = data.projects[0];

  switch (template) {
    case "highlight":
      return `${topProject.name}｜今日のコーヒー豆知識｜${dateStr.full} #Shorts`;

    case "emoji":
      return `Coffee Daily｜${dateStr.full} #Shorts`;

    case "standard":
    default:
      return `【コーヒー豆知識】${topProject.name}｜${dateStr.full} #Shorts`;
  }
}

function generateYouTubeCaption(data, dateStr, hints) {
  const { projects } = data;
  const hashtags = generateHashtags(projects, hints);
  const title = generateTitle(data, dateStr, hints);
  const titleTemplate = hints?.recommendedTitleTemplate || "standard";

  // Description
  const lines = [
    `${dateStr.full} のコーヒー豆知識をお届けします。`,
    "",
    "--- 今日のトピック ---",
    "",
  ];

  for (const p of projects) {
    lines.push(`${p.name}`);
    lines.push(`  ${p.description}`);
    if (p.detail) lines.push(`  ${p.detail}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("毎日コーヒーの豆知識をお届けします。");
  lines.push("チャンネル登録 & いいね お願いします。");
  lines.push("");
  lines.push(hashtags.join(" "));

  return {
    title,
    titleTemplate,
    description: lines.join("\n"),
    tags: hashtags.map((h) => h.replace("#", "")),
    categoryId: "26", // Howto & Style
  };
}

function generateInstagramCaption(data, dateStr, hints) {
  const { projects } = data;
  const hashtags = generateHashtags(projects, hints);

  const lines = [
    `${dateStr.full} コーヒー豆知識`,
    "",
  ];

  for (const p of projects) {
    lines.push(`${p.name}`);
    lines.push(`${p.description}`);
  }

  lines.push("");
  lines.push("毎日コーヒーの豆知識をお届けします。");
  lines.push("フォロー & いいね でチェック!");
  lines.push("");
  lines.push(hashtags.join(" "));

  return lines.join("\n");
}

function main() {
  const dataPath = join(outputDir, "trending-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const dateStr = getDateStr();

  // Load optimization hints (from fetch-stats.mjs, if available)
  const hints = loadOptimizationHints();
  if (hints) {
    console.log(`  Optimization hints loaded (${hints.videoCount} videos analyzed)`);
    console.log(`  Recommended title template: ${hints.recommendedTitleTemplate}`);
  }

  const captions = {
    date: dateStr,
    youtube: generateYouTubeCaption(data, dateStr, hints),
    instagram: generateInstagramCaption(data, dateStr, hints),
  };

  const outputPath = join(outputDir, "captions.json");
  writeFileSync(outputPath, JSON.stringify(captions, null, 2));
  console.log(`Captions → ${outputPath}`);
  console.log(`  YouTube title: ${captions.youtube.title}`);
  console.log(`  Title template: ${captions.youtube.titleTemplate}`);
  console.log(`  Instagram: ${captions.instagram.length} chars`);
}

main();
