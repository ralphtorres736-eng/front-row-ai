import { useState } from "react";
import type { MoodProfile } from "@/lib/moodEngine";
import { SHOW_CONTEXT_KEY } from "@/pages/Home";

type VenueLayout =
  | "indoor"
  | "outdoor"
  | "amphitheater"
  | "symphony"
  | "festival";

function readVenueLayout(): VenueLayout {
  try {
    const raw = sessionStorage.getItem(SHOW_CONTEXT_KEY);
    if (!raw) return "indoor";
    const ctx = JSON.parse(raw) as { venue_type?: string };
    const v = ctx.venue_type;
    if (
      v === "indoor" ||
      v === "outdoor" ||
      v === "amphitheater" ||
      v === "symphony" ||
      v === "festival"
    )
      return v;
  } catch {
    /* ignore */
  }
  return "indoor";
}

// ---------------------------------------------------------------------------
// Crowd silhouette paths (SVG viewBox 0 0 1440 900)
// Each Q command = one person's head bump: Q center,headY endX,shoulderY
// ---------------------------------------------------------------------------

const CROWD_FRONT_STANDING =
  "M 0,900 L 0,600 " +
  "Q 36,510 72,600 Q 108,522 144,600 Q 180,505 216,600 Q 252,528 288,600 " +
  "Q 324,514 360,600 Q 396,500 432,600 Q 468,524 504,600 Q 540,508 576,600 " +
  "Q 612,497 648,600 Q 684,519 720,600 Q 756,504 792,600 Q 828,514 864,600 " +
  "Q 900,500 936,600 Q 972,524 1008,600 Q 1044,510 1080,600 Q 1116,496 1152,600 " +
  "Q 1188,519 1224,600 Q 1260,506 1296,600 Q 1332,516 1368,600 Q 1404,509 1440,600 " +
  "L 1440,900 Z";

const CROWD_MID =
  "M 0,900 L 0,680 " +
  "Q 48,638 96,680 Q 144,643 192,680 Q 240,632 288,680 Q 336,646 384,680 " +
  "Q 432,635 480,680 Q 528,644 576,680 Q 624,633 672,680 Q 720,643 768,680 " +
  "Q 816,634 864,680 Q 912,644 960,680 Q 1008,636 1056,680 Q 1104,645 1152,680 " +
  "Q 1200,635 1248,680 Q 1296,644 1344,680 Q 1392,638 1440,680 " +
  "L 1440,900 Z";

const CROWD_FESTIVAL =
  "M 0,900 L 0,580 " +
  "Q 30,492 60,580 Q 90,505 120,580 Q 150,490 180,580 Q 210,506 240,580 " +
  "Q 270,491 300,580 Q 330,505 360,580 Q 390,490 420,580 Q 450,504 480,580 " +
  "Q 510,490 540,580 Q 570,506 600,580 Q 630,492 660,580 Q 690,505 720,580 " +
  "Q 750,491 780,580 Q 810,505 840,580 Q 870,492 900,580 Q 930,504 960,580 " +
  "Q 990,490 1020,580 Q 1050,506 1080,580 Q 1110,492 1140,580 Q 1170,505 1200,580 " +
  "Q 1230,491 1260,580 Q 1290,505 1320,580 Q 1350,492 1380,580 Q 1410,504 1440,580 " +
  "L 1440,900 Z";

const CROWD_AMPH_FRONT =
  "M 0,900 L 0,660 " +
  "Q 36,618 72,660 Q 108,625 144,660 Q 180,612 216,660 Q 252,626 288,660 " +
  "Q 324,613 360,660 Q 396,624 432,660 Q 468,610 504,660 Q 540,623 576,660 " +
  "Q 612,611 648,660 Q 684,623 720,660 Q 756,612 792,660 Q 828,624 864,660 " +
  "Q 900,611 936,660 Q 972,624 1008,660 Q 1044,613 1080,660 Q 1116,624 1152,660 " +
  "Q 1188,612 1224,660 Q 1260,623 1296,660 Q 1332,614 1368,660 Q 1404,622 1440,660 " +
  "L 1440,900 Z";

const CROWD_SEATED =
  "M 0,900 L 0,745 " +
  "Q 60,708 120,745 Q 180,714 240,745 Q 300,706 360,745 Q 420,714 480,745 " +
  "Q 540,706 600,745 Q 660,712 720,745 Q 780,706 840,745 Q 900,712 960,745 " +
  "Q 1020,706 1080,745 Q 1140,713 1200,745 Q 1260,707 1320,745 Q 1380,711 1440,745 " +
  "L 1440,900 Z";

// ---------------------------------------------------------------------------
// Amphitheater seating rows (terraced arcs)
// ---------------------------------------------------------------------------
const AMPH_ROWS = [
  { d: "M 60,755 Q 720,706 1380,755 L 1380,765 Q 720,715 60,765 Z", alpha: 0.55 },
  { d: "M 100,685 Q 720,634 1340,685 L 1340,695 Q 720,643 100,695 Z", alpha: 0.45 },
  { d: "M 150,618 Q 720,564 1290,618 L 1290,628 Q 720,573 150,628 Z", alpha: 0.35 },
  { d: "M 210,554 Q 720,498 1230,554 L 1230,563 Q 720,507 210,563 Z", alpha: 0.25 },
  { d: "M 280,496 Q 720,438 1160,496 L 1160,505 Q 720,447 280,505 Z", alpha: 0.17 },
];

