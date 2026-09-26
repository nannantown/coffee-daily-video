import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { episodeSubjects, platePath, plateProblem, productionLook } from "./looks-plates.mjs";

// The looks (src/looks/) draw each episode over a plate picked by subject
// (src/looks/art.ts). A missing plate would fail the render, so the production
// look must have a plate for every episode (and the pipeline falls back to the
// classic cards if one still goes missing).

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const curriculum = JSON.parse(readFileSync(join(rootDir, "data/curriculum.json"), "utf-8"));
const subjects = episodeSubjects();

test("every curriculum episode has a subject, and neighbours never share one", () => {
  const ids = curriculum.episodes.map((e) => e.id);
  for (const id of ids) assert.ok(subjects[id], `${id} has no subject in src/looks/art.ts`);
  ids.forEach((id, i) => i > 0 && assert.notEqual(subjects[id], subjects[ids[i - 1]], `${ids[i - 1]} and ${id} share a picture`));
});

test("the production look has a plate for every episode", () => {
  const look = productionLook();
  if (!look) return; // classic cards, no plates needed
  for (const e of curriculum.episodes) assert.ok(existsSync(platePath(look, e.id)), `${e.id}: ${platePath(look, e.id)} is missing`);
});

test("a missing plate is reported (the pipeline then renders the classic cards)", () => {
  assert.equal(plateProblem("b06-temp", null), null);
  assert.equal(plateProblem("b06-temp", "lab"), null);
  assert.match(plateProblem("b06-temp", "nosuchlook"), /missing plate/);
});

test("every file the production look draws is present and committed", async () => {
  const { LOOK_ASSETS, lookAssetProblem } = await import("./looks-plates.mjs");
  const look = productionLook();
  if (!look) return;
  assert.equal(lookAssetProblem(look), null);
  const { execFileSync } = await import("node:child_process");
  const tracked = new Set(execFileSync("git", ["ls-files", "public/looks"], { cwd: rootDir }).toString().trim().split("\n"));
  for (const f of LOOK_ASSETS[look]) assert.ok(tracked.has(`public/looks/${f}`), `public/looks/${f} is not committed`);
  for (const e of curriculum.episodes) assert.ok(tracked.has(`public/looks/${look}-${subjects[e.id]}.png`), `${e.id}: plate not committed`);
  // every file named in the look's sources is in the list (or is a subject plate)
  const src = ["src/looks/LabConte.tsx", "src/looks/PencilMotion.tsx", "src/looks/vessels-data.mjs"].map((p) => readFileSync(join(rootDir, p), "utf-8")).join("\n");
  for (const m of src.matchAll(/"(?:looks\/)?(lab-[a-z-]+\.png)"/g)) assert.ok(LOOK_ASSETS.lab.includes(m[1]), `${m[1]} is used but not in LOOK_ASSETS`);
});
