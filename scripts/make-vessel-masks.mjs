/**
 * Masks for the pencil vessels (src/looks/vessels.ts): the inside of each
 * drawn glass, flood-filled from its seed point, opaque white on transparent,
 * 1080x1920. The coffee colour is drawn through these masks.
 *
 * Usage: node scripts/make-vessel-masks.mjs [server|dripper|cups]
 */
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(rootDir, "src", "looks", "vessels.ts"), "utf-8");
const only = process.argv[2];
for (const [, name, body] of src.matchAll(/^  (server|dripper|cups): \{([\s\S]*?)^  \},/gm)) {
  if (only && name !== only) continue;
  const file = body.match(/file: "([^"]+)"/)[1];
  const masks = [...body.match(/masks: \[([^\]]+)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const seeds = [...body.match(/seeds: \[([\s\S]*?)\]/)[1].matchAll(/x: (\d+), y: (\d+)/g)].map((m) => [m[1], m[2]]);
  const fuzz = body.match(/fuzz: (\d+)/)?.[1] ?? "20";
  masks.forEach((mask, i) => {
    const [x, y] = seeds[i];
    execFileSync("magick", [
      join(rootDir, "public", "looks", file),
      "-resize", "1080x1920!",
      "-alpha", "off",
      "-fuzz", `${fuzz}%`,
      "-fill", "#FF00FF",
      "-draw", `color ${x},${y} floodfill`,
      "-fill", "black", "+opaque", "#FF00FF",
      "-fill", "white", "-opaque", "#FF00FF",
      "-morphology", "Close", "Disk:6",
      "-transparent", "black",
      join(rootDir, "public", "looks", mask),
    ]);
    console.log(`${name}: ${mask} from seed ${x},${y}`);
  });
}
