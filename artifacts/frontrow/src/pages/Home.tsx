import { useState } from "react";
import {
  useSearchTracks,
  getSearchTracksQueryKey,
  useGetShows,
  getGetShowsQueryKey,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Music, Disc, MapPin, X, Ticket, Plus, Check, ListMusic, ArrowRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { SearchBar } from "@/components/SearchBar";
import { ConcertBackground } from "@/components/ConcertBackground";
import { useMood } from "@/contexts/mood";
import {
  getSetlist,
  saveSetlist,
  clearSetlist,
  setSetlistPos,
  type SetlistTrack,
} from "@/lib/setlist";

export const SHOW_CONTEXT_KEY = "frontrow_show_context";
export const TRACK_ARTIST_KEY = "frontrow_track_artist";
export const TRACK_TITLE_KEY = "frontrow_track_title";

interface ShowContext {
  artist: string;
  venue_name: string;
  venue_type: string;
  city: string;
  state: string;
  date: string;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [selectedShow, setSelectedShow] = useState<ShowContext | null>(null);
  const debouncedQuery = useDebounce(query, 350);
  const { setGenre } = useMood();
  const [, setLocation] = useLocation();

  const [setlist, setLocalSetlist] = useState<SetlistTrack[]>(() => getSetlist());

  // When a show is locked in, we search songs for that artist
  const effectiveTrackQuery = selectedShow ? selectedShow.artist : debouncedQuery;

  const showsEnabled = !selectedShow && debouncedQuery.length >= 2;
  const tracksEnabled = effectiveTrackQuery.length > 0;

  const { data: showsData, isLoading: isLoadingShows } = useGetShows(
    { artist: debouncedQuery },
    {
      query: {
        enabled: showsEnabled,
        retry: false,
        queryKey: getGetShowsQueryKey({ artist: debouncedQuery }),
      },
    },
  );

  const {
    data: tracks,
    isLoading: isLoadingTracks,
    error,
  } = useSearchTracks(
    { q: effectiveTrackQuery, page_size: 20 },
    {
      query: {
        enabled: tracksEnabled,
        retry: false,
        queryKey: getSearchTracksQueryKey({
          q: effectiveTrackQuery,
          page_size: 20,
        }),
      },
    },
  );

  const errorMessage = error
    ? (error.data?.error ?? "Request failed. Please try again.")
    : null;

  const shows = showsData?.shows ?? [];
  const isLoading = isLoadingShows || isLoadingTracks;

  function handleShowSelect(
    show: NonNullable<typeof showsData>["shows"][number],
  ) {
    const ctx: ShowContext = {
      artist: showsData?.artist ?? query,
      venue_name: show.venue_name,
      venue_type: show.venue_type,
      city: show.city,
      state: show.state,
      date: show.date,
    };
    setSelectedShow(ctx);
    sessionStorage.setItem(SHOW_CONTEXT_KEY, JSON.stringify(ctx));
    setQuery(ctx.artist);
  }

  function handleShowDeselect() {
    setSelectedShow(null);
    sessionStorage.removeItem(SHOW_CONTEXT_KEY);
    setQuery("");
  }

  function isTrackInSetlist(track_id: number): boolean {
    return setlist.some((t) => t.track_id === track_id);
  }

  function toggleSetlistTrack(track: {
    track_id: number;
    track_name: string;
    artist_name: string;
    album_name: string;
    album_coverart_100x100?: string | null;
    genre?: string | null;
    has_richsync: number;
  }) {
    setLocalSetlist((prev) => {
      const exists = prev.some((t) => t.track_id === track.track_id);
      const next: SetlistTrack[] = exists
        ? prev.filter((t) => t.track_id !== track.track_id)
        : [
            ...prev,
            {
              track_id: track.track_id,
              track_name: track.track_name,
              artist_name: track.artist_name,
              album_name: track.album_name,
              album_coverart_100x100: track.album_coverart_100x100 ?? null,
              genre: track.genre ?? null,
              has_richsync: track.has_richsync,
            },
          ];
      saveSetlist(next);
      return next;
    });
  }

  function handleClearSetlist() {
    setLocalSetlist([]);
    clearSetlist();
  }

  function handleStartSetlist() {
    if (setlist.length === 0) return;
    const first = setlist[0];
    setSetlistPos(0);
    sessionStorage.setItem(TRACK_ARTIST_KEY, first.artist_name);
    sessionStorage.setItem(TRACK_TITLE_KEY, first.track_name);
    // Clear any stale show context — the setlist may contain tracks from
    // a different artist than the previously selected show.
    if (!selectedShow) {
      sessionStorage.removeItem(SHOW_CONTEXT_KEY);
    }
    setGenre(first.genre);
    setLocation(`/player/${first.track_id}`);
  }

  return (
    <>
      <ConcertBackground />
      <div className="relative flex min-h-screen w-full flex-col items-center px-6 pb-28 pt-28">
      <div className="w-full max-w-2xl space-y-8 text-center">
        {/* Host greeting */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">
            <span className="text-foreground">FrontRow</span>
            <span className="text-primary">.AI</span>
          </h1>
          <p className="text-xl font-bold" style={{ color: "#A855F7" }}>
            What show are we crashing tonight?
          </p>
          {!selectedShow && (
            <p className="text-xs" style={{ color: "#666666" }}>
              Drop an artist name — I'll pull the show.
            </p>
          )}
        </div>

        {/* Selected show banner */}
        {selectedShow && (
          <div className="relative rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 text-left">
            <button
              onClick={handleShowDeselect}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear show selection"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 pr-6">
                <p className="truncate font-bold text-foreground">
                  {selectedShow.venue_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[selectedShow.city, selectedShow.state]
                    .filter(Boolean)
                    .join(", ")}
                  {selectedShow.date
                    ? ` · ${formatDate(selectedShow.date)}`
                    : ""}
                </p>
                <p className="mt-1.5 font-mono text-xs font-bold uppercase tracking-widest text-primary/80">
                  Front row locked in — pick a song
                </p>
              </div>
            </div>
          </div>
        )}

        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={
            selectedShow
              ? `Search songs by ${selectedShow.artist}...`
              : "Artist, song, or album..."
          }
        />

        <div className="mt-4 w-full space-y-6 text-left">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          )}

          {/* Upcoming shows */}
          {!isLoading && shows.length > 0 && !selectedShow && (
            <div className="space-y-2">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-primary/70">
                Upcoming Shows
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {shows.map((show) => (
                  <button
                    key={show.id}
                    onClick={() => handleShowSelect(show)}
                    className="group flex items-center gap-4 rounded-xl border border-transparent bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-foreground transition-colors group-hover:text-primary">
                        {show.venue_name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[show.city, show.state].filter(Boolean).join(", ")}
                        {show.date ? ` · ${formatDate(show.date)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-background/60 px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {show.venue_type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track error */}
          {!isLoading && errorMessage && (
            <div
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-center text-destructive"
              data-testid="text-error"
            >
              {errorMessage}
            </div>
          )}

          {/* No tracks found */}
          {!isLoading &&
            !errorMessage &&
            effectiveTrackQuery.length > 0 &&
            tracks?.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <Music className="mx-auto mb-4 h-10 w-10 opacity-20" />
                <p>No tracks found for "{effectiveTrackQuery}"</p>
              </div>
            )}

          {/* Song results */}
          {!isLoading && tracks && tracks.length > 0 && (
            <div className="space-y-2">
              {shows.length > 0 && !selectedShow && (
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-primary/70">
                  Songs
                </h2>
              )}
              <div className="grid grid-cols-1 gap-3">
                {tracks.map((track) => {
                  const inSetlist = isTrackInSetlist(track.track_id);
                  return (
                    <div key={track.track_id} className="flex items-center gap-2">
                      <Link
                        href={`/player/${track.track_id}`}
                        onClick={() => {
                          setGenre(track.genre);
                          sessionStorage.setItem(
                            TRACK_ARTIST_KEY,
                            track.artist_name,
                          );
                          sessionStorage.setItem(
                            TRACK_TITLE_KEY,
                            track.track_name,
                          );
                          // If no show is actively selected, clear any
                          // stale show context so a prior artist's show
                          // doesn't bleed into the MC script.
                          if (!selectedShow) {
                            sessionStorage.removeItem(SHOW_CONTEXT_KEY);
                          }
                        }}
                        className="group flex flex-1 items-center gap-4 rounded-xl border border-transparent bg-card/60 p-4 transition-all hover:border-primary/40 hover:bg-card"
                        data-testid={`link-track-${track.track_id}`}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-secondary">
                          {track.album_coverart_100x100 ? (
                            <img
                              src={track.album_coverart_100x100}
                              alt={track.album_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Disc className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-muted-foreground opacity-50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="truncate text-lg font-bold text-foreground transition-colors group-hover:text-primary"
                            data-testid={`text-track-name-${track.track_id}`}
                          >
                            {track.track_name}
                          </h3>
                          <p className="truncate text-muted-foreground">
                            {track.artist_name}
                            <span className="mx-2 opacity-50">•</span>
                            {track.album_name}
                          </p>
                        </div>
                        {track.has_richsync === 1 && (
                          <span className="rounded bg-primary/20 px-2 py-1 font-mono text-xs font-bold text-primary">
                            SYNC
                          </span>
                        )}
                      </Link>

                      {/* Add / remove from setlist */}
                      <button
                        onClick={() => toggleSetlistTrack(track)}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          inSetlist
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                        }`}
                        aria-label={
                          inSetlist ? "Remove from setlist" : "Add to setlist"
                        }
                        data-testid={`button-setlist-${track.track_id}`}
                      >
                        {inSetlist ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Floating setlist bar */}
      {setlist.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-primary/40 bg-card/95 px-5 py-3 shadow-xl shadow-black/40 backdrop-blur-md">
          <ListMusic className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-mono text-sm font-bold text-foreground">
            {setlist.length} song{setlist.length !== 1 ? "s" : ""} queued
          </span>
          <button
            onClick={handleStartSetlist}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            data-testid="button-start-setlist"
          >
            Start Show
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClearSetlist}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear setlist"
            data-testid="button-clear-setlist"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
