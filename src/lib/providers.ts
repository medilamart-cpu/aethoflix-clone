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

export interface AnimeServerOption {
  id: string;
  name: string;
  serverNumber: number;
  url: string;
}

export function getAnimeServers(
  anilistId: number,
  episode: number,
  subOrDub: "sub" | "dub" = "sub",
  malId: number | null = null,
): AnimeServerOption[] {
  const malUrl = malId
    ? `https://zokoanime.video/stream/mal/${malId}/${episode}/${subOrDub}?color=ffffff`
    : `https://zokoanime.video/stream/anilist/${anilistId}/${episode}/${subOrDub}?color=ffffff`;

  return [
    {
      id: "megaplay",
      name: "MegaPlay",
      serverNumber: 1,
      url: `https://megaplay.buzz/stream/ani/${anilistId}/${episode}/${subOrDub}`,
    },
    {
      id: "recloud-1",
      name: "ReCloud HD 1",
      serverNumber: 2,
      url: `https://cdn.4animo.xyz/embed/hd-1/ani/${anilistId}/${episode}/${subOrDub}?k=1`,
    },
    {
      id: "recloud-2",
      name: "ReCloud HD 2",
      serverNumber: 3,
      url: `https://cdn.4animo.xyz/embed/hd-2/ani/${anilistId}/${episode}/${subOrDub}?k=1`,
    },
    {
      id: "zokoanime",
      name: "Zokoanime",
      serverNumber: 4,
      url: malUrl,
    },
  ];
}

export const ANIME_STREAMING_PROVIDERS: StreamingProvider[] = [
  {
    label: "Server 1",
    provider: "MegaPlay",
    base_url: "https://megaplay.buzz",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, _mal, _s, e) => `https://megaplay.buzz/stream/ani/${aid}/${e}/sub`,
  },
  {
    label: "Server 2",
    provider: "ReCloud HD 1",
    base_url: "https://cdn.4animo.xyz",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, _mal, _s, e) => `https://cdn.4animo.xyz/embed/hd-1/ani/${aid}/${e}/sub?k=1`,
  },
  {
    label: "Server 3",
    provider: "ReCloud HD 2",
    base_url: "https://cdn.4animo.xyz",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, _mal, _s, e) => `https://cdn.4animo.xyz/embed/hd-2/ani/${aid}/${e}/sub?k=1`,
  },
  {
    label: "Server 4",
    provider: "Zokoanime",
    base_url: "https://zokoanime.video",
    supports_movie: false,
    supports_tv: false,
    supports_anime: true,
    build_anime: (aid, mal, _s, e) => mal
      ? `https://zokoanime.video/stream/mal/${mal}/${e}/sub?color=ffffff`
      : `https://zokoanime.video/stream/anilist/${aid}/${e}/sub?color=ffffff`,
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
  subOrDub: "sub" | "dub" = "sub",
): Record<string, string> {
  const servers = getAnimeServers(anilistId, episode, subOrDub, malId);
  const urls: Record<string, string> = {};
  for (const s of servers) {
    urls[`Server ${s.serverNumber}`] = s.url;
  }
  return urls;
}

export const KNOWN_ANIME_MAP: Record<number, { anilistId: number; malId: number }> = {
  37854: { anilistId: 21, malId: 21 }, // One Piece
  85937: { anilistId: 101922, malId: 38000 }, // Demon Slayer (Kimetsu no Yaiba)
  1429: { anilistId: 16498, malId: 16498 }, // Attack on Titan
  1399: { anilistId: 16498, malId: 16498 }, // Attack on Titan (alt)
  46260: { anilistId: 20, malId: 20 }, // Naruto
  1735: { anilistId: 269, malId: 269 }, // Bleach
  13916: { anilistId: 1535, malId: 1535 }, // Death Note
  88040: { anilistId: 113415, malId: 40748 }, // Jujutsu Kaisen
  45782: { anilistId: 11757, malId: 11757 }, // Sword Art Online
  65930: { anilistId: 21459, malId: 31964 }, // My Hero Academia
  61374: { anilistId: 20605, malId: 22319 }, // Tokyo Ghoul
  46298: { anilistId: 11061, malId: 11061 }, // Hunter x Hunter
  126963: { anilistId: 127230, malId: 44511 }, // Chainsaw Man
  209867: { anilistId: 154587, malId: 52991 }, // Frieren
  114410: { anilistId: 124080, malId: 43608 }, // Oshi no Ko
  99966: { anilistId: 120377, malId: 42203 }, // Solo Leveling
  215070: { anilistId: 163134, malId: 54900 }, // Dandadan
  80752: { anilistId: 105333, malId: 39535 }, // Dr. STONE
  65817: { anilistId: 21507, malId: 32182 }, // Mob Psycho 100
  95479: { anilistId: 101921, malId: 37779 }, // The Promised Neverland
  74313: { anilistId: 21827, malId: 33486 }, // Black Clover
  120089: { anilistId: 140960, malId: 50265 }, // Spy x Family
  135897: { anilistId: 137822, malId: 47887 }, // Blue Lock
  12971: { anilistId: 813, malId: 813 }, // Dragon Ball Z
  62715: { anilistId: 21175, malId: 30694 }, // Dragon Ball Super
};

export function getKnownAnimeMatch(tmdbId: number): { anilistId: number; malId: number } | null {
  return KNOWN_ANIME_MAP[tmdbId] || null;
}

