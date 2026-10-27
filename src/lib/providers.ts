/**
 * Streaming providers — the 9 embed providers AethoFlix uses.
 *
 * Each provider is a public embed site that takes a TMDb ID (or AniList ID
 * for anime) and serves a player in an iframe. We just construct the URL;
 * we never proxy the content. The user's browser loads the iframe
 * directly from the provider's domain.
 *
 * ── Provider table ───────────────────────────────────────────────────────
 *
 *  Movie / TV providers (use TMDb IDs):
 *    Server 1  TG Vid      tgvid.lovable.app/embed/(movie|tv)/{id}[/{s}/{e}]
 *    Server 2  VidStuck    vidstuck.cc/embed/(movie|tv)/{id}[/{s}/{e}]
 *    Server 3  ZXCStream   zxcstream.cc/player/(movie|tv)/{id}[/{s}/{e}]
 *    Server 4  VidFast     vidfast.vc/(movie|tv)/{id}[/{s}/{e}]
 *    Server 5  Nxsha       nxsha.space/embed/(movie|tv)/{id}[/{s}/{e}]
 *    Server 6  Bingr       bingr.one/watch/(movie|tv)/{id}[/{s}/{e}]
 *
 *  Anime providers (use AniList or MAL IDs):
 *    Server A1  MegaPlay    megaplay.buzz/stream/ani/{anilist_id}/{s}/{e}
 *    Server A2  ReCloud     cdn.4animo.xyz/embed/hd-1/ani/{anilist_id}/{s}/{e}?k=1
 *    Server A3  Zokoanime   zokoanime.video/stream/{anilist|mal}/{id}/{s}/{e}?color=ffffff
 *
 *  Trailer (not really a "provider", but listed for completeness):
 *    YouTube    youtube-nocookie.com/embed/{key}?autoplay=1
 *
 * ── Maintenance notes ────────────────────────────────────────────────────
 *
 *  Embed providers get DMCA'd constantly. Typical lifecycle:
 *  • Provider appears with a fresh domain
 *  • Aggregators add it to their mirror list
 *  • After 1-3 months, rights holder DMCA's the provider's registrar
 *  • Provider re-emerges under a new domain (e.g., vidstuck.cc → vidstuck.tv)
 *  • Aggregator must update its URL builder and ship a new deploy
 *
 *  Set up a monitor (see MAINTAINER_PLAYBOOK.md) that pings every provider
 *  with a known TMDb ID once an hour and alerts you when one starts
 *  returning 404 / 451 / timeout.
 *
 * ── Customisation ───────────────────────────────────────────────────────
 *
 *  To add a new provider, add an entry to STREAMING_PROVIDERS or
 *  ANIME_STREAMING_PROVIDERS with the right build_* closures.
 *  To remove one, delete the entry and ship a new deploy.
 *
 *  If you want to add a deep-link affiliate provider (Path A), e.g.,
 *  Netflix or Prime, you'd add a method that calls TMDb's
 *  /{media_type}/{id}/watch/providers endpoint and returns the deep link
 *  per region. That's a separate file — see lib/legit-providers.ts.example.
 */

export type MediaType = "movie" | "tv";

export interface StreamingProvider {
  label: string;          // "Server 1"
  provider: string;       // "TG Vid"
  base_url: string;       // "https://tgvid.lovable.app"
  supports_movie: boolean;
  supports_tv: boolean;
  supports_anime: boolean;
  sandbox_compatible?: boolean; // false for servers that detect/block iframe sandbox
  build_movie?: (tmdbId: number) => string;
  build_tv?: (tmdbId: number, season: number, episode: number) => string;
  build_anime?: (anilistId: number, malId: number | null, season: number, episode: number) => string;
}

