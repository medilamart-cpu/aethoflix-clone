/**
 * TMDb v3 API client — catalog data for movies, TV, and trailers.
 *
 * AethoFlix uses two TMDb hosts (api.themoviedb.org + api.tmdb.org) and
 * falls back if one fails. We mirror that behaviour for resilience.
 *
 * Get a free API key at: https://www.themoviedb.org/settings/api
 */

const TMDB_API_KEYS: string[] = [
  process.env.NEXT_PUBLIC_TMDB_API_KEY,
  "fca1c3fa675f74cf4aa8d24b72dd4807", // Aethoplex production key
  "27627ea97ee58d929e156ea961c6e255",
].filter(Boolean) as string[];

const TMDB_PRIMARY = "https://api.tmdb.org/3";
const TMDB_FALLBACK = "https://api.themoviedb.org/3";

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export function posterUrl(
  path: string | null | undefined,
  size: "w185" | "w200" | "w342" | "w500" | "original" = "w342"
): string {
  if (!path) return "/placeholder.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(
  path: string | null | undefined,
  size: "w780" | "w1280" | "original" = "w1280"
): string {
  if (!path) return "/placeholder.svg";
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrendingMedia {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
  release_date: string | null;
}

export interface MovieListItem {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string | null;
}

export interface TVListItem {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string | null;
  original_language?: string;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
}

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
}

export interface MovieDetail extends MovieListItem {
  runtime: number | null;
  genres: { id: number; name: string }[];
  similar: { results: MovieListItem[] };
}

export interface TVDetail extends TVListItem {
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  seasons: Season[];
  similar: { results: TVListItem[] };
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: "YouTube" | "Vimeo";
  type: "Trailer" | "Teaser" | "Clip" | "Featurette" | "Behind the Scenes" | "Bloopers";
  official: boolean;
}

// ── Internal fetch helper with primary/fallback ──────────────────────────────

export async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const queryParams = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
  let lastError: unknown = null;

  for (const base of [TMDB_PRIMARY, TMDB_FALLBACK]) {
    for (const key of TMDB_API_KEYS) {
      const searchParams = new URLSearchParams({
        api_key: key,
        language: "en-US",
        ...queryParams,
      });
      const url = `${base}${path}?${searchParams.toString()}`;
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
          next: { revalidate: 1800 }, // cache 30 min on the edge
          signal: AbortSignal.timeout(3000),
        });
        if (res.status === 429) continue; // Rate-limited on this key, try backup key!
        if (!res.ok) throw new Error(`HTTP ${res.status} on ${base}`);
        return (await res.json()) as T;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError ?? new Error("TMDB service is currently unavailable");
}

// ── Public catalog methods ────────────────────────────────────────────────────

export async function trending(mediaType: "all" | "movie" | "tv" = "all", window: "day" | "week" = "week", page = 1): Promise<TrendingMedia[]> {
  const data = await tmdbFetch<{ results: TrendingMedia[] }>(`/trending/${mediaType}/${window}`, { page });
  return data.results ?? [];
}

export async function moviesNowPlaying(page = 1): Promise<MovieListItem[]> {
  const data = await tmdbFetch<{ results: MovieListItem[] }>(`/movie/now_playing`, { page });
  return data.results ?? [];
}

export async function moviesPopular(page = 1): Promise<MovieListItem[]> {
  const data = await tmdbFetch<{ results: MovieListItem[] }>(`/movie/popular`, { page });
  return data.results ?? [];
}

export async function moviesTopRated(page = 1): Promise<MovieListItem[]> {
  const data = await tmdbFetch<{ results: MovieListItem[] }>(`/movie/top_rated`, { page });
  return data.results ?? [];
}

export async function moviesFromIndia(page = 1): Promise<MovieListItem[]> {
  const data = await tmdbFetch<{ results: MovieListItem[] }>(`/discover/movie`, {
    with_origin_country: "IN", sort_by: "popularity.desc", include_adult: false, page,
  });
  return data.results ?? [];
}

