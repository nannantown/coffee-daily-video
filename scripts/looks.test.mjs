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
