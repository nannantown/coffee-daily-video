import React from "react";

/**
 * One picture per topic, drawn in code so every episode can get one without a
 * per-episode asset. Each motif takes a style (so the three directions can
 * render the same object as a flat sticker, a pen drawing or a lit object)
 * and one 0..1 `amount` that the explain scene animates: how hot, how fine,
 * how much has dissolved.
 */
export interface MotifStyle {
  ink: string; // outline
  fill: string; // body
  accent: string; // the thing that changes (mercury, particles, dissolved dots)
  liquid: string;
  stroke: number;
  /** 0..1 draw-on progress for line-art (1 = fully drawn) */
  draw?: number;
  glow?: boolean;
}

export type MotifKind = "kettle" | "grind" | "cup";

// Deterministic scatter so a still and a render agree frame for frame.
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const lineProps = (s: MotifStyle) => ({
  stroke: s.ink,
  strokeWidth: s.stroke,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1 - (s.draw ?? 1),
});

const Glow: React.FC<{ on?: boolean; color: string; children: React.ReactNode }> = ({ on, color, children }) =>
  on ? <g style={{ filter: `drop-shadow(0 0 18px ${color}) drop-shadow(0 0 42px ${color})` }}>{children}</g> : <>{children}</>;

/** Gooseneck kettle + thermometer. amount = mercury level; steam rises with it. */
const Kettle: React.FC<{ s: MotifStyle; amount: number; t: number }> = ({ s, amount, t }) => {
  const lp = lineProps(s);
  const tubeTop = 90;
  const tubeBottom = 450;
  const mercuryTop = tubeBottom - (tubeBottom - tubeTop - 20) * amount;
  return (
    <svg viewBox="0 0 720 600" width="100%" height="100%" style={{ overflow: "visible" }}>
      <Glow on={s.glow} color={s.accent}>
        {/* steam — only once there is heat */}
        {[0, 1, 2].map((i) => {
          const y = 150 - ((t * 40 + i * 30) % 90);
          return (
            <path
              key={i}
              d={`M${24 + i * 26} ${y + 40} q 16 -20 0 -40 q -16 -20 0 -40`}
              fill="none"
              {...lp}
              strokeWidth={s.stroke * 0.7}
              stroke={s.accent}
              opacity={Math.max(0, amount - 0.25) * 1.3 * (1 - ((t * 40 + i * 30) % 90) / 110)}
            />
          );
        })}
        <path d="M150 440 Q88 440 84 360 Q80 250 22 205" fill="none" {...lp} strokeWidth={s.stroke * 1.6} />
        <path d="M455 290 Q545 298 526 400 Q512 452 466 452" fill="none" {...lp} strokeWidth={s.stroke * 1.4} />
        <path
          d="M172 250 L428 250 Q450 250 452 272 L470 470 Q472 502 440 502 L160 502 Q128 502 130 470 L148 272 Q150 250 172 250 Z"
          fill={s.fill}
          {...lp}
        />
        <path d="M205 250 Q300 186 395 250" fill={s.fill} {...lp} />
        <circle cx={300} cy={196} r={17} fill={s.fill} {...lp} />
        {/* thermometer */}
        <rect x={610} y={tubeTop} width={46} height={tubeBottom - tubeTop} rx={23} fill={s.fill} {...lp} />
        <rect x={622} y={mercuryTop} width={22} height={tubeBottom - mercuryTop + 10} rx={11} fill={s.accent} />
        <circle cx={633} cy={482} r={44} fill={s.accent} {...lp} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={666} x2={690} y1={tubeBottom - (tubeBottom - tubeTop) * f} y2={tubeBottom - (tubeBottom - tubeTop) * f} {...lp} strokeWidth={s.stroke * 0.6} />
        ))}
      </Glow>
    </svg>
  );
};