// ---------------------------------------------------------------------------
// Spotlight positions per venue
// ---------------------------------------------------------------------------
const SPOTS: Record<
  VenueLayout,
  Array<{ x: number; color: string; opacity: number }>
> = {
  indoor: [
    { x: 25, color: "255,255,255", opacity: 0.07 },
    { x: 50, color: "255,255,255", opacity: 0.05 },
    { x: 75, color: "255,255,255", opacity: 0.07 },
  ],
  outdoor: [
    { x: 18, color: "255,255,255", opacity: 0.06 },
    { x: 50, color: "255,255,255", opacity: 0.04 },
    { x: 82, color: "255,255,255", opacity: 0.06 },
  ],
  amphitheater: [
    { x: 50, color: "255,255,255", opacity: 0.08 },
    { x: 33, color: "255,255,255", opacity: 0.04 },
    { x: 67, color: "255,255,255", opacity: 0.04 },
  ],
  symphony: [
    { x: 32, color: "255,210,100", opacity: 0.06 },
    { x: 50, color: "255,220,120", opacity: 0.07 },
    { x: 68, color: "255,210,100", opacity: 0.06 },
  ],
  festival: [
    { x: 15, color: "255,255,255", opacity: 0.07 },
    { x: 32, color: "255,255,255", opacity: 0.06 },
    { x: 50, color: "255,255,255", opacity: 0.05 },
    { x: 68, color: "255,255,255", opacity: 0.06 },
    { x: 85, color: "255,255,255", opacity: 0.07 },
  ],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const INDOOR_LIGHTS = [170, 340, 510, 680, 760, 930, 1100, 1270];
const FESTIVAL_LIGHTS = [155, 320, 490, 660, 780, 950, 1120, 1285];
const FESTIVAL_DROPS = [120, 360, 600, 840, 1080, 1320];

function IndoorStructure() {
  return (
    <>
      <rect x="0" y="0" width="32" height="900" fill="rgba(0,0,0,0.30)" />
      <rect x="1408" y="0" width="32" height="900" fill="rgba(0,0,0,0.30)" />
      <rect x="80" y="20" width="1280" height="7" rx="2" fill="rgba(255,255,255,0.17)" />
      <rect x="80" y="34" width="1280" height="3" rx="1" fill="rgba(255,255,255,0.09)" />
      {INDOOR_LIGHTS.map((x) => (
        <g key={x}>
          <rect x={x - 1} y={37} width="3" height="52" fill="rgba(255,255,255,0.11)" />
          <rect x={x - 13} y={89} width="26" height="9" rx="4" fill="rgba(255,255,255,0.27)" />
        </g>
      ))}
    </>
  );
}

function OutdoorStructure() {
  return (
    <>
      <rect x="18" y="55" width="28" height="625" fill="rgba(0,0,0,0.52)" />
      <rect x="8" y="45" width="48" height="16" rx="2" fill="rgba(0,0,0,0.52)" />
      <rect x="10" y="155" width="36" height="58" rx="3" fill="rgba(255,255,255,0.055)" />
      <rect x="10" y="232" width="36" height="58" rx="3" fill="rgba(255,255,255,0.055)" />
      <rect x="1394" y="55" width="28" height="625" fill="rgba(0,0,0,0.52)" />
      <rect x="1384" y="45" width="48" height="16" rx="2" fill="rgba(0,0,0,0.52)" />
      <rect x="1394" y="155" width="36" height="58" rx="3" fill="rgba(255,255,255,0.055)" />
      <rect x="1394" y="232" width="36" height="58" rx="3" fill="rgba(255,255,255,0.055)" />
      <line x1="0" y1="568" x2="1440" y2="568" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
    </>
  );
}

function AmphitheaterStructure() {
  return (
    <>
      <path
        d="M 320,0 Q 720,-55 1120,0 L 1105,80 Q 720,32 335,80 Z"
        fill="rgba(255,255,255,0.055)"
      />
      <path
        d="M 320,0 L 195,165 L 215,170 L 335,80 Z"
        fill="rgba(255,255,255,0.035)"
      />
      <path
        d="M 1120,0 L 1245,165 L 1225,170 L 1105,80 Z"
        fill="rgba(255,255,255,0.035)"
      />
    </>
  );
}

function SymphonyStructure() {
  return (
    <>
      <path
        d="M 0,0 Q 720,-130 1440,0 L 1440,48 Q 720,-82 0,48 Z"
        fill="rgba(255,255,255,0.038)"
      />
      <path
        d="M 0,46 Q 720,-30 1440,46 L 1440,54 Q 720,-22 0,54 Z"
        fill="rgba(255,255,255,0.028)"
      />
      {/* Left balcony */}
      <rect x="0" y="175" width="132" height="430" fill="rgba(0,0,0,0.62)" />
      <rect x="0" y="173" width="137" height="7" fill="rgba(255,255,255,0.11)" />
      <rect x="0" y="362" width="137" height="4" fill="rgba(255,255,255,0.065)" />
      {/* Left upper tier */}
      <rect x="0" y="75" width="88" height="100" fill="rgba(0,0,0,0.42)" />
      <rect x="0" y="73" width="93" height="5" fill="rgba(255,255,255,0.09)" />
      {/* Right balcony */}
      <rect x="1308" y="175" width="132" height="430" fill="rgba(0,0,0,0.62)" />
      <rect x="1303" y="173" width="137" height="7" fill="rgba(255,255,255,0.11)" />
      <rect x="1303" y="362" width="137" height="4" fill="rgba(255,255,255,0.065)" />
      {/* Right upper tier */}
      <rect x="1352" y="75" width="88" height="100" fill="rgba(0,0,0,0.42)" />
      <rect x="1347" y="73" width="93" height="5" fill="rgba(255,255,255,0.09)" />
      {/* Stage apron line */}
      <line
        x1="132"
        y1="500"
        x2="1308"
        y2="500"
        stroke="rgba(255,215,100,0.07)"
        strokeWidth="2"
      />
    </>
  );
}

function FestivalStructure() {
  return (
    <>
      <rect x="26" y="0" width="34" height="492" fill="rgba(255,255,255,0.13)" />
      <rect x="1380" y="0" width="34" height="492" fill="rgba(255,255,255,0.13)" />
      <path
        d="M 26,8 Q 720,95 1414,8 L 1414,28 Q 720,115 26,28 Z"
        fill="rgba(255,255,255,0.11)"
      />
      <rect x="26" y="172" width="1388" height="5" fill="rgba(255,255,255,0.085)" />
      <rect x="26" y="312" width="1388" height="4" fill="rgba(255,255,255,0.065)" />
      <rect x="26" y="422" width="1388" height="3" fill="rgba(255,255,255,0.048)" />
      {FESTIVAL_LIGHTS.map((x) => (
        <g key={x}>
          <rect x={x - 2} y={28} width="4" height="56" fill="rgba(255,255,255,0.09)" />
          <rect x={x - 15} y={84} width="30" height="10" rx="4" fill="rgba(255,255,255,0.27)" />
        </g>
      ))}
      {FESTIVAL_DROPS.map((x) => (
        <g key={x}>
          <rect x={x - 1} y={177} width="2" height="38" fill="rgba(255,255,255,0.09)" />
          <rect x={x - 8} y={215} width="16" height="6" rx="2" fill="rgba(255,255,255,0.24)" />
        </g>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface StageBackgroundProps {
  mood: MoodProfile;
}

export function StageBackground({ mood }: StageBackgroundProps) {
  const [inner, outer] = mood.colors;
  const [layout] = useState<VenueLayout>(readVenueLayout);

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
      data-testid="stage-background"
      data-pulse-speed={mood.pulseSpeed}
      data-venue={layout}
    >
      {/* Base mood colour pulse */}
      <div
        className="absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 will-change-transform"
        style={{
          background: `radial-gradient(circle at center, ${inner} 0%, ${outer} 38%, transparent 70%)`,
          animation: `stage-pulse ${mood.pulseDuration} ease-in-out infinite`,
        }}
      />

      {/* Venue SVG — structure + crowd silhouettes */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Structural elements */}
        {layout === "indoor" && <IndoorStructure />}
        {layout === "outdoor" && <OutdoorStructure />}
        {layout === "amphitheater" && <AmphitheaterStructure />}
        {layout === "symphony" && <SymphonyStructure />}
        {layout === "festival" && <FestivalStructure />}

        {/* Crowd silhouettes */}
        {(layout === "indoor" || layout === "outdoor") && (
          <>
            <path d={CROWD_MID} fill="rgba(0,0,0,0.42)" />
            <path d={CROWD_FRONT_STANDING} fill="rgba(0,0,0,0.80)" />
          </>
        )}
        {layout === "amphitheater" && (
          <>
            {AMPH_ROWS.map((row, i) => (
              <path
                key={i}
                d={row.d}
                fill={`rgba(0,0,0,${row.alpha})`}
              />
            ))}
            <path d={CROWD_AMPH_FRONT} fill="rgba(0,0,0,0.80)" />
          </>
        )}
        {layout === "symphony" && (
          <path d={CROWD_SEATED} fill="rgba(0,0,0,0.72)" />
        )}
        {layout === "festival" && (
          <>
            <path d={CROWD_MID} fill="rgba(0,0,0,0.38)" />
            <path d={CROWD_FESTIVAL} fill="rgba(0,0,0,0.83)" />
          </>
        )}
      </svg>

      {/* Spotlight cones (CSS radial-gradient) */}
      {SPOTS[layout].map((spot, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 18% 70% at ${spot.x}% -5%, rgba(${spot.color},${spot.opacity}) 0%, transparent 100%)`,
          }}
        />
      ))}

      {/* Stage floor reflection */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 18% at 50% 64%, rgba(255,255,255,0.028) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
