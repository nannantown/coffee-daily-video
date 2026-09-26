/**
 * Which look the daily video is drawn in, and whether today's episode has its
 * picture. The looks (src/looks/) draw each episode over a plate
 * public/looks/<look>-<subject>.png (subject per episode: src/looks/art.ts). A
 * missing plate would fail the render and the morning post, so the pipeline
 * asks here first and falls back to the classic cards instead (review
 * 2026-09-26). Read from the TypeScript sources so there is one list.
 */
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(rootDir, rel), "utf-8");

export function productionLook() {
  const m = read("src/looks/LookVideo.tsx").match(/export const PRODUCTION_LOOK: Look \| null = (null|"(\w+)");/);
  if (!m) throw new Error("PRODUCTION_LOOK not found in src/looks/LookVideo.tsx");
  return m[2] ?? null;
}

export function episodeSubjects() {
  const art = read("src/looks/art.ts");
  return Object.fromEntries([...art.slice(art.indexOf("EPISODE_SUBJECT")).matchAll(/^\s+"([a-z0-9-]+)": "([a-z-]+)",$/gm)].map((m) => [m[1], m[2]]));
}

export function platePath(look, episode) {
  const subject = episodeSubjects()[episode] ?? "cup"; // same default as subjectFor() in art.ts
  return join(rootDir, "public", "looks", `${look}-${subject}.png`);
}

/** null = fine; otherwise why today's episode cannot be drawn in the production look. */
export function plateProblem(episode, look = productionLook()) {
  if (!look) return null;
  const file = platePath(look, episode);
  return existsSync(file) ? null : `missing plate ${file}`;
}

/**
 * Files every episode of a look draws besides its own plate (review round 2:
 * a missing vessel / decoration / still life failed the render too). Keep in
 * step with src/looks/LabConte.tsx, PencilMotion.tsx and vessels.ts.
 */
export const LOOK_ASSETS = {
  lab: [
    "lab-decor-branch.png",
    "lab-decor-beans.png",
    "lab-decor-sprig.png",
    "lab-end-still.png",
    "lab-grinder.png",
    "lab-kettle.png",
    "lab-cup.png",
    "lab-vessel-server.png",
    "lab-vessel-server-mask.png",
    "lab-vessel-dripper.png",
    "lab-vessel-dripper-mask.png",
    "lab-vessel-cups.png",
    "lab-vessel-cups-mask-left.png",
    "lab-vessel-cups-mask-right.png",
  ],
};

/** null = fine; otherwise the first file the look needs that is missing. */
export function lookAssetProblem(look = productionLook()) {
  for (const f of LOOK_ASSETS[look] ?? []) {
    const file = join(rootDir, "public", "looks", f);
    if (!existsSync(file)) return `missing look asset ${file}`;
  }
  return null;
}
