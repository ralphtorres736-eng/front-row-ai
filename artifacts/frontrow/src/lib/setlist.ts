export interface SetlistTrack {
  track_id: number;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_coverart_100x100: string | null;
  genre: string | null;
  has_richsync: number;
}

const SETLIST_KEY = "frontrow_setlist";
export const SETLIST_POS_KEY = "frontrow_setlist_pos";

export function getSetlist(): SetlistTrack[] {
  try {
    const raw = localStorage.getItem(SETLIST_KEY);
    return raw ? (JSON.parse(raw) as SetlistTrack[]) : [];
  } catch {
    return [];
  }
}

export function saveSetlist(tracks: SetlistTrack[]): void {
  if (tracks.length === 0) {
    localStorage.removeItem(SETLIST_KEY);
  } else {
    localStorage.setItem(SETLIST_KEY, JSON.stringify(tracks));
  }
}

export function clearSetlist(): void {
  localStorage.removeItem(SETLIST_KEY);
  sessionStorage.removeItem(SETLIST_POS_KEY);
}

export function getSetlistPos(): number | null {
  const raw = sessionStorage.getItem(SETLIST_POS_KEY);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export function setSetlistPos(pos: number): void {
  sessionStorage.setItem(SETLIST_POS_KEY, String(pos));
}

export function clearSetlistPos(): void {
  sessionStorage.removeItem(SETLIST_POS_KEY);
}
