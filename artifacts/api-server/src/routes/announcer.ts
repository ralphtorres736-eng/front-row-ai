import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/**
 * Lazily create an OpenAI client on first use.
 * Returns null if env vars are not yet configured — in that case
 * buildAIScript falls back to a static template, preserving the
 * fail-soft contract of this non-critical route.
 */
function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  return new OpenAI({ apiKey, baseURL });
}

/**
 * Generate a dynamic AI host intro for this specific song/artist.
 * Returns 2–3 sentences of warm, energetic concert-host copy,
 * ending with an invitation for the user to say "Ready".
 * Falls back to a static template if AI is unavailable.
 */
async function buildAIScript(
  artist?: string,
  track?: string,
  city?: string,
): Promise<string> {
  const artistName = artist || "the artist";
  const trackName = track || "this track";

  const staticFallback = `${artistName} is ready to bring it tonight. "${trackName}" is one of those songs — you'll feel it. Say "Ready" when you are.`;

  const client = getOpenAIClient();
  if (!client) {
    logger.warn(
      {
        hasBaseURL: !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        hasAPIKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      },
      "OpenAI client unavailable — skipping AI script",
    );
    return staticFallback;
  }

  try {
    const prompt = [
      `You are a charismatic concert host with an intimate, hype-man energy — warm, real, and personal.`,
      `You're introducing "${trackName}" by ${artistName}${city ? ` at a show in ${city}` : ""}.`,
      `Write exactly 2-3 sentences of host intro. Make it feel spontaneous and specific to the song and artist.`,
      `End your intro by telling the listener to say "Ready" or tap when they want the lyrics to start.`,
      `Keep it under 50 words total. No quotation marks. No stage directions. Just the spoken words.`,
    ].join(" ");

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    logger.info(
      {
        aiContentChars: content.length,
        finishReason: completion.choices[0]?.finish_reason,
      },
      "AI completion received",
    );
    return content || staticFallback;
  } catch (err) {
    logger.warn({ err }, "AI script generation failed — using static fallback");
    return staticFallback;
  }
}

const VENUE_OUTRO_PROMPTS: Record<string, string> = {
  indoor:
    "You owned that room — every wall felt it. The stage is ready. What do we play next?",
  outdoor:
    "Wide-open sky and you delivered. The field is still ringing. What are we throwing on next?",
  amphitheater:
    "The whole amphitheater was locked in on every word. The stage is yours — name the next one.",
  symphony:
    "Quiet, precise, and completely electric. The house is waiting. What do you want to give them next?",
  festival:
    "The crowd is still chanting. Festival energy never stops — what are we hitting next?",
};

const VENUE_OUTRO_FALLBACK =
  "That was everything. The stage is ready when you are. Find the next song below.";

type AnnounceBody = {
  trackId?: string | number;
  artist?: string;
  track?: string;
  venue?: string;
  city?: string;
};

type OutroBody = {
  artist?: string;
  track?: string;
  city?: string;
  venue_type?: string;
};

// POST /api/announce
// Returns a Base64-encoded AI-generated host intro via ElevenLabs (cloned voice).
// On any failure, returns { ok: false } with HTTP 200 so the client is never interrupted.
router.post("/announce", async (req, res): Promise<void> => {
  try {
    const apiKey = process.env.ELEVENLABS_KEY;
    const voiceId = process.env.RTFR_MC ?? process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      req.log.warn(
        "ElevenLabs credentials not configured (need ELEVENLABS_KEY + RTFR_MC or ELEVENLABS_VOICE_ID)",
      );
      res.json({ ok: false });
      return;
    }

    const body = req.body as AnnounceBody;

    // Generate dynamic AI script — falls back to static template if AI unavailable
    const script = await buildAIScript(body.artist, body.track, body.city);

    req.log.info(
      { artist: body.artist, track: body.track, city: body.city, scriptChars: script.length },
      "host script ready",
    );

    if (script.length < 10) {
      req.log.warn({ scriptChars: script.length }, "script too short — skipping ElevenLabs");
      res.json({ ok: false, audio: null, script });
      return;
    }

    const upstream = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.85 },
        }),
      },
    );

    if (!upstream.ok) {
      req.log.warn(
        { status: upstream.status },
        "ElevenLabs announce request failed",
      );
      res.json({ ok: false, script });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    req.log.info(
      { contentType, bufferBytes: buffer.byteLength },
      "ElevenLabs announce response received",
    );

    if (!contentType.startsWith("audio/") || buffer.byteLength < 5120) {
      req.log.warn(
        { contentType, bufferBytes: buffer.byteLength },
        "ElevenLabs announce response failed validation — returning script only",
      );
      res.json({ ok: false, audio: null, script });
      return;
    }

    res.json({ ok: true, contentType: "audio/mpeg", audio: buffer.toString("base64"), script });
  } catch (err) {
    req.log.error({ err }, "announce route error");
    res.json({ ok: false });
  }
});

// POST /api/outro
// Returns a venue-matched outro line spoken by the cloned MC voice via ElevenLabs.
// Falls back to { ok: false, script } (text-only) if voice synthesis is unavailable.
router.post("/outro", async (req, res): Promise<void> => {
  const body = req.body as OutroBody;
  const script =
    (body.venue_type && VENUE_OUTRO_PROMPTS[body.venue_type]) ??
    VENUE_OUTRO_FALLBACK;

  req.log.info(
    { venue_type: body.venue_type, scriptChars: script.length },
    "outro script ready",
  );

  try {
    const apiKey = process.env.ELEVENLABS_KEY;
    const voiceId = process.env.RTFR_MC ?? process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      req.log.warn("ElevenLabs credentials not configured — outro text-only");
      res.json({ ok: false, script });
      return;
    }

    const upstream = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.85 },
        }),
      },
    );

    if (!upstream.ok) {
      req.log.warn({ status: upstream.status }, "ElevenLabs outro request failed");
      res.json({ ok: false, script });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    req.log.info(
      { contentType, bufferBytes: buffer.byteLength },
      "ElevenLabs outro response received",
    );

    if (!contentType.startsWith("audio/") || buffer.byteLength < 5120) {
      req.log.warn(
        { contentType, bufferBytes: buffer.byteLength },
        "ElevenLabs outro response failed validation — text-only fallback",
      );
      res.json({ ok: false, audio: null, script });
      return;
    }

    res.json({ ok: true, contentType: "audio/mpeg", audio: buffer.toString("base64"), script });
  } catch (err) {
    req.log.error({ err }, "outro route error");
    res.json({ ok: false, script });
  }
});

export default router;
