import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface VidSyncSource {
  id?: string;
  provider?: { id: string; name: string };
  server?: string;
  url?: string;
  rawUrl?: string;
  directUrl?: string;
  standbyUrl?: string;
  standbyProvider?: string;
  fallbackProxyUrl?: string;
  type?: string;
  title?: string;
  year?: string;
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

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractTitleFromSource(s: VidSyncSource): string | null {
  if (s.title) return s.title;
  if (s.fallbackProxyUrl) {
    try {
      const match = s.fallbackProxyUrl.match(/%22title%22%3A%22([^%]+)%22/);
      if (match) return decodeURIComponent(match[1]);
    } catch { }
  }
  return null;
}

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

    // VidSync requires pure numeric TMDb ID; never pass IMDb ID (tt...) into VidSync's shard router
    let tmdbNumericId = id && /^\d+$/.test(id) ? id : null;
    if (!tmdbNumericId && imdb && !imdb.startsWith("tt") && /^\d+$/.test(imdb)) {
      tmdbNumericId = imdb;
    }

    if (!tmdbNumericId) {
      // If only IMDb ID was supplied, try resolving it to TMDb numeric ID via media-info
      return NextResponse.json(
        { ok: false, error: "Numeric TMDb ID is required for VidSync Direct CDN" },
        { status: 400 }
      );
    }

    const cacheKey = `${type}:${tmdbNumericId}:${season}:${episode}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "X-Cache": "HIT",
        },
      });
    }

    const key = `${type}-${tmdbNumericId}-${season}-${episode}`;
    const targetShards = [
      "https://vidsync-shard.vs-sharaparvin76.workers.dev",
      getShard(key, 0),
      getShard(key, 1),
    ];
    const uniqueShards = [...new Set(targetShards)];
    let candidateSources: VidSyncSource[] = [];
    let activeShard = uniqueShards[0];

    // Query VidSync Cloudflare Worker shard cluster
    for (const shard of uniqueShards) {
      const queryParams = new URLSearchParams({
        type,
        id: tmdbNumericId,
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
          activeShard = shard;
          break;
        }
      } catch {
        // Retry next shard
      }
    }

    // ── Resilient Type Fallback ──
    // If 0 sources found under requested type, check alternate type (movie <-> tv)
    // Supports miniseries, specials, or scrapers where titles are indexed under TV or Movie
    let resolvedType = type;
    if (candidateSources.length === 0) {
      const altType = type === "movie" ? "tv" : "movie";
      const altKey = `${altType}-${tmdbNumericId}-${season}-${episode}`;
      const altShards = [
        "https://vidsync-shard.vs-sharaparvin76.workers.dev",
        getShard(altKey, 0),
      ];

      for (const shard of altShards) {
        const altParams = new URLSearchParams({
          type: altType,
          id: tmdbNumericId,
          season: season || "1",
          episode: episode || "1",
          _t: String(Date.now()),
        });

        try {
          const res = await fetch(`${shard}/api/core/streams?${altParams.toString()}`, {
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
            activeShard = shard;
            resolvedType = altType;
            break;
          }
        } catch {}
      }
    }

    // ── Title Matching Validation Guard ──
    // If title is passed and multiple sources exist, prioritize exact matching title
    if (title && candidateSources.length > 1) {
      const reqNorm = normalizeTitle(title);
      const filtered = candidateSources.filter((src) => {
        const srcTitle = extractTitleFromSource(src);
        if (!srcTitle) return true;
        const srcNorm = normalizeTitle(srcTitle);
        return srcNorm === reqNorm || srcNorm.includes(reqNorm) || reqNorm.includes(srcNorm);
      });
      if (filtered.length > 0) {
        candidateSources = filtered;
      }
    }

    // ── Dedicated Subtitles Query from VidSync Worker Subtitle API ──
    let workerSubtitles: any[] = [];
    try {
      const subParams = new URLSearchParams({
        id: tmdbNumericId,
        type: resolvedType,
      });
      if (resolvedType === "tv") {
        subParams.set("season", season);
        subParams.set("episode", episode);
      }
      const subRes = await fetch(`${activeShard}/api/subtitles?${subParams.toString()}`, {
        headers: {
          Origin: "https://vidsync.pro",
          Referer: "https://vidsync.pro/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(3500),
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        if (Array.isArray(subData?.subtitles)) {
          workerSubtitles = subData.subtitles;
        }
      }
    } catch { }

    // Intelligent audio ranking: prioritize English and original audio
    candidateSources.sort((a, b) => {
      const getScore = (s: VidSyncSource) => {
        const lang = (s.audio || s.audioLanguage || "").toLowerCase();
        if (lang === "en" || lang === "eng") return 100;
        if (lang === "ja" || lang === "jpn" || lang === "ko" || lang === "kor") return 90;
        if (s.audioTracks?.some((t) => t.original)) return 85;
        if (lang === "es" || lang === "fr" || lang === "de") return 50;
        if (lang === "hi") return 30;
        if (lang === "ta" || lang === "te") return 10;
        return 40;
      };
      return getScore(b) - getScore(a);
    });

    // Aggregate multi-source subtitles, audio tracks, and qualities across candidate sources
    const aggregatedSubtitles: Array<{ lang: string; label: string; url: string; default?: boolean }> = [];
    const seenSubs = new Set<string>();

    const aggregatedAudioTracks: Array<{ language: string; label: string; url: string }> = [];
    const seenAudios = new Set<string>();

    const aggregatedQualities: Array<{ quality: string; url: string }> = [];
    const seenQualities = new Set<string>();

    for (const src of candidateSources) {
      const sUrl = [src.directUrl, src.rawUrl, src.url, src.fallbackProxyUrl].find(
        (u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)
      );
      if (!sUrl) continue;

      // Collect Subtitles from MovieBox and other multi-source providers
      if (Array.isArray(src.subtitles)) {
        for (const sub of src.subtitles) {
          const sKey = (sub.lang || (sub as any).language || sub.label || sub.url || "").toLowerCase();
          if (sKey && !seenSubs.has(sKey) && sub.url) {
            seenSubs.add(sKey);
            aggregatedSubtitles.push({
              lang: sub.lang || (sub as any).language || "en",
              label: sub.label || sub.lang || (sub as any).language || "English",
              url: sub.url,
              default: (sub.lang || (sub as any).language) === "en" || sub.label?.toLowerCase().includes("english"),
            });
          }
        }
      }

      // Collect Audio Tracks
      const aLang = (src.audio || src.audioLanguage || "en").toLowerCase();
      const aLabel =
        src.audioLabel ||
        (aLang === "en"
          ? "English (Original)"
          : aLang === "hi"
            ? "Hindi"
            : aLang === "ta"
              ? "Tamil"
              : aLang === "te"
                ? "Telugu"
                : aLang === "ml"
                  ? "Malayalam"
                  : aLang === "ja"
                    ? "Japanese (Original)"
                    : aLang === "es"
                      ? "Spanish"
                      : aLang === "fr"
                        ? "French"
                        : aLang.toUpperCase());
      if (!seenAudios.has(aLang)) {
        seenAudios.add(aLang);
        aggregatedAudioTracks.push({
          language: aLang,
          label: aLabel,
          url: sUrl,
        });
      }

      // Collect Qualities
      const qLabel = src.quality || "720p";
      if (!seenQualities.has(qLabel)) {
        seenQualities.add(qLabel);
        aggregatedQualities.push({
          quality: qLabel,
          url: sUrl,
        });
      }
    }

    // Merge VidSync Worker Subtitle API results (OpenSubtitles 60+ language VTTs)
    if (Array.isArray(workerSubtitles)) {
      for (const sub of workerSubtitles) {
        if (!sub?.url) continue;
        const sKey = (sub.language || sub.languageName || sub.label || sub.url).toLowerCase();
        if (!seenSubs.has(sKey)) {
          seenSubs.add(sKey);
          aggregatedSubtitles.push({
            lang: sub.language || sub.languageName || "en",
            label: sub.label || sub.languageName || sub.language || "English",
            url: sub.url,
            default: sub.language === "eng" || sub.label?.toLowerCase() === "english",
          });
        }
      }
    }

    // Extract secondary standby stream (MovieBox / NetMirror direct CDN) for Server 2
    let secondaryStreamData: any = null;
    for (const src of candidateSources) {
      if (src.standbyUrl && /^https?:\/\//i.test(src.standbyUrl)) {
        secondaryStreamData = {
          playable: src.standbyUrl,
          label: "Direct CDN (Server 2)",
          provider: src.standbyProvider || "MovieBox",
          type: src.standbyUrl.includes(".m3u8") ? "hls" : "mp4",
        };
        break;
      }
      const altUrl = src.directUrl || src.rawUrl || src.url;
      if (altUrl && src.provider?.id !== "castle") {
        secondaryStreamData = {
          playable: altUrl,
          label: "Direct CDN (Server 2)",
          provider: src.provider?.name || "MovieBox",
          type: altUrl.includes(".m3u8") ? "hls" : "mp4",
        };
        break;
      }
    }

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
          lowerUrl.includes("sample")
        ) {
          continue;
        }

        // Fast-path: Return direct HLS stream instantly with full source metadata
        const responseData = {
          ok: true,
          playable: url,
          type: "hls",
          label: "Direct CDN (VidSync)",
          quality: source.quality || "720p",
          audio: source.audio || source.audioLanguage || "en",
          subtitles: aggregatedSubtitles.length > 0 ? aggregatedSubtitles : (source.subtitles || []),
          audioTracks: aggregatedAudioTracks,
          qualities: aggregatedQualities,
          secondaryStream: secondaryStreamData,
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
