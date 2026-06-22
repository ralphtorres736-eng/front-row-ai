import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetTrackRichsync,
  useGetTrackSynced,
  useGetTrackLyrics,
  getGetTrackRichsyncQueryKey,
  getGetTrackSyncedQueryKey,
  getGetTrackLyricsQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, AlertCircle, MapPin, Subtitles, ListMusic } from "lucide-react";
import { StageDisplay } from "@/components/StageDisplay";
import { StageBackground } from "@/components/StageBackground";
import { useMood } from "@/contexts/mood";
import { useAnnouncer, type AnnounceContext } from "@/hooks/useAnnouncer";
import { useOutro } from "@/hooks/useOutro";
import { SHOW_CONTEXT_KEY, TRACK_ARTIST_KEY, TRACK_TITLE_KEY } from "@/pages/Home";
import {
  getSetlist,
  getSetlistPos,
  setSetlistPos as storeSetlistPos,
  clearSetlistPos,
} from "@/lib/setlist";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractError(error: any): string | null {
  if (!error) return null;
  return error?.data?.error ?? "Request failed.";
}

interface ShowContext {
  artist: string;
  venue_name: string;
  venue_type: string;
  city: string;
  state: string;
  date: string;
}

function readShowContext(): ShowContext | null {
  try {
    const raw = sessionStorage.getItem(SHOW_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as ShowContext) : null;
  } catch {
    return null;
  }
}

