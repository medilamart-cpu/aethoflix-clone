import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface SubtitleItem {
  lang: string;
  label: string;
  format?: string;
  url: string;
}

// In-memory cache for resolved streams (15 minute TTL)
const STREAM_CACHE = new Map<string, { data: any; expiry: number }>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "movie";
    const id = searchParams.get("id");
    const season = searchParams.get("s") || searchParams.get("season") || "1";
    const episode = searchParams.get("e") || searchParams.get("episode") || "1";

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing TMDb ID" }, { status: 400 });
    }

    const cacheKey = `${type}:${id}:${season}:${episode}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
          "X-Cache": "HIT",
        },
      });
    }

    // Step 1: Initiate session handshake with TheOGPirateBot / Elfura engine
    const sessionBody =
      type === "movie"
        ? { type: "movie", tmdb: String(id) }
        : { type: "tv", tmdb: String(id), season: Number(season), episode: Number(episode) };

    const sessionRes = await fetch("https://embed.theogpiratebot.online/api/v1/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://embed.theogpiratebot.online/",
      },
      body: JSON.stringify(sessionBody),
      signal: AbortSignal.timeout(12000),
    });

    if (!sessionRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Session handshake failed: HTTP ${sessionRes.status}` },
        { status: sessionRes.status }
      );
    }

    const sessionData = await sessionRes.json();
    if (!sessionData.ok || !sessionData.pltoken) {
      return NextResponse.json({ ok: false, error: "Invalid playback session token" }, { status: 502 });
    }

    // Step 2: Query playback resolution
    const queryParams = new URLSearchParams({
      type,
      tmdb: String(id),
      nonce: sessionData.nonce,
    });
    if (type === "tv") {
      queryParams.set("season", String(season));
      queryParams.set("episode", String(episode));
    }

    const playbackRes = await fetch(
      `https://embed.theogpiratebot.online/api/v1/playback?${queryParams.toString()}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Referer: "https://embed.theogpiratebot.online/",
          "X-Playback-Token": sessionData.pltoken,
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!playbackRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Playback resolution failed: HTTP ${playbackRes.status}` },
        { status: playbackRes.status }
      );
    }

    const playbackData = await playbackRes.json();
    if (!playbackData.ok || !playbackData.primary?.url) {
      return NextResponse.json({ ok: false, error: "No primary stream returned" }, { status: 404 });
    }

    const rawStreamUrl = playbackData.primary.url;
    const fullPlayableUrl = rawStreamUrl.startsWith("http")
      ? rawStreamUrl
      : `https://embed.theogpiratebot.online${rawStreamUrl}`;

    // Normalize subtitles
    const subtitles: SubtitleItem[] = (playbackData.primary.subtitles || []).map((sub: any) => ({
      lang: sub.lang || "en",
      label: sub.label || "English",
      format: sub.format || "srt",
      url: sub.url?.startsWith("http")
        ? sub.url
        : `https://embed.theogpiratebot.online${sub.url}`,
    }));

    const responsePayload = {
      ok: true,
      playable: fullPlayableUrl,
      type: "hls",
      label: "Direct CDN (TheOGPirateBot)",
      provider: "TheOGPirateBot",
      quality: playbackData.primary.quality || "720p/HD",
      audio: playbackData.primary.availableAudioLangs || ["en"],
      subtitles,
      sourcesCount: playbackData.sources?.length || 1,
    };

    // Store in edge memory cache for 15 minutes (900,000 ms)
    STREAM_CACHE.set(cacheKey, {
      data: responsePayload,
      expiry: Date.now() + 15 * 60 * 1000,
    });

    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Cache": "MISS",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error resolving TheOGPirateBot" },
      { status: 500 }
    );
  }
}

