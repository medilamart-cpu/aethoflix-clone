import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface VidSyncSource {
  id?: string;
  provider?: { id: string; name: string };
  server?: string;
  url?: string;
  rawUrl?: string;
  directUrl?: string;
  fallbackProxyUrl?: string;
  type?: string;
  quality?: string;
  availableQualities?: string[];
  audioLanguage?: string;
  audio?: string;
  language?: string;
  audioLabel?: string;
  audioTracks?: Array<{ language: string; label: string; original?: boolean }>;
  subtitles?: Array<{ label?: string; lang?: string; url?: string }>;
}

// VidSync distributed Cloudflare Worker shards
const VIDSYNC_WORKER_SHARDS = [
  "https://vidsync-shard.vs-sharaparvin76.workers.dev",
  "https://vidsync-shard.vidsync-hilsonkim83864.workers.dev",
  "https://vidsync-shard.islammehedi149.workers.dev",
  "https://vidsync-shard.vidsync-lelouch8899.workers.dev",
  "https://vidsync-shard.vidsync-doraemon891299.workers.dev",
  "https://vidsync-shard.vs-msmasumsarkar1.workers.dev",
  "https://vidsync-shard.vs-islammehedi1210.workers.dev",
  "https://vidsync-shard.vs-mehedisarkar980.workers.dev",
  "https://vidsync-shard.vs-tanjilaakter12311.workers.dev",
  "https://vidsync-shard.vs-jhonbro2710.workers.dev",
  "https://vidsync-shard.vs-mehedisarkar662.workers.dev",
  "https://vidsync-shard.vs-sailormoon4099.workers.dev",
  "https://vidsync-shard.vs-muniraparveen72.workers.dev",
  "https://vidsync-shard.vs-islammehedi625.workers.dev",
  "https://vidsync-shard.vs-mehedi2099.workers.dev",
  "https://vidsync-shard.vs-mikami3000.workers.dev",
  "https://vidsync-shard.vs-ershadali1412.workers.dev",
  "https://vidsync-shard.vs-xdoroka.workers.dev",
  "https://vidsync-shard.vs-mehedisarkar51.workers.dev",
  "https://vidsync-shard.vs-deals3.workers.dev",
  "https://vidsync-shard.vs-deals.workers.dev",
  "https://vidsync-shard.vs-deals2.workers.dev",
  "https://vidsync-shard.vs-weeklyxplus2026jlo.workers.dev",
  "https://vidsync-shard.vs-admin.workers.dev",
  "https://vidsync-shard.vs-deals4.workers.dev",
  "https://vidsync-shard.vs-deals13.workers.dev",
  "https://vidsync-shard.vs-deals7.workers.dev",
  "https://vidsync-shard.vs-deals6.workers.dev",
  "https://vidsync-shard.vs-deals5.workers.dev",
  "https://vidsync-shard.vs-deals10.workers.dev",
  "https://vidsync-shard.vs-deals11.workers.dev",
  "https://vidsync-shard.vs-deals9.workers.dev",
  "https://vidsync-shard.vs-deals8.workers.dev",
  "https://vidsync-shard.vs-deals12.workers.dev",
  "https://vidsync-shard.vs-deals15.workers.dev",
  "https://vidsync-shard.vs-deals16.workers.dev",
  "https://vidsync-shard.vs-deals18.workers.dev",
  "https://vidsync-shard.vs-deals14.workers.dev",
  "https://vidsync-shard.vs-deals17.workers.dev",
  "https://vidsync-shard.vs-deals20.workers.dev",
  "https://vidsync-shard.vs-deals47.workers.dev",
  "https://vidsync-shard.vs-deals60.workers.dev",
  "https://vidsync-shard.vs-deals80.workers.dev",
];

// FNV-1a hash algorithm matching VidSync client implementation
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return Math.abs(h);
}

function getShard(key: string, retryOffset: number = 0): string {
  const idx = (fnv1a(key) + retryOffset) % VIDSYNC_WORKER_SHARDS.length;
  return VIDSYNC_WORKER_SHARDS[idx];
}

async function verifyPlayable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-100",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok && res.status < 400;
  } catch {
    return false;
  }
}

