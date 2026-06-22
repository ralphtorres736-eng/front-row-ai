export type PulseSpeed = "slow" | "medium" | "fast";

export interface MoodProfile {
  /** Human-readable mood name shown in the UI badge. */
  mood: string;
  /** Radial gradient color stops (innermost to outermost glow). */
  colors: [string, string];
  /** Named pulse speed. */
  pulseSpeed: PulseSpeed;
  /** CSS animation duration mapped from the pulse speed. */
  pulseDuration: string;
}

const PULSE_DURATION: Record<PulseSpeed, string> = {
  slow: "4s",
  medium: "2.5s",
  fast: "1.5s",
};

function profile(
  mood: string,
  colors: [string, string],
  pulseSpeed: PulseSpeed,
): MoodProfile {
  return { mood, colors, pulseSpeed, pulseDuration: PULSE_DURATION[pulseSpeed] };
}

export const DEFAULT_MOOD: MoodProfile = profile(
  "Live Performance",
  ["hsl(190 100% 50% / 0.45)", "hsl(270 100% 65% / 0.25)"],
  "medium",
);

const STREET_ANTHEM = profile(
  "Street Anthem",
  ["hsl(28 100% 55% / 0.5)", "hsl(0 90% 45% / 0.25)"],
  "fast",
);
const LATE_NIGHT_SOUL = profile(
  "Late Night Soul",
  ["hsl(320 80% 55% / 0.45)", "hsl(265 85% 45% / 0.25)"],
  "slow",
);
const RAW_ENERGY = profile(
  "Raw Energy",
  ["hsl(0 95% 55% / 0.5)", "hsl(15 90% 40% / 0.28)"],
  "fast",
);
const ELECTRIC_NIGHT = profile(
  "Electric Night",
  ["hsl(190 100% 55% / 0.5)", "hsl(220 100% 55% / 0.28)"],
  "medium",
);
const MIDNIGHT_JAZZ = profile(
  "Midnight Jazz",
  ["hsl(245 80% 55% / 0.45)", "hsl(280 70% 40% / 0.25)"],
  "slow",
);
const OPEN_ROAD = profile(
  "Open Road",
  ["hsl(40 85% 55% / 0.45)", "hsl(25 70% 40% / 0.25)"],
  "slow",
);
const GRAND_STAGE = profile(
  "Grand Stage",
  ["hsl(45 90% 60% / 0.45)", "hsl(220 60% 45% / 0.25)"],
  "medium",
);

interface GenreRule {
  keywords: string[];
  profile: MoodProfile;
}

// Order matters: the first rule whose keyword appears in the (lowercased)
// genre tag wins.
const RULES: GenreRule[] = [
  { keywords: ["hip hop", "hip-hop", "rap", "trap"], profile: STREET_ANTHEM },
  { keywords: ["r&b", "rnb", "soul"], profile: LATE_NIGHT_SOUL },
  { keywords: ["rock", "metal", "punk"], profile: RAW_ENERGY },
  { keywords: ["pop", "dance", "edm"], profile: ELECTRIC_NIGHT },
  { keywords: ["jazz", "blues"], profile: MIDNIGHT_JAZZ },
  { keywords: ["country", "folk"], profile: OPEN_ROAD },
  { keywords: ["classical", "orchestral"], profile: GRAND_STAGE },
];

/**
 * Pure function: maps a Musixmatch genre tag to a mood profile.
 * Matching is case-insensitive. Returns the default profile when the genre
 * is null, empty, or unrecognized.
 */
export function getMoodProfile(genre?: string | null): MoodProfile {
  if (!genre) return DEFAULT_MOOD;
  const normalized = genre.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.profile;
    }
  }
  return DEFAULT_MOOD;
}
