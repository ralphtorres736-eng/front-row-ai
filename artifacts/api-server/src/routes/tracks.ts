import { Router, type IRouter } from "express";
import {
  SearchTracksQueryParams,
  GetTrackRichsyncParams,
  GetTrackSyncedParams,
  GetTrackLyricsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MXM_BASE = "https://api.musixmatch.com/ws/1.1";

function mxmKey(): string {
  const key = process.env.MXM_KEY;
  if (!key) throw new Error("MXM_KEY environment variable is not set");
  return key;
}

async function mxmFetch(endpoint: string, params: Record<string, string | number>): Promise<unknown> {
  const url = new URL(`${MXM_BASE}/${endpoint}`);
  url.searchParams.set("apikey", mxmKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Musixmatch HTTP error: ${res.status}`);
  }
  const json = await res.json() as { message: { header: { status_code: number }; body: unknown } };
  const statusCode = json?.message?.header?.status_code;
  if (statusCode !== 200) {
    const err = new Error(`Musixmatch status ${statusCode}`);
    (err as NodeJS.ErrnoException).code = String(statusCode);
    throw err;
  }
  return json.message.body;
}

// GET /api/tracks/search?q=...&page=...&page_size=...
router.get("/tracks/search", async (req, res): Promise<void> => {
  const parsed = SearchTracksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q, page = 1, page_size = 20 } = parsed.data;

  try {
    const body = await mxmFetch("track.search", {
      q_track_artist: q,
      page: page ?? 1,
      page_size: page_size ?? 20,
      s_track_rating: "desc",
      f_has_lyrics: 1,
      f_lyrics_language: "en",
    }) as { track_list: Array<{ track: Record<string, unknown> }> };

    const tracks = (body.track_list ?? []).map((item) => {
      const t = item.track;
      const genreList = (
        t.primary_genres as
          | { music_genre_list?: Array<{ music_genre?: { music_genre_name?: string } }> }
          | undefined
      )?.music_genre_list;
      const genre = genreList?.[0]?.music_genre?.music_genre_name ?? null;
      return {
        track_id: t.track_id,
        track_name: t.track_name,
        artist_name: t.artist_name,
        album_name: t.album_name ?? "",
        // Musixmatch track.search does not return a Spotify ID; preserve it if the
        // upstream payload ever provides one, otherwise default to null.
        spotify_track_id:
          (t.spotify_track_id as string | undefined) ??
          (t.spotify_id as string | undefined) ??
          null,
        genre,
        album_coverart_100x100: t.album_coverart_100x100 ?? null,
        album_coverart_350x350: t.album_coverart_350x350 ?? null,
        has_richsync: t.has_richsync ?? 0,
        has_subtitles: t.has_subtitles ?? 0,
        track_rating: t.track_rating ?? 0,
        num_favourite: t.num_favourite ?? 0,
      };
    });

    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "Musixmatch track.search error");
    res.status(502).json({ error: "Failed to fetch tracks from Musixmatch" });
  }
});

// GET /api/tracks/:trackId/richsync
router.get("/tracks/:trackId/richsync", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.trackId) ? req.params.trackId[0] : req.params.trackId;
  const parsed = GetTrackRichsyncParams.safeParse({ trackId: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { trackId } = parsed.data;

  try {
    const body = await mxmFetch("track.richsync.get", {
      track_id: trackId,
      part: "richsync_body",
      f_richsync_length_max_deviation: 0.5,
    }) as { richsync: { richsync_body: string; richsync_length: number } };

    const richsync = body.richsync;
    if (!richsync?.richsync_body) {
      res.status(404).json({ error: "No richsync available for this track" });
      return;
    }

    let lines: unknown[];
    try {
      lines = JSON.parse(richsync.richsync_body);
    } catch {
      res.status(502).json({ error: "Failed to parse richsync body" });
      return;
    }

    res.json({
      track_id: trackId,
      duration: richsync.richsync_length ?? 0,
      lines,
    });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "404" || code === "14") {
      res.status(404).json({ error: "No richsync available for this track" });
      return;
    }
    req.log.error({ err }, "Musixmatch track.richsync.get error");
    res.status(502).json({ error: "Failed to fetch richsync from Musixmatch" });
  }
});

// Parse a Musixmatch LRC-style subtitle body (`[mm:ss.xx] text`) into ordered,
// time-stamped lines. Empty/instrumental lines are filtered out by the caller
// so the line stepper only advances through lines that have lyrics.
function parseSubtitleBody(body: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const re = /^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
  for (const raw of body.split("\n")) {
    const m = re.exec(raw);
    if (!m) continue;
    const minutes = parseInt(m[1], 10);
    const seconds = parseFloat(m[2]);
    const time = minutes * 60 + seconds;
    lines.push({ time, text: m[3].trim() });
  }
  return lines;
}

// GET /api/tracks/:trackId/synced
router.get("/tracks/:trackId/synced", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.trackId) ? req.params.trackId[0] : req.params.trackId;
  const parsed = GetTrackSyncedParams.safeParse({ trackId: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { trackId } = parsed.data;

  try {
    const body = await mxmFetch("track.subtitle.get", {
      track_id: trackId,
    }) as { subtitle?: { subtitle_body?: string } };

    const subtitleBody = body.subtitle?.subtitle_body;
    if (!subtitleBody) {
      res.status(404).json({ error: "No line-level sync available for this track" });
      return;
    }

    const lines = parseSubtitleBody(subtitleBody).filter((l) => l.text.length > 0);
    if (lines.length === 0) {
      res.status(404).json({ error: "No line-level sync available for this track" });
      return;
    }

    res.json({ track_id: trackId, lines });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    // 404/14 = not found; 401/402/403 = upstream quota/plan limit. In every
    // "not available" case, return 404 so the client falls through to the
    // static plain-lyrics tier instead of surfacing an error.
    if (code === "404" || code === "14" || code === "401" || code === "402" || code === "403") {
      res.status(404).json({ error: "No line-level sync available for this track" });
      return;
    }
    req.log.error({ err }, "Musixmatch track.subtitle.get error");
    res.status(502).json({ error: "Failed to fetch synced lyrics from Musixmatch" });
  }
});

// GET /api/tracks/:trackId/lyrics
router.get("/tracks/:trackId/lyrics", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.trackId) ? req.params.trackId[0] : req.params.trackId;
  const parsed = GetTrackLyricsParams.safeParse({ trackId: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { trackId } = parsed.data;

  try {
    const body = await mxmFetch("track.lyrics.get", {
      track_id: trackId,
    }) as { lyrics: { lyrics_body: string } };

    const lyrics = body.lyrics;
    if (!lyrics?.lyrics_body) {
      res.status(404).json({ error: "No lyrics available for this track" });
      return;
    }

    // Musixmatch appends a tracking disclaimer to lyrics_body; strip it.
    const cleaned = lyrics.lyrics_body
      .replace(/\*{7}.*$/s, "")
      .trim();

    res.json({ track_id: trackId, lyrics: cleaned });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "404" || code === "14") {
      res.status(404).json({ error: "No lyrics available for this track" });
      return;
    }
    req.log.error({ err }, "Musixmatch track.subtitle.get error");
    res.status(502).json({ error: "Failed to fetch lyrics from Musixmatch" });
  }
});

export default router;
