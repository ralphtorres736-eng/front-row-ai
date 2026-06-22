// Realistic dark concert venue background.
//
// STRICT CONSTRAINT: The per-person loop uses ONLY chained Q-bezier arcs.
// No L-commands between persons — that is exactly what caused the "teeth" effect.
//
// Q-bezier peak math:
//   B(0.5) at equal-Y endpoints = (shoulderY + ctrlY) / 2
//   → to hit peakY = shoulderY - headH, set ctrlY = shoulderY - 2·headH
//
// Ratio safety clamp: headH ≤ 0.65·personWidth → ratio ≥ 1.54 (prevents spikes)

function f(n: number): string {
  return n.toFixed(1);
}

function buildCrowdSilhouette(
  x0: number,
  x1: number,
  shoulderY: number,
  personPx: number,
  headH: number,
  seed: number,
): string {
  // Open path: rise from bottom-left to shoulder level (one L is OK here)
  const segs: string[] = [`M ${x0},900 L ${x0},${shoulderY}`];
  let x = x0;
  let i = 0;

  while (x < x1 - 2) {
    const r1 = Math.abs(Math.sin(seed + i * 2.618));
    const r2 = Math.abs(Math.sin(seed + i * 1.732 + 0.7));

    // Width ±20% — heads aren't mechanically uniform
    const pw = Math.min(personPx * (0.80 + r1 * 0.40), x1 - x);
    if (pw < 2) break;
    const rx = x + pw;

    // Height ±25%, clamped so ratio ≥ 1.54 (no spikes)
    const rawH = headH * (0.75 + r1 * 0.50);
    const h = Math.min(rawH, 0.65 * pw);

    // Q control point: exact peak math
    const ctrlY = shoulderY - 2 * h;
    // Slight horizontal lean (±15% of pw)
    const ctrlX = (x + rx) * 0.5 + (r2 - 0.5) * pw * 0.15;

    // ONE Q arc per person — no L, no C, no neck lines
    segs.push(`Q ${f(ctrlX)},${f(ctrlY)} ${f(rx)},${shoulderY}`);

    x = rx;
    i++;
  }

  segs.push(`L ${x1},900 Z`);
  return segs.join(" ");
}

// Layer parameters — exact values from the task spec
// Ratio = personPx / headH ≈ 1.64 for all rows (round heads, not spikes)
const BACK_SHOULDER = 475;
const BACK_HEAD_H   = 22;
const BACK_ROW  = buildCrowdSilhouette(160, 1280, BACK_SHOULDER, 36, BACK_HEAD_H, 1.1);
const MID_ROW   = buildCrowdSilhouette( 20, 1420, 595, 48, 30, 2.3);
const FRONT_ROW = buildCrowdSilhouette(  0, 1440, 730, 65, 40, 3.7);

// Hair-detail overlay: small ellipses near back-row head tops add bun/wide-hair
// variety WITHOUT any L-neck commands. 25 blobs, deterministic positions.
interface HairBlob { cx: number; cy: number; rx: number; ry: number }
const HAIR_BLOBS: HairBlob[] = Array.from({ length: 25 }, (_, i) => {
  const r1 = Math.abs(Math.sin(1.1 + i * 2.618 + 0.5));
  const r2 = Math.abs(Math.sin(1.1 + i * 1.732 + 1.2));
  // Spread evenly from x=160 to x=1280 with slight sinusoidal jitter
  const cx = 160 + i * (1120 / 25) + Math.sin(i * 1.7) * 20;
  // cy sits just above where back-row heads peak
  const cy = BACK_SHOULDER - BACK_HEAD_H - 3 + (r2 - 0.5) * 8;
  if (r1 > 0.5) {
    // Bun / top-knot: small tall oval
    return { cx, cy: cy - 5, rx: 5 + r2 * 3, ry: 7 + r2 * 4 };
  } else {
    // Wide / natural hair: short wide oval
    return { cx, cy: cy + 1, rx: 9 + r2 * 4, ry: 4 + r2 * 2 };
  }
});

// Raised arms: [x, y(base), rotateDeg]
// Bases at y>BACK_SHOULDER (inside crowd body); tips ~65px up = around y=430–455
const RAISED_ARMS: Array<[number, number, number]> = [
  [ 285, 500,  -9],
  [ 440, 515,   6],
  [ 630, 496, -13],
  [ 822, 510,   4],
  [1042, 499,  -7],
  [1182, 513,  10],
  [1295, 504, -11],
];

