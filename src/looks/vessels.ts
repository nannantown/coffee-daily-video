/**
 * Geometry of the Codex pencil vessels (public/looks/lab-vessel-*.png, drawn
 * at 1080x1920 after objectFit cover). Measured on the images; the masks are
 * flood-filled from `seeds` by scripts/make-vessel-masks.mjs. If a vessel is
 * regenerated, re-measure and rerun that script.
 */
export interface Vessel {
  file: string;
  masks: string[];
  seeds: { x: number; y: number }[]; // inside each glass (mask flood-fill start)
  interiorTop: number; // y of the inside's top / bottom (level 0..1 is measured between them)
  interiorBottom: number;
  shift: number; // px the drawing is moved down, to leave room for the core line
  scale: number; // drawing scale around (50%, 32%), so vessel + meters fit above the Reels caption
  metersTop: number;
  tip?: { x: number; y: number }; // dripper: where the particles leave the grounds
  labelX?: number[]; // cups: centre x of each cup, left to right
  labelY?: number;
}

export const VESSELS: Record<"server" | "dripper" | "cups", Vessel> = {
  server: {
    file: "lab-vessel-server.png",
    masks: ["lab-vessel-server-mask.png"],
    seeds: [{ x: 540, y: 900 }],
    interiorTop: 640,
    interiorBottom: 1275,
    shift: 50,
    scale: 0.85,
    metersTop: 1300,
  },
  dripper: {
    file: "lab-vessel-dripper.png",
    masks: ["lab-vessel-dripper-mask.png"],
    seeds: [{ x: 540, y: 1250 }],
    interiorTop: 1060,
    interiorBottom: 1390,
    shift: 40,
    scale: 0.85,
    metersTop: 1400,
    tip: { x: 540, y: 996 },
  },
  cups: {
    file: "lab-vessel-cups.png",
    masks: ["lab-vessel-cups-mask-left.png", "lab-vessel-cups-mask-right.png"],
    seeds: [
      { x: 310, y: 1060 },
      { x: 780, y: 1060 },
    ],
    interiorTop: 935,
    interiorBottom: 1185,
    shift: -150,
    scale: 1.1,
    metersTop: 1250,
    labelX: [310, 780],
    labelY: 1240,
  },
};
