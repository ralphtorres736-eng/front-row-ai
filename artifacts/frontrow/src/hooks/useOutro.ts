import { useEffect, useRef, useState } from "react";
import type { AnnounceContext } from "./useAnnouncer";

interface OutroResponse {
  ok: boolean;
  contentType?: string;
  audio?: string;
  script?: string;
}

/**
 * Fires the MC host outro exactly once when `trigger` flips to true.
 * Posts to /api/outro with artist/track/city context, decodes the
 * returned Base64 voice clip, and plays it.
 *
 * Returns:
 *   isPlayingOutro  — true while outro audio is playing
 *   outroDone       — true once audio has finished (or failed/skipped)
 *   outroScript     — the AI-generated outro text (null until resolved)
 *
 * All failures are swallowed silently — the outro is non-critical.
 */
export function useOutro(
  trigger: boolean,
  context?: AnnounceContext,
): { isPlayingOutro: boolean; outroDone: boolean; outroScript: string | null } {
  const [isPlayingOutro, setIsPlayingOutro] = useState(false);
  const [outroDone, setOutroDone] = useState(false);
  const [outroScript, setOutroScript] = useState<string | null>(null);
  const firedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    firedRef.current = true;

    let cancelled = false;

    // Safety net: if audio events never fire (autoplay blocked, decode failure,
    // suspended AudioContext), force outroDone after 12 s so the CTA always appears.
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setIsPlayingOutro(false);
        setOutroDone(true);
      }
    }, 12000);

    const markDone = () => {
      clearTimeout(safetyTimer);
      if (!cancelled) {
        setIsPlayingOutro(false);
        setOutroDone(true);
      }
    };

    (async () => {
      try {
        const res = await fetch("/api/outro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artist: context?.artist,
            track: context?.track,
            city: context?.city,
            venue_type: context?.venueType,
          }),
        });

        if (!res.ok) {
          markDone();
          return;
        }

        const data = (await res.json()) as OutroResponse;
        if (cancelled) return;

        // Expose script text for captions regardless of audio success
        if (data.script) setOutroScript(data.script);

        if (!data.ok || !data.audio) {
          markDone();
          return;
        }

        const audio = new Audio(
          `data:${data.contentType ?? "audio/mpeg"};base64,${data.audio}`,
        );
        audioRef.current = audio;

        audio.addEventListener("playing", () => {
          if (!cancelled) setIsPlayingOutro(true);
        });
        audio.addEventListener("ended", markDone);
        audio.addEventListener("pause", markDone);
        audio.addEventListener("error", markDone);

        try {
          await audio.play();
        } catch {
          markDone();
        }
      } catch {
        markDone();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
      setIsPlayingOutro(false);
    };
  }, [trigger]); // context intentionally excluded: fires once per trigger

  return { isPlayingOutro, outroDone, outroScript };
}
