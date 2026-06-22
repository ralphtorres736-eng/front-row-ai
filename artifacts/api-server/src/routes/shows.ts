import { Router, type IRouter } from "express";

const router: IRouter = Router();

const JAMBASE_BASE = "https://api.data.jambase.com/v3";

type VenueType = "indoor" | "outdoor" | "amphitheater" | "symphony" | "festival";

function classifyVenue(venueName: string): VenueType {
  const n = venueName.toLowerCase();
  if (/amphitheat/.test(n)) return "amphitheater";
  if (/symphony|philharmonic|opera house|conservatory/.test(n)) return "symphony";
  if (/festival|fairground|fairgrounds|ranch|farm|speedway|raceway/.test(n)) return "festival";
  if (/park|field|meadow|green|lawn|outdoor|commons/.test(n)) return "outdoor";
  return "indoor";
}

type JamBaseRegion = { name?: string; alternateName?: string } | string;

type JamBaseAddress = {
  addressLocality?: string;
  addressRegion?: JamBaseRegion;
};

type JamBaseLocation = {
  name?: string;
  address?: JamBaseAddress;
};

type JamBaseEvent = {
  identifier?: string;
  name?: string;
  startDate?: string;
  location?: JamBaseLocation;
  url?: string;
};

router.get("/shows", async (req, res): Promise<void> => {
  const artist =
    typeof req.query.artist === "string" ? req.query.artist.trim() : "";

  if (!artist) {
    res.status(400).json({ error: "artist query parameter is required" });
    return;
  }

  const apiKey =
    process.env.JAMBASE_API_KEY ?? process.env.jbd_trial_key;
  if (!apiKey) {
    req.log.warn("JAMBASE_API_KEY not configured");
    res.status(502).json({ error: "Concert show lookup is not configured" });
    return;
  }

  try {
    const url = new URL(`${JAMBASE_BASE}/events`);
    url.searchParams.set("artistName", artist);

    const upstream = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "(unreadable)");
      req.log.warn(
        { status: upstream.status, body },
        "JamBase events request failed",
      );
      res.status(502).json({
        error: "Could not reach concert data — try again shortly.",
      });
      return;
    }

    const data = (await upstream.json()) as { events?: unknown[] };
    const events: JamBaseEvent[] = Array.isArray(data.events)
      ? (data.events as JamBaseEvent[])
      : [];

    const shows = events
      .filter((e) => Boolean(e.location?.name))
      .slice(0, 8)
      .map((e) => ({
        id: e.identifier ?? `${e.startDate}-${e.location?.name}`,
        name: e.name ?? artist,
        venue_name: e.location?.name ?? "Unknown Venue",
        venue_type: classifyVenue(e.location?.name ?? ""),
        city: e.location?.address?.addressLocality ?? "",
        state: (() => {
          const r = e.location?.address?.addressRegion;
          if (!r) return "";
          if (typeof r === "string") return r;
          return r.alternateName ?? r.name ?? "";
        })(),
        date: e.startDate ?? "",
        url: e.url ?? null,
      }));

    res.json({ artist, shows });
  } catch (err) {
    req.log.error({ err }, "shows route error");
    res
      .status(502)
      .json({ error: "Could not reach concert data — try again shortly." });
  }
});

export default router;