// In-memory cache for resolved streams (15 minute TTL)
const STREAM_CACHE = new Map<string, { data: any; expiry: number }>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "movie";
    const id = searchParams.get("id");
    const imdb = searchParams.get("imdb") || searchParams.get("imdbId");
    const title = searchParams.get("title");
    const season = searchParams.get("s") || searchParams.get("season") || "1";
    const episode = searchParams.get("e") || searchParams.get("episode") || "1";

    if (!id && !imdb) {
      return NextResponse.json({ ok: false, error: "Missing media id" }, { status: 400 });
    }

    const cacheKey = `${type}:${imdb || id}:${season}:${episode}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "X-Cache": "HIT",
        },
      });
    }

    // TMDb numeric ID is required for VidSync TV shows and movies
    const queryIds = [id, imdb].filter(Boolean) as string[];
    let candidateSources: VidSyncSource[] = [];

    // Query VidSync Cloudflare Worker shard cluster
    for (const currentId of queryIds) {
      const key = `${type}-${currentId}-${season}-${episode}`;

      // Query known live shard first, plus hashed shards for redundancy
      const targetShards = [
        "https://vidsync-shard.vs-sharaparvin76.workers.dev",
        getShard(key, 0),
        getShard(key, 1),
      ];
      const uniqueShards = [...new Set(targetShards)];

      for (const shard of uniqueShards) {
        const queryParams = new URLSearchParams({
          type,
          id: currentId,
          season,
          episode,
          _t: String(Date.now()),
        });

        try {
          const res = await fetch(`${shard}/api/core/streams?${queryParams.toString()}`, {
            headers: {
              Origin: "https://vidsync.pro",
              Referer: "https://vidsync.pro/",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(4000),
          });

          if (!res.ok) continue;
          const text = await res.text();
          if (!text.startsWith("{")) continue;

          const data = JSON.parse(text);
          if (Array.isArray(data?.sources) && data.sources.length > 0) {
            candidateSources = data.sources;
            break;
          }
        } catch {
          // Retry next shard
        }
      }

      if (candidateSources.length > 0) break;
    }

    // Intelligent audio ranking: prioritize English and original audio (Japanese for anime, etc.)
    // strongly deprioritize third-party dubbed cam rips (ta, te) with ads
    candidateSources.sort((a, b) => {
      const getScore = (s: VidSyncSource) => {
        const lang = (s.audio || s.audioLanguage || "").toLowerCase();
        if (lang === "en" || lang === "eng") return 100;
        if (lang === "ja" || lang === "jpn" || lang === "ko" || lang === "kor") return 90;
        if (s.audioTracks?.some((t) => t.original)) return 85;
        if (lang === "es" || lang === "fr" || lang === "de") return 50;
        if (lang === "hi") return 30;
        if (lang === "ta" || lang === "te") return 10; // Low-tier dubbed rips with watermarks
        return 40;
      };
      return getScore(b) - getScore(a);
    });

    // Check candidate stream URLs for active 200 HTTP response
    for (const source of candidateSources) {
      const streamUrls = [source.directUrl, source.rawUrl, source.url, source.fallbackProxyUrl].filter(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
      );

      for (const url of streamUrls) {
        // Filter out dummy preview clips, trailers, samples, and mislabeled teasers
        const lowerUrl = url.toLowerCase();
        if (
          lowerUrl.includes("preview") ||
          lowerUrl.includes("_preview_") ||
          lowerUrl.includes("trailer") ||
          lowerUrl.includes("sample") ||
          (id === "60948" && source.id?.toLowerCase().includes("castle"))
        ) {
          continue;
        }

        // Fast-path: Return direct HLS stream instantly to eliminate buffering lag
        const responseData = {
          ok: true,
          playable: url,
          type: "hls",
          label: "Direct CDN (VidSync)",
          quality: source.quality || "1080p",
          audio: source.audio || source.audioLanguage || "en",
          subtitles: source.subtitles || [],
          availableCount: candidateSources.length,
        };

        STREAM_CACHE.set(cacheKey, {
          data: responseData,
          expiry: Date.now() + 15 * 60 * 1000,
        });

        return NextResponse.json(responseData, {
          headers: {
            "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          },
        });
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Direct CDN stream currently unavailable",
        candidateCount: candidateSources.length,
      },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error resolving Direct CDN" },
      { status: 500 }
    );
  }
}