export async function tvPopular(page = 1): Promise<TVListItem[]> {
  const data = await tmdbFetch<{ results: TVListItem[] }>(`/tv/popular`, { page });
  return data.results ?? [];
}

export async function tvTopRated(page = 1): Promise<TVListItem[]> {
  const data = await tmdbFetch<{ results: TVListItem[] }>(`/tv/top_rated`, { page });
  return data.results ?? [];
}

export async function tvAiringToday(page = 1): Promise<TVListItem[]> {
  const data = await tmdbFetch<{ results: TVListItem[] }>(`/tv/airing_today`, { page });
  return data.results ?? [];
}

export interface DiscoverTVParams {
  with_genres?: string; // comma-separated TMDb genre IDs
  with_original_language?: string; // e.g., "ko" for Korean content
  with_origin_country?: string;
  first_air_date_year?: number;
  sort_by?: string; // e.g., "popularity.desc"
  include_adult?: boolean;
  page?: number;
}

export async function discoverTV(params: DiscoverTVParams = {}): Promise<TVListItem[]> {
  const data = await tmdbFetch<{ results: TVListItem[] }>(`/discover/tv`, {
    sort_by: params.sort_by ?? "popularity.desc",
    include_adult: params.include_adult ?? false,
    page: params.page ?? 1,
    ...(params.with_genres ? { with_genres: params.with_genres } : {}),
    ...(params.with_original_language ? { with_original_language: params.with_original_language } : {}),
    ...(params.with_origin_country ? { with_origin_country: params.with_origin_country } : {}),
    ...(params.first_air_date_year ? { first_air_date_year: params.first_air_date_year } : {}),
  });
  return data.results ?? [];
}

export async function kdrama(sortBy: string = "popularity.desc", page = 1): Promise<TVListItem[]> {
  return discoverTV({ with_original_language: "ko", sort_by: sortBy, page });
}

export async function searchMulti(query: string, page = 1): Promise<TrendingMedia[]> {
  const data = await tmdbFetch<{ results: TrendingMedia[] }>(`/search/multi`, { query, page });
  return (data.results ?? []).filter((r) => r.media_type === "movie" || r.media_type === "tv");
}

export async function searchKeyword(query: string): Promise<{ id: number; name: string }[]> {
  const data = await tmdbFetch<{ results: { id: number; name: string }[] }>(`/search/keyword`, { query });
  return data.results ?? [];
}

export async function movieDetail(id: number): Promise<MovieDetail> {
  return tmdbFetch<MovieDetail>(`/movie/${id}`, { append_to_response: "similar,videos" });
}

export async function tvDetail(id: number): Promise<TVDetail> {
  return tmdbFetch<TVDetail>(`/tv/${id}`, { append_to_response: "similar,videos" });
}

export async function tvSeason(tvId: number, seasonNumber: number): Promise<{ episodes: Episode[] }> {
  return tmdbFetch<{ episodes: Episode[] }>(`/tv/${tvId}/season/${seasonNumber}`);
}

export const tvSeasonDetail = tvSeason;

export async function videos(mediaType: "movie" | "tv", id: number): Promise<Video[]> {
  const data = await tmdbFetch<{ results: Video[] }>(`/${mediaType}/${id}/videos`);
  return data.results ?? [];
}

export async function trailerUrl(mediaType: "movie" | "tv", id: number): Promise<string | null> {
  const vids = await videos(mediaType, id);
  // Prefer official trailers on YouTube
  for (const v of vids) {
    if (v.site === "YouTube" && v.type === "Trailer" && v.official) {
      return `https://www.youtube-nocookie.com/embed/${v.key}?autoplay=1`;
    }
  }
  for (const v of vids) {
    if (v.site === "YouTube" && v.type === "Trailer") {
      return `https://www.youtube-nocookie.com/embed/${v.key}?autoplay=1`;
    }
  }
  for (const v of vids) {
    if (v.site === "YouTube") {
      return `https://www.youtube-nocookie.com/embed/${v.key}?autoplay=1`;
    }
  }
  return null;
}
