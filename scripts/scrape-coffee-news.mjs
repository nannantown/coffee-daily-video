/**
 * Select today's coffee knowledge topic.
 * Cycles through the knowledge database based on day of year.
 * Output: output/raw-coffee-news.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outputDir = join(rootDir, "output");
const knowledgePath = join(rootDir, "data", "coffee-knowledge.json");

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function main() {
  mkdirSync(outputDir, { recursive: true });

  const knowledge = JSON.parse(readFileSync(knowledgePath, "utf-8"));
  const dayOfYear = getDayOfYear();
  const todayIndex = dayOfYear % knowledge.length;
  const topic = knowledge[todayIndex];

  console.log(`Today's coffee topic (#${todayIndex + 1}/${knowledge.length}):`);
  console.log(`  ${topic.title} [${topic.category}]`);
  console.log(`  ${topic.description}`);

  // Format as a single article for the pipeline
  const articles = [
    {
      rank: 1,
      title: topic.title,
      description: topic.description,
      detail: topic.detail,
      source: topic.category,
      tags: topic.tags,
      link: "",
      pubDate: new Date().toISOString(),
    },
  ];

  const outputPath = join(outputDir, "raw-coffee-news.json");
  writeFileSync(outputPath, JSON.stringify(articles, null, 2));
  console.log(`\nSaved to ${outputPath}`);
}

main();
