import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Mic2, Music2, RotateCcw, ChevronRight } from "lucide-react";
import type {
  RichsyncResponse,
  SyncedLyricsResponse,
  PlainLyricsResponse,
} from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KaraokeLine {
  text: string;
}

interface StageDisplayProps {
  richsync?: RichsyncResponse | null;
  synced?: SyncedLyricsResponse | null;
  fallback?: PlainLyricsResponse | null;
  mood: string;
  isAnnouncing?: boolean;
  announcementDone?: boolean;
  readyToSing?: boolean;
  onReady?: () => void;
  captionsEnabled?: boolean;
  script?: string | null;
  // Outro props
  showOutro?: boolean;
  isPlayingOutro?: boolean;
  outroDone?: boolean;
  outroScript?: string | null;
  onEnd?: () => void;
  onFindAnother?: () => void;
  onSingAgain?: () => void;
  onNextTrack?: () => void;
}

// ---------------------------------------------------------------------------
// Speed options (ms per line)
// ---------------------------------------------------------------------------

const SPEEDS = [1200, 1800, 2500, 3500, 5000];
const DEFAULT_SPEED_IDX = 2; // 2500 ms

function fmtSpeed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// MoodBadge
// ---------------------------------------------------------------------------

function MoodBadge({ mood }: { mood: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
      <span
        className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.3em] text-primary"
        data-testid="badge-mood"
      >
        {mood}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HostCaption — closed-caption bar shown while host is speaking
// ---------------------------------------------------------------------------

function HostCaption({
  script,
  isAnnouncing,
  announcementDone,
}: {
  script: string;
  isAnnouncing: boolean;
  announcementDone: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const audioPlayedRef = useRef(false);

  useEffect(() => {
    if (isAnnouncing) audioPlayedRef.current = true;
  }, [isAnnouncing]);

  useEffect(() => {
    setDismissed(false);
    audioPlayedRef.current = false;
  }, [script]);

  useEffect(() => {
    if (!announcementDone || dismissed) return;
    const delay = audioPlayedRef.current ? 1500 : 5000;
    const t = setTimeout(() => setDismissed(true), delay);
    return () => clearTimeout(t);
  }, [announcementDone, dismissed]);

  const visible = !dismissed;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-28 z-40 flex justify-center px-6 transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-live="polite"
      data-testid="host-caption"
    >
      <p className="max-w-lg rounded-xl bg-black/75 px-5 py-3 text-center text-sm font-medium leading-relaxed tracking-wide text-white/95 backdrop-blur-sm">
        {script}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutroOverlay — full-screen overlay shown after the last lyric
// ---------------------------------------------------------------------------

function OutroOverlay({
  isPlayingOutro,
  outroDone,
  outroScript,
  captionsEnabled,
  onFindAnother,
  onSingAgain,
  onNextTrack,
}: {
  isPlayingOutro: boolean;
  outroDone: boolean;
  outroScript: string | null;
  captionsEnabled: boolean;
  onFindAnother: () => void;
  onSingAgain?: () => void;
  onNextTrack?: () => void;
}) {
  // Delay the CTA ~3 s after outroDone so the user has time to read the text
  const [ctaVisible, setCtaVisible] = useState(false);
  useEffect(() => {
    if (!outroDone) {
      setCtaVisible(false);
      return;
    }
    const t = setTimeout(() => setCtaVisible(true), 3000);
    return () => clearTimeout(t);
  }, [outroDone]);

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 px-8"
      data-testid="outro-overlay"
    >
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* MC speaking indicator */}
        {(isPlayingOutro || !outroDone) && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
            <Mic2 className="h-8 w-8 text-accent" />
            <span className="absolute inset-0 animate-ping rounded-full border border-accent/20" />
          </div>
        )}

        {/* Outro caption text */}
        {captionsEnabled && outroScript && (
          <p
            className="max-w-md rounded-xl bg-black/75 px-5 py-3 text-center text-sm font-medium leading-relaxed tracking-wide text-white/95 backdrop-blur-sm"
            data-testid="outro-caption"
            aria-live="polite"
          >
            {outroScript}
          </p>
        )}

        {/* CTA — shown ~3 s after outro text arrives, giving user time to read */}
        {ctaVisible && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg font-semibold text-foreground/70">
              The stage is yours again.
            </p>

            {/* Primary CTA: next song (setlist mode) OR find another song */}
            {onNextTrack ? (
              <button
                onClick={onNextTrack}
                className="flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
                data-testid="button-next-track"
              >
                <Music2 className="h-5 w-5" />
                Next Song
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={onFindAnother}
                className="flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
                data-testid="button-find-another"
              >
                <Music2 className="h-5 w-5" />
                Find another song
              </button>
            )}

            {onSingAgain && (
              <button
                onClick={onSingAgain}
                className="flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-6 py-3 text-sm font-semibold text-muted-foreground backdrop-blur-sm transition-colors hover:border-border hover:text-foreground active:scale-95"
                data-testid="button-sing-again"
              >
                <RotateCcw className="h-4 w-4" />
                Sing it again
              </button>
            )}

            {/* End setlist / find another song when in setlist mode */}
            {onNextTrack && (
              <button
                onClick={onFindAnother}
                className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                data-testid="button-find-another"
              >
                End setlist
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadyGate — full-screen prompt shown after host finishes, before lyrics start
// ---------------------------------------------------------------------------

function ReadyGate({ onReady }: { onReady: () => void }) {
  return (
    <div
      className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-6 px-8"
      onClick={onReady}
      role="button"
      aria-label="Tap to start lyrics"
      data-testid="ready-gate"
    >
      {/* Pulsing mic icon */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
        <Mic2 className="h-8 w-8 text-accent" />
        <span className="absolute inset-0 animate-ping rounded-full border border-accent/30" />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-2xl font-black tracking-tight text-foreground">
          Say{" "}
          <span className="text-accent">"Ready"</span>
        </p>
        <p className="text-sm text-muted-foreground">or tap anywhere to start</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KaraokeRoll — the unified display for all lyric tiers
// ---------------------------------------------------------------------------

function KaraokeRoll({
  lines,
  mood,
  isAnnouncing,
  started,
  onEnd,
}: {
  lines: KaraokeLine[];
  mood: string;
  isAnnouncing: boolean;
  started: boolean;
  onEnd?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(DEFAULT_SPEED_IDX);
  const currentRef = useRef<HTMLDivElement>(null);
  const endCalledRef = useRef(false);

  const safeIndex = Math.min(index, lines.length - 1);
  const intervalMs = SPEEDS[speedIdx];
  const atEnd = safeIndex >= lines.length - 1;

  // Auto-advance timer — only runs once `started` is true
  useEffect(() => {
    if (!started || atEnd) return;
    const t = setTimeout(
      () => setIndex((i) => Math.min(i + 1, lines.length - 1)),
      intervalMs,
    );
    return () => clearTimeout(t);
  }, [started, safeIndex, intervalMs, atEnd, lines.length]);

  // Fire onEnd callback once after reaching the last line
  useEffect(() => {
    if (!started || !atEnd || endCalledRef.current || !onEnd) return;
    const t = setTimeout(() => {
      endCalledRef.current = true;
      onEnd();
    }, 1500);
    return () => clearTimeout(t);
  }, [started, atEnd, onEnd]);

  // Scroll current line into the centre of the viewport
  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [safeIndex]);

  function advance() {
    if (!started) return;
    setIndex((i) => Math.min(i + 1, lines.length - 1));
  }

  function slower(e: React.MouseEvent) {
    e.stopPropagation();
    setSpeedIdx((i) => Math.min(i + 1, SPEEDS.length - 1));
  }

  function faster(e: React.MouseEvent) {
    e.stopPropagation();
    setSpeedIdx((i) => Math.max(i - 1, 0));
  }

  const progress = lines.length > 1 ? safeIndex / (lines.length - 1) : 1;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <MoodBadge mood={mood} />

      <div
        className="relative flex-1 cursor-pointer select-none overflow-hidden"
        onClick={advance}
        role="button"
        aria-label="Tap to advance lyrics"
      >
        {/* Fade mask — top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-44 bg-gradient-to-b from-background to-transparent" />
        {/* Fade mask — bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-background to-transparent" />

        <div className="no-scrollbar h-full overflow-y-auto">
          <div className="flex flex-col items-center gap-7 px-8 py-[42vh]">
            {lines.map((line, i) => {
              const dist = i - safeIndex;
              const absD = Math.abs(dist);
              const isCurrent = dist === 0;

              const opacity =
                isCurrent
                  ? 1
                  : absD === 1
                    ? 0.38
                    : absD === 2
                      ? 0.16
                      : 0.06;

              const sizeClass = isCurrent
                ? "text-4xl font-black leading-tight tracking-tight md:text-6xl"
                : absD === 1
                  ? "text-2xl font-bold md:text-3xl"
                  : absD === 2
                    ? "text-xl font-semibold"
                    : "text-lg font-medium";

              return (
                <div
                  key={i}
                  ref={isCurrent ? currentRef : undefined}
                  className={`w-full max-w-3xl text-center transition-all duration-500 ${sizeClass} ${
                    isCurrent ? "text-primary text-glow" : "text-foreground/80"
                  }`}
                  style={{ opacity, transition: "opacity 0.5s ease, transform 0.5s ease" }}
                  data-testid={isCurrent ? "text-line-current" : undefined}
                  data-line-index={i}
                >
                  {line.text.trim() === "" ? "\u00A0" : line.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="relative z-20 flex flex-col items-center gap-3 pb-7 pt-3">
        <div className="w-full max-w-xs px-6">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-border/25">
            <div
              className="h-full rounded-full bg-primary/50 transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
              data-testid="progress-bar"
            />
          </div>
          {/* Auto-advance countdown strip — only shows once started */}
          {started && !atEnd && (
            <div className="relative mt-1 h-[2px] w-full overflow-hidden rounded-full bg-transparent">
              <div
                key={`${safeIndex}-${intervalMs}`}
                className="absolute left-0 top-0 h-full rounded-full bg-primary/35"
                style={{
                  animation: `karaoke-countdown ${intervalMs}ms linear forwards`,
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={slower}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
            disabled={speedIdx >= SPEEDS.length - 1}
            aria-label="Slower"
            data-testid="button-slower"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <div className="flex flex-col items-center">
            <span
              className="font-mono text-xs tracking-widest text-muted-foreground"
              data-testid="text-line-counter"
            >
              {safeIndex + 1} / {lines.length}
            </span>
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground/50">
              {fmtSpeed(intervalMs)} · TAP TO SKIP
            </span>
          </div>

          <button
            onClick={faster}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
            disabled={speedIdx === 0}
            aria-label="Faster"
            data-testid="button-faster"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* MC LIVE badge */}
        <span
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.3em] transition-opacity duration-300 ${
            isAnnouncing
              ? "border-accent/50 bg-accent/15 text-accent opacity-100"
              : "border-border/40 bg-card/40 text-muted-foreground/50 opacity-60"
          }`}
          data-testid="badge-mc-live"
          data-active={isAnnouncing}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isAnnouncing ? "animate-pulse bg-accent" : "bg-muted-foreground/40"
            }`}
          />
          MC LIVE
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StageDisplay — orchestrates tier selection and normalises to KaraokeLine[]
// ---------------------------------------------------------------------------

export function StageDisplay({
  richsync,
  synced,
  fallback,
  mood,
  isAnnouncing = false,
  announcementDone = false,
  readyToSing = false,
  onReady,
  captionsEnabled = false,
  script = null,
  showOutro = false,
  isPlayingOutro = false,
  outroDone = false,
  outroScript = null,
  onEnd,
  onFindAnother,
  onSingAgain,
  onNextTrack,
}: StageDisplayProps) {
  const richsyncLines = richsync?.lines ?? [];
  const syncedLines = synced?.lines ?? [];

  // Resolve lines from the best available tier
  let lines: KaraokeLine[] | null = null;

  if (richsyncLines.length > 0) {
    lines = richsyncLines.map((line) => ({ text: line.x }));
  } else if (syncedLines.length > 0) {
    lines = syncedLines.map((line) => ({ text: line.text }));
  } else {
    const body = fallback?.lyrics?.trim() ?? "";
    const plain = body.split("\n").map((t) => ({ text: t }));
    if (plain.length > 0) lines = plain;
  }

  if (!lines) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center">
        <MoodBadge mood={mood} />
        <p
          className="text-center text-muted-foreground"
          data-testid="text-fallback-notice"
        >
          No lyrics available for this track.
        </p>
      </div>
    );
  }

  // Before the user says "Ready", show a neutral waiting screen —
  // no lyrics visible yet (host is speaking or gate is open for user trigger).
  if (!readyToSing) {
    return (
      <div className="relative h-full w-full">
        <MoodBadge mood={mood} />

        {isAnnouncing && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <span className="flex items-center gap-3 rounded-full border border-accent/50 bg-accent/10 px-6 py-3 font-mono text-sm uppercase tracking-[0.3em] text-accent">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
              MC LIVE
            </span>
          </div>
        )}

        {announcementDone && !isAnnouncing && onReady && (
          <ReadyGate onReady={onReady} />
        )}

        {captionsEnabled && script && (
          <HostCaption
            script={script}
            isAnnouncing={isAnnouncing}
            announcementDone={announcementDone}
          />
        )}
      </div>
    );
  }

  // User is ready — show lyrics (+ outro overlay when song ends)
  return (
    <div className="relative h-full w-full">
      <KaraokeRoll
        lines={lines}
        mood={mood}
        isAnnouncing={isAnnouncing}
        started={readyToSing}
        onEnd={onEnd}
      />

      {showOutro && onFindAnother && (
        <OutroOverlay
          isPlayingOutro={isPlayingOutro}
          outroDone={outroDone}
          outroScript={outroScript}
          captionsEnabled={captionsEnabled}
          onFindAnother={onFindAnother}
          onSingAgain={onSingAgain}
          onNextTrack={onNextTrack}
        />
      )}
    </div>
  );
}