// Tapered arm + hand shape (local coords, base at y=0, tip at y≈-65)
const ARM_PATH =
  "M -5,0 C -5,-20 -6,-40 -7,-52 L -9,-59 L -6,-65 L -1,-68 L 3,-65 L 7,-59 L 6,-50 C 5,-38 4,-20 5,0 Z";

export function ConcertBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          {/* Warm amber stage glow — boosted for cinematic drama */}
          <radialGradient id="cg-amberGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FF8C00" stopOpacity="0.28" />
            <stop offset="40%"  stopColor="#D4700A" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#C45A00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cg-amberCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFB347" stopOpacity="0.22" />
            <stop offset="55%"  stopColor="#FF8C00" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#FF8C00" stopOpacity="0" />
          </radialGradient>
          {/* Purple rim light — catches top edges of back-row heads */}
          <radialGradient id="cg-purpleHeadRim" cx="50%" cy="100%" r="55%">
            <stop offset="0%"   stopColor="#9333EA" stopOpacity="0.15" />
            <stop offset="45%"  stopColor="#7C3AED" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#6B21A8" stopOpacity="0" />
          </radialGradient>
          {/* Purple wash-light rim — bottom edge only */}
          <radialGradient id="cg-purpleRim" cx="50%" cy="100%" r="60%">
            <stop offset="0%"   stopColor="#6B21A8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#6B21A8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Flat #0a0a0a backdrop — no gradients or shapes above crowd */}
        <rect x="0" y="0" width="1440" height="900" fill="#0a0a0a" />

        {/* Amber stage glow: cy=480, ry=175 → top at y=305 (≥300 ✓) */}
        <ellipse cx="720" cy="480" rx="540" ry="175" fill="url(#cg-amberGlow)" />
        <ellipse cx="720" cy="462" rx="240" ry="72"  fill="url(#cg-amberCore)" />

        {/* ── Crowd silhouettes — pure Q-bezier chains, zero neck L-commands ── */}
        {/* Back row: silhouette + purple rim + hair blobs + raised arms all sway together */}
        <g className="crowd-back-row">
          {/* Back row semi-transparent: amber glow bleeds through between head peaks */}
          <path d={BACK_ROW} fill="rgba(14,9,20,0.55)" />
          {/* Purple rim: wide ellipse anchored at back-row top — simulates stage wash
              catching the back of heads; cy=475 = back shoulder line, ry=60 upward */}
          <ellipse cx="720" cy="475" rx="660" ry="60" fill="url(#cg-purpleHeadRim)" />
          {/* Hair detail overlay: bun + wide-hair ellipses, no L-commands */}
          {HAIR_BLOBS.map((b, i) => (
            <ellipse
              key={i}
              cx={f(b.cx)}
              cy={f(b.cy)}
              rx={f(b.rx)}
              ry={f(b.ry)}
              fill="rgba(14,9,20,0.56)"
            />
          ))}
          {/* Raised arms within the crowd body */}
          {RAISED_ARMS.map(([x, y, rot], i) => (
            <g key={i} transform={`translate(${x},${y}) rotate(${rot})`}>
              <path
                className="crowd-hand"
                d={ARM_PATH}
                fill="rgba(7,4,11,0.94)"
                style={{
                  transformBox: "fill-box" as const,
                  transformOrigin: "center",
                  animation: `hand-float ${3.5 + (i % 3) * 0.5}s ease-in-out ${-(i * 0.6)}s infinite`,
                }}
              />
            </g>
          ))}
        </g>

        {/* Mid row: heads silhouetted against back row + glow behind */}
        <g className="crowd-mid-row">
          <path d={MID_ROW} fill="rgba(10,7,15,0.82)" />
        </g>

        {/* Front row near-opaque: large, close silhouettes */}
        <g className="crowd-front-row">
          <path d={FRONT_ROW} fill="rgba(8,5,12,0.96)" />
        </g>

        {/* Purple wash-light rim — barely perceptible, bottom edge only */}
        <ellipse cx="720" cy="930" rx="830" ry="370" fill="url(#cg-purpleRim)" />
      </svg>
    </div>
  );
}