// ── Movie / TV providers (TMDb IDs) ──────────────────────────────────────────

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  {
    label: "Server 1",
    provider: "VidLink",
    base_url: "https://vidlink.pro",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: true,
    build_movie: (id) => `https://vidlink.pro/movie/${id}`,
    build_tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 2",
    provider: "VidSrc",
    base_url: "https://vidsrc.pm",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false, // Detects sandbox and shows anti-sandbox screen
    build_movie: (id) => `https://vidsrc.pm/embed/movie/${id}`,
    build_tv: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 3",
    provider: "TG Vid",
    base_url: "https://tgvid.lovable.app",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: true,
    build_movie: (id) => `https://tgvid.lovable.app/embed/movie/${id}`,
    build_tv: (id, s, e) => `https://tgvid.lovable.app/embed/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 4",
    provider: "VidStuck",
    base_url: "https://vidstuck.cc",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false, // Requires local cookies & storage
    build_movie: (id) => `https://vidstuck.cc/embed/movie/${id}?color=ffffff`,
    build_tv: (id, s, e) => `https://vidstuck.cc/embed/tv/${id}/${s}/${e}?color=ffffff`,
  },
  {
    label: "Server 5",
    provider: "VidFast",
    base_url: "https://vidfast.vc",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: true,
    build_movie: (id) => `https://vidfast.vc/movie/${id}?autoPlay=true`,
    build_tv: (id, s, e) => `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true`,
  },
  {
    label: "Server 6",
    provider: "2Embed",
    base_url: "https://www.2embed.cc",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false, // Detects sandbox and shows error
    build_movie: (id) => `https://www.2embed.cc/embed/${id}`,
    build_tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    label: "Server 7",
    provider: "ZXCStream",
    base_url: "https://zxcstream.cc",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: true,
    build_movie: (id) => `https://zxcstream.cc/player/movie/${id}`,
    build_tv: (id, s, e) => `https://zxcstream.cc/player/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 8",
    provider: "Nxsha",
    base_url: "https://nxsha.space",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: true,
    build_movie: (id) => `https://nxsha.space/embed/movie/${id}`,
    build_tv: (id, s, e) => `https://nxsha.space/embed/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 9",
    provider: "Bingr",
    base_url: "https://bingr.one",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false, // Cloudflare Turnstile verification fails in sandbox
    build_movie: (id) => `https://bingr.one/watch/movie/${id}`,
    build_tv: (id, s, e) => `https://bingr.one/watch/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 10",
    provider: "AutoEmbed",
    base_url: "https://player.autoembed.cc",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false,
    build_movie: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    build_tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    label: "Server 11",
    provider: "EmbedSU",
    base_url: "https://embed.su",
    supports_movie: true,
    supports_tv: true,
    supports_anime: false,
    sandbox_compatible: false,
    build_movie: (id) => `https://embed.su/embed/movie/${id}`,
    build_tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
];

export function isProviderSandboxCompatible(urlOrLabel: string): boolean {
  const match = STREAMING_PROVIDERS.find(
    (p) =>
      p.label === urlOrLabel ||
      urlOrLabel.includes(p.base_url.replace("https://", "").replace("http://", ""))
  );
  // Default to false for third-party embeds unless explicitly known to tolerate sandboxing
  return match?.sandbox_compatible ?? false;
}

// ── Anime providers (AniList or MAL IDs) ─────────────────────────────────────

export const ANIME_STREAMING_PROVIDERS: StreamingProvider[] = [
  {
    label: "Server A1",
    provider: "MegaPlay",
    base_url: "https://megaplay.buzz",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, _mal, s, e) => `https://megaplay.buzz/stream/ani/${aid}/${s}/${e}`,
  },
  {
    label: "Server A2",
    provider: "ReCloud",
    base_url: "https://cdn.4animo.xyz",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, _mal, s, e) => `https://cdn.4animo.xyz/embed/hd-1/ani/${aid}/${s}/${e}?k=1`,
  },
  {
    label: "Server A3",
    provider: "Zokoanime",
    base_url: "https://zokoanime.video",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    // Zokoanime prefers MAL ID when available, falls back to AniList
    build_anime: (aid, mal, s, e) => mal
      ? `https://zokoanime.video/stream/mal/${mal}/${s}/${e}?color=ffffff`
      : `https://zokoanime.video/stream/anilist/${aid}/${s}/${e}?color=ffffff`,
  },
];

// ── Convenience builders ──────────────────────────────────────────────────────

export function movieStreamUrls(tmdbId: number): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const prov of STREAMING_PROVIDERS) {
    if (prov.build_movie) {
      try {
        urls[prov.label] = prov.build_movie(tmdbId);
      } catch {
        urls[prov.label] = "[unavailable]";
      }
    }
  }
  return urls;
}

export function tvStreamUrls(tmdbId: number, season: number, episode: number): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const prov of STREAMING_PROVIDERS) {
    if (prov.build_tv) {
      try {
        urls[prov.label] = prov.build_tv(tmdbId, season, episode);
      } catch {
        urls[prov.label] = "[unavailable]";
      }
    }
  }
  return urls;
}

export function animeStreamUrls(
  anilistId: number,
  season: number,
  episode: number,
  malId: number | null = null,
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const prov of ANIME_STREAMING_PROVIDERS) {
    if (prov.build_anime) {
      try {
        urls[prov.label] = prov.build_anime(anilistId, malId, season, episode);
      } catch {
        urls[prov.label] = "[unavailable]";
      }
    }
  }
  return urls;
}