// SpeechRecognition browser shim — use `any` to avoid missing DOM types
// in strict mode; guarded at runtime before use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;
function getSpeechRecognition(): (new () => AnySpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function Player() {
  const { trackId } = useParams();
  const id = parseInt(trackId || "0", 10);
  const { mood, setGenre } = useMood();

  // Computed inline on every render so that setlist advances (which update
  // sessionStorage before triggering a re-render) are reflected immediately.
  // useAnnouncer excludes context from its effect deps, so reading it fresh
  // here ensures the correct artist/track is captured when the effect fires
  // for a new trackId without causing spurious re-fires.
  const _show = readShowContext();
  // Track artist takes priority over show artist so that searching a
  // different artist after a show was selected doesn't bleed the old
  // show's artist name into the MC script. Show context is still used
  // for venue / city / venue-type (ambiance), just not for the name.
  const announceCtx: AnnounceContext = {
    artist: (sessionStorage.getItem(TRACK_ARTIST_KEY) ?? undefined) ?? _show?.artist,
    track: sessionStorage.getItem(TRACK_TITLE_KEY) ?? undefined,
    venue: _show?.venue_name,
    city: _show?.city,
    venueType: _show?.venue_type,
  };

  const [showCtx] = useState<ShowContext | null>(() => readShowContext());

  const [, setLocation] = useLocation();

  // setlist is stable during playback — read once from localStorage.
  // setlistPos is read inline so it's always current after sessionStorage
  // writes in handleNextTrack (wouter re-renders the same component instance
  // on route param change; useState initializers would not re-run).
  const [setlist] = useState(() => getSetlist());
  const setlistPos = getSetlistPos();

  // Active setlist playback: setlist has songs, pos is set, and it matches the
  // current track (guards against stale sessionStorage from a previous session)
  const isInSetlist =
    setlist.length > 0 &&
    setlistPos !== null &&
    setlist[setlistPos]?.track_id === id;

  const hasNextTrack = isInSetlist && setlistPos + 1 < setlist.length;

  function handleNextTrack() {
    const nextPos = (setlistPos ?? 0) + 1;
    const nextTrack = setlist[nextPos];
    if (!nextTrack) {
      clearSetlistPos();
      setLocation("/");
      return;
    }
    storeSetlistPos(nextPos);
    sessionStorage.setItem(TRACK_ARTIST_KEY, nextTrack.artist_name);
    sessionStorage.setItem(TRACK_TITLE_KEY, nextTrack.track_name);
    setGenre(nextTrack.genre);
    setLocation(`/player/${nextTrack.track_id}`);
  }

  const { isAnnouncing, announcementDone, script } = useAnnouncer(id ? id : null, announceCtx);

  // playbackKey: incremented on "sing again" to force KaraokeRoll remount
  const [playbackKey, setPlaybackKey] = useState(0);

  // showOutro: becomes true once KaraokeRoll signals atEnd
  const [showOutro, setShowOutro] = useState(false);
  useEffect(() => { setShowOutro(false); }, [id]);

  function handleSingAgain() {
    setReadyToSing(false);
    setShowOutro(false);
    setPlaybackKey((k) => k + 1);
  }

  const { isPlayingOutro, outroDone, outroScript } = useOutro(showOutro, announceCtx);

  // Captions preference — opt-in, persisted in localStorage
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(
    () => localStorage.getItem("frontrow_captions_on") === "true",
  );

  function toggleCaptions() {
    setCaptionsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("frontrow_captions_on", String(next));
      return next;
    });
  }

  // readyToSing: gated until user taps or says "Ready" after host finishes.
  // Reset whenever trackId changes so every song requires explicit trigger.
  const [readyToSing, setReadyToSing] = useState(false);
  useEffect(() => {
    setReadyToSing(false);
  }, [id]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Once the announcement finishes, start listening for "Ready"
  useEffect(() => {
    if (!announcementDone || readyToSing) return;

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return; // fallback: tap-only

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rec: any = null;
    try {
      rec = new SpeechRecognitionCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript: string = event.results[i]?.[0]?.transcript?.toLowerCase() ?? "";
          if (transcript.includes("ready")) {
            setReadyToSing(true);
            rec.stop();
          }
        }
      };

      rec.onerror = () => { try { rec.stop(); } catch { /* ignore */ } };
      rec.start();
      recognitionRef.current = rec;
    } catch {
      // SpeechRecognition unavailable — tap-only
      rec = null;
    }

    return () => {
      if (rec) {
        try { rec.stop(); } catch { /* ignore */ }
      }
      recognitionRef.current = null;
    };
  }, [announcementDone, readyToSing]);

  // Clean up recognition when user taps ready
  useEffect(() => {
    if (readyToSing && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, [readyToSing]);

  const {
    data: richsync,
    isLoading: isLoadingRichsync,
    error: richsyncError,
  } = useGetTrackRichsync(id, {
    query: {
      enabled: !!id,
      retry: false,
      queryKey: getGetTrackRichsyncQueryKey(id),
    },
  });

  const hasRichsyncLines = !!richsync?.lines && richsync.lines.length > 0;
  const needsSynced = !isLoadingRichsync && !hasRichsyncLines;

  const {
    data: synced,
    isLoading: isLoadingSynced,
    error: syncedError,
  } = useGetTrackSynced(id, {
    query: {
      enabled: !!id && needsSynced,
      retry: false,
      queryKey: getGetTrackSyncedQueryKey(id),
    },
  });

  const hasSyncedLines = !!synced?.lines && synced.lines.length > 0;
  const needsFallback = needsSynced && !isLoadingSynced && !hasSyncedLines;

  const {
    data: fallbackLyrics,
    isLoading: isLoadingFallback,
    error: fallbackError,
  } = useGetTrackLyrics(id, {
    query: {
      enabled: !!id && needsFallback,
      retry: false,
      queryKey: getGetTrackLyricsQueryKey(id),
    },
  });

  const isLoading =
    isLoadingRichsync ||
    (needsSynced && isLoadingSynced) ||
    (needsFallback && isLoadingFallback);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="mb-8 h-20 w-20 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <div className="animate-pulse font-mono text-sm tracking-[0.3em] text-primary/70">
          TUNING_INSTRUMENTS
        </div>
      </div>
    );
  }

  const errorMessage =
    !hasRichsyncLines && !hasSyncedLines && !fallbackLyrics
      ? extractError(fallbackError) ??
        extractError(syncedError) ??
        extractError(richsyncError)
      : null;

  if (errorMessage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="mb-6 h-14 w-14 text-destructive" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Lyrics unavailable
        </h1>
        <p
          className="mb-8 max-w-md text-muted-foreground"
          data-testid="text-error"
        >
          {errorMessage}
        </p>
        <Link
          href="/"
          className="rounded-full border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-secondary/60"
          data-testid="link-back-home"
        >
          Return to Stage
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden">
      <StageBackground mood={mood} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-6">
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/60 text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
          data-testid="link-back-home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Center: setlist progress OR venue name */}
        {isInSetlist ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 backdrop-blur-md">
            <ListMusic className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-mono text-xs font-semibold text-foreground/80">
              {setlistPos! + 1} / {setlist.length}
            </span>
          </div>
        ) : showCtx ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-mono text-xs font-semibold text-foreground/80">
              {showCtx.venue_name}
              {showCtx.city ? ` · ${showCtx.city}` : ""}
            </span>
          </div>
        ) : null}

        {/* Captions toggle */}
        <button
          onClick={toggleCaptions}
          className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
            captionsEnabled
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
          }`}
          aria-label={captionsEnabled ? "Hide host captions" : "Show host captions"}
          aria-pressed={captionsEnabled}
          data-testid="button-captions-toggle"
        >
          <Subtitles className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1">
        <StageDisplay
          key={playbackKey}
          richsync={hasRichsyncLines ? richsync : null}
          synced={hasSyncedLines ? synced : null}
          fallback={fallbackLyrics ?? null}
          mood={mood.mood}
          isAnnouncing={isAnnouncing}
          announcementDone={announcementDone}
          readyToSing={readyToSing}
          onReady={() => setReadyToSing(true)}
          captionsEnabled={captionsEnabled}
          script={script}
          showOutro={showOutro}
          isPlayingOutro={isPlayingOutro}
          outroDone={outroDone}
          outroScript={outroScript}
          onEnd={() => setShowOutro(true)}
          onFindAnother={() => {
            clearSetlistPos();
            setLocation("/");
          }}
          onSingAgain={handleSingAgain}
          onNextTrack={hasNextTrack ? handleNextTrack : undefined}
        />
      </div>
    </div>
  );
}
