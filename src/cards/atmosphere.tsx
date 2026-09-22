import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DRIFT_MAX } from "./theme";

/**
 * The "AI-generated" tell these fix (docs/video-style.md §1, causes 2-4):
 * every cut was a flat #1a0e08 fill that held perfectly still for 5-10s.
 * Real footage and real print both have light falloff and grain, and nothing
 * ever sits that still. These are decoration only — no layout, no text, so
 * the safe areas and the typography rules are untouched.
 */

/**
 * Where the warm key light sits, per slide, so consecutive cuts differ.
 * `y` stays inside 14-56%: content lives between y=180 and y=1560 and its mass
 * sits in the upper half, so a light lower than that just illuminates the
 * empty band the platforms cover anyway and leaves the copy in shadow.
 *
 * Seven entries, not six, so neither shipping format wraps onto its own first
 * slide: the recipe day is 5 segments and the Sunday news day is 7, and the
 * CTA takes the index after the last slide (6 on Sunday).
 */
const LIGHT_POSITIONS = [
  { x: 24, y: 16, drift: 1 },
  { x: 76, y: 30, drift: -1 },
  { x: 30, y: 52, drift: 1 },
  { x: 72, y: 20, drift: -1 },
  { x: 46, y: 38, drift: 1 },
  { x: 20, y: 44, drift: -1 },
  { x: 62, y: 48, drift: 1 },
];


/**
 * One 180px grayscale noise tile, rendered once by Chromium and then repeated.
 * Generating the whole 1080x1920 field with feTurbulence every frame is far
 * too slow for a 1300-frame render; tiling + shifting is visually the same.
 */
const GRAIN_TILE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
    '<filter id="n" x="0" y="0" width="100%" height="100%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch"/>' +
    '<feColorMatrix type="saturate" values="0"/>' +
    "</filter>" +
    '<rect width="180" height="180" filter="url(#n)"/>' +
    "</svg>",
)}`;

/**
 * Film grain: the tile is re-offset periodically, which is what makes it
 * shimmer rather than look like a static texture.
 *
 * Held for 2 frames — the "on twos" of hand-drawn animation, and close to
 * what film grain reads like at 30fps. Also halves the temporal noise the
 * encoder carries, though measurement showed that is not what drives the
 * file size: a 42s render goes 3.2MB -> 13MB either way, because the light
 * and the drift mean no block of the frame is ever static any more. 13MB is
 * ~2.5 Mbps at 1080x1920/30, which is comfortably inside what Reels and
 * Shorts want — the old 3.2MB was only that small because it was a slideshow.
 */
const Grain: React.FC = () => {
  const step = Math.floor(useCurrentFrame() / 2);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${GRAIN_TILE}")`,
        backgroundRepeat: "repeat",
        // Coprime steps, so the tile never lands on the same offset twice in a slide.
        backgroundPosition: `${(step * 37) % 180}px ${(step * 61) % 180}px`,
        opacity: 0.05,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Warm key light + vignette. The light slowly widens across the slide so the
 * frame is never actually frozen, even when the content is.
 */
export const Atmosphere: React.FC<{ index?: number }> = ({ index = 0 }) => {
  const frame = useCurrentFrame();
  const spot = LIGHT_POSITIONS[index % LIGHT_POSITIONS.length];
  // ~6% over 10s — below the threshold where you notice it as an animation.
  const spread = interpolate(frame, [0, 300], [100, 106], { extrapolateRight: "clamp" });
  const slideX = spot.x + spot.drift * interpolate(frame, [0, 300], [0, 2], { extrapolateRight: "clamp" });

  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(${spread * 1.2}% ${spread * 0.72}% at ${slideX}% ${spot.y}%, rgba(214,168,118,0.17) 0%, rgba(201,123,75,0.06) 40%, rgba(0,0,0,0) 72%)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(78% 56% at 50% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.42) 100%)",
          pointerEvents: "none",
        }}
      />
      <Grain />
    </>
  );
};

/**
 * A very slow translate on the content column, direction varying per slide.
 * Translate rather than scale: scaling re-rasterises the Japanese text at a
 * fractional size every frame and the strokes visibly wobble.
 *
 * Rate is per-frame rather than normalised to the slide length, because a
 * Series.Sequence cannot read its own duration — over the 135-300 frame range
 * slides actually run, that lands between 3.6px and DRIFT_MAX of travel.
 * Neither component may exceed DRIFT_MAX: that is the budget SlideShell
 * reserved by insetting the column.
 */
export const Drift: React.FC<{ index?: number; children: React.ReactNode }> = ({
  index = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const travel = interpolate(frame, [0, 300], [0, DRIFT_MAX], { extrapolateRight: "clamp" });
  const dir = index % 3;
  const x = dir === 0 ? -travel : dir === 1 ? travel * 0.4 : travel * 0.7;
  const y = dir === 0 ? travel * 0.5 : dir === 1 ? -travel : travel * 0.3;
  // Must be an AbsoluteFill, not a bare div: a transform makes an element the
  // containing block for its absolutely positioned children, so a zero-height
  // static wrapper would collapse the content column that lives inside it.
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px)` }}>{children}</AbsoluteFill>;
};

/**
 * Takes the edge off the hard cut between slides. `<Series>` swaps the entire
 * screen in one frame, every time — six identical cuts in a row is what reads
 * as "no one edited this".
 */
export const useCutIn = (): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, 5], [0, 1], { extrapolateRight: "clamp" });
};
