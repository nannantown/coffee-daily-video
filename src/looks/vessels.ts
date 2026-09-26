/**
 * Geometry of the Codex pencil vessels (public/looks/lab-vessel-*.png, drawn
 * at 1080x1920). Measured on the images; the masks are flood-filled from
 * `seeds` by scripts/make-vessel-masks.mjs. If a vessel is regenerated,
 * re-measure and rerun that script. Where the drawing lands on screen and how
 * big it is comes from src/looks/safe-layout.mjs (whyLayout), which fits it
 * between the heading and the meters.
 */
export interface Vessel {
  file: string;
  masks: string[];
  seeds: { x: number; y: number }[]; // inside each glass (mask flood-fill start)
  interiorTop: number; // y of the inside's top / bottom (level 0..1 is measured between them)
  interiorBottom: number;
  box: { top: number; bottom: number }; // the drawing's vertical extent on the plate
  maxScale: number; // never drawn bigger than this
  tip?: { x: number; y: number }; // dripper: where the particles leave the grounds
  labelX?: number[]; // cups: centre x of each cup on the plate, left to right
}

export const VESSELS: Record<"server" | "dripper" | "cups", Vessel> = {
  server: {
    file: "lab-vessel-server.png",
    masks: ["lab-vessel-server-mask.png"],
    seeds: [{ x: 540, y: 900 }],
    interiorTop: 640,
    interiorBottom: 1275,
    box: { top: 600, bottom: 1340 },
    maxScale: 0.85,
  },
  dripper: {
    file: "lab-vessel-dripper.png",
    masks: ["lab-vessel-dripper-mask.png"],
    seeds: [{ x: 540, y: 1250 }],
    interiorTop: 1060,
    interiorBottom: 1390,
    box: { top: 640, bottom: 1440 },
    maxScale: 0.85,
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
    box: { top: 890, bottom: 1230 },
    maxScale: 1.05, // the two cups span x 130-1030 on the plate: wider would cut the right handle
    labelX: [310, 780],
  },
};