/** Hand grinder over a pile of grounds. amount 0 = few coarse chunks, 1 = many fine particles. */
const Grind: React.FC<{ s: MotifStyle; amount: number; t: number }> = ({ s, amount, t }) => {
  const lp = lineProps(s);
  const count = Math.round(14 + amount * 70);
  const size = 30 - amount * 20;
  // Side view: the arm turns around the vertical shaft, so it only foreshortens.
  // t = 0 (the cover) holds it fully out to the right.
  const armX = 300 + 150 * Math.cos(t * 4);
  const particles = Array.from({ length: count }, (_, i) => {
    // mound: wider at the bottom
    const u = rand(i + 1);
    const v = rand(i + 101);
    const h = Math.sqrt(v);
    return { x: 300 + (u - 0.5) * 2 * 210 * h, y: 560 - (1 - h) * 110 - rand(i + 7) * 12, r: size * (0.7 + rand(i + 3) * 0.5) };
  });
  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%" style={{ overflow: "visible" }}>
      <Glow on={s.glow} color={s.accent}>
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={s.accent} stroke={s.ink} strokeWidth={s.stroke * 0.35} />
        ))}
        <rect x={210} y={190} width={180} height={230} rx={26} fill={s.fill} {...lp} />
        <path d="M230 420 L260 450 L340 450 L370 420" fill={s.fill} {...lp} />
        <ellipse cx={300} cy={190} rx={96} ry={26} fill={s.fill} {...lp} />
        <line x1={300} y1={168} x2={300} y2={126} {...lp} strokeWidth={s.stroke * 1.3} />
        <line x1={300} y1={126} x2={armX} y2={126} {...lp} strokeWidth={s.stroke * 1.3} />
        <line x1={armX} y1={126} x2={armX} y2={84} {...lp} strokeWidth={s.stroke * 1.3} />
        <ellipse cx={armX} cy={74} rx={20} ry={26} fill={s.accent} {...lp} />
      </Glow>
    </svg>
  );
};

/** Cup of coffee with dissolved solids as dots. amount = how much has dissolved. */
const Cup: React.FC<{ s: MotifStyle; amount: number; t: number }> = ({ s, amount, t }) => {
  const lp = lineProps(s);
  const count = Math.round(6 + amount * 60);
  const dots = Array.from({ length: count }, (_, i) => ({
    x: 205 + rand(i + 11) * 190 - (rand(i + 5) * 0.12 * 40),
    y: 318 + rand(i + 29) * 180 + Math.sin(t * 2 + i) * 4,
    r: 7 + rand(i + 13) * 6,
  }));
  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id="cup-liquid">
          <path d="M186 300 L414 300 L400 500 Q395 530 365 530 L235 530 Q205 530 200 500 Z" />
        </clipPath>
      </defs>
      <Glow on={s.glow} color={s.accent}>
        <ellipse cx={300} cy={548} rx={210} ry={30} fill={s.fill} {...lp} />
        <path d="M418 330 Q500 330 496 400 Q492 462 408 462" fill="none" {...lp} strokeWidth={s.stroke * 1.4} />
        <path d="M176 250 L424 250 L402 500 Q396 532 364 532 L236 532 Q204 532 198 500 Z" fill={s.fill} {...lp} />
        <g clipPath="url(#cup-liquid)">
          <rect x={150} y={300} width={300} height={260} fill={s.liquid} />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={s.accent} />
          ))}
        </g>
        <path d="M176 250 L424 250 L402 500 Q396 532 364 532 L236 532 Q204 532 198 500 Z" fill="none" {...lp} />
      </Glow>
    </svg>
  );
};

export const Motif: React.FC<{ kind: MotifKind; style: MotifStyle; amount: number; t?: number }> = ({ kind, style, amount, t = 0 }) => {
  if (kind === "kettle") return <Kettle s={style} amount={amount} t={t} />;
  if (kind === "grind") return <Grind s={style} amount={amount} t={t} />;
  return <Cup s={style} amount={amount} t={t} />;
};
