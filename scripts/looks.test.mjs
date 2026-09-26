import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The looks (src/looks/) draw each episode over a plate picked by subject
// (src/looks/art.ts). A missing plate would fail the render and the morning
// post, so the production look must have a plate for every episode.

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(rootDir, rel), "utf-8");
const curriculum = JSON.parse(read("data/curriculum.json"));
const art = read("src/looks/art.ts");
const subjects = Object.fromEntries(
  [...art.slice(art.indexOf("EPISODE_SUBJECT")).matchAll(/^\s+"([a-z0-9-]+)": "([a-z-]+)",$/gm)].map((m) => [m[1], m[2]])
);
const productionLook = read("src/looks/LookVideo.tsx").match(/export const PRODUCTION_LOOK: Look \| null = (null|"(\w+)");/);

test("every curriculum episode has a subject, and neighbours never share one", () => {
  const ids = curriculum.episodes.map((e) => e.id);
  for (const id of ids) assert.ok(subjects[id], `${id} has no subject in src/looks/art.ts`);
  ids.forEach((id, i) => i > 0 && assert.notEqual(subjects[id], subjects[ids[i - 1]], `${ids[i - 1]} and ${id} share a picture`));
});

test("the production look has a plate for every episode", () => {
  assert.ok(productionLook, "PRODUCTION_LOOK not found in src/looks/LookVideo.tsx");
  const look = productionLook[2];
  if (!look) return; // classic cards, no plates needed
  for (const [id, subject] of Object.entries(subjects)) {
    assert.ok(existsSync(join(rootDir, "public", "looks", `${look}-${subject}.png`)), `${id}: public/looks/${look}-${subject}.png is missing`);
  }
});
