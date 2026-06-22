import { createContext, useContext, useMemo, useState } from "react";
import { getMoodProfile, type MoodProfile } from "@/lib/moodEngine";

interface MoodContextValue {
  /** Genre tag of the currently selected track, or null when unknown. */
  genre: string | null;
  /** Records the genre of a selected track (call with null to reset). */
  setGenre: (genre: string | null) => void;
  /** MoodProfile derived from the current genre via the mood engine. */
  mood: MoodProfile;
}

const MoodContext = createContext<MoodContextValue | null>(null);

export function useMood(): MoodContextValue {
  const ctx = useContext(MoodContext);
  if (!ctx) {
    throw new Error("useMood must be used within a MoodProvider");
  }
  return ctx;
}

export function MoodProvider({ children }: { children: React.ReactNode }) {
  const [genre, setGenre] = useState<string | null>(null);
  // Null/missing genre falls back to the default profile silently.
  const mood = useMemo(() => getMoodProfile(genre), [genre]);
  const value = useMemo(() => ({ genre, setGenre, mood }), [genre, mood]);
  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}
