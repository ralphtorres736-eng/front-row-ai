import { useEffect, useRef, useState } from "react";

interface AnnounceResponse {
  ok: boolean;
  contentType?: string;
  audio?: string;
  script?: string;
}

export interface AnnounceContext {
  artist?: string;
  track?: string;
  venue?: string;
  city?: string;
  venueType?: string;
}

/**
 * Fires the MC AI host announcer exactly once per track lifecycle.
 * Posts to the backend with artist/track/venue context, decodes the
 * returned Base64 AI-generated voice clip, and plays it.
 *
 * Returns:
 *   isAnnouncing     — true while audio is playing
 *   announcementDone — true once audio has finished (or failed/skipped)
 *                      Never resets during the same track lifecycle.
 *   script           — the AI-generated text (populated once fetch resolves;
 *                      null until then or on failure)
 *
 * All failures are swallowed silently — the announcer is non-critical
 * and must never interrupt the stage.
 */
export function useAnnouncer(
  trackId: string | number | null | undefined,
  context?: AnnounceContext,
): { isAnnouncing: boolean; announcementDone: boolean; script: string | null } {
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [announcementDone, setAnnouncementDone] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const announcedRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (trackId === null || trackId === undefined || trackId === "") {
      setAnnouncementDone(true);
      return;
    }
    const key = String(trackId);

    // Fire exactly once per track lifecycle.
    if (announcedRef.current === key) return;
    announcedRef.current = key;

    // Reset for new track
    setIsAnnouncing(false);
    setAnnouncementDone(false);
    setScript(null);

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/announce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackId: key,
            artist: context?.artist,
            track: context?.track,
            venue: context?.venue,
            city: context?.city,
          }),
        });

        if (!res.ok) {
          if (!cancelled) setAnnouncementDone(true);
          return;
        }

        const data = (await res.json()) as AnnounceResponse;
        if (cancelled) return;

        // Expose the script text for captions regardless of audio success
        if (data.script) setScript(data.script);

        if (!data.ok || !data.audio) {
          setAnnouncementDone(true);
          return;
        }

        const audio = new Audio(
          `data:${data.contentType ?? "audio/mpeg"};base64,${data.audio}`,
        );
        audioRef.current = audio;

        const markDone = () => {
          if (!cancelled) {
            setIsAnnouncing(false);
            setAnnouncementDone(true);
          }
        };

        audio.addEventListener("playing", () => {
          if (!cancelled) setIsAnnouncing(true);
        });
        audio.addEventListener("ended", markDone);
        audio.addEventListener("pause", markDone);
        audio.addEventListener("error", markDone);

        try {
          await audio.play();
        } catch {
          // Browser autoplay policy may block; treat as done.
          markDone();
        }
      } catch {
        if (!cancelled) setAnnouncementDone(true);
      }
    })();

    return () => {
      cancelled = true;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
      setIsAnnouncing(false);
    };
  }, [trackId]); // context intentionally excluded: fires once per track only

  return { isAnnouncing, announcementDone, script };
}
