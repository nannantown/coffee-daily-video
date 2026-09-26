/**
 * Geometry of the Codex pencil vessels (public/looks/lab-vessel-*.png, drawn
 * at 1080x1920). Measured on the images; the masks are flood-filled from
 * `seeds` by scripts/make-vessel-masks.mjs. If a vessel is regenerated,
 * re-measure and rerun that script. Where the drawing lands on screen comes
 * from src/looks/safe-layout.mjs (whyLayout). Plain JS so the renderer
 * (vessels.ts) and the tests (scripts/looks-layout.test.mjs) read the same numbers.
 */
export const VESSELS = {
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
  },
};

/** Which vessel a why-scene motion draws. */
export const vesselFor = (type) => (type === "compare" ? "cups" : type === "dissolve" ? "dripper" : "server");
