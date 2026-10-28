/**
 * AniList GraphQL client — anime catalog with rich metadata.
 *
 * AniList is a free, public GraphQL API. No API key required.
 * Docs: https://docs.anilist.co/
 */

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface AnimeMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string; color: string | null };
  bannerImage: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  genres: string[];
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  status: string | null;
}

async function anilistQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(`AniList GraphQL: ${JSON.stringify(data.errors)}`);
  return data.data as T;
}

const TRENDING_QUERY = `
  query Trending($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC) {
        id
        idMal
        title { romaji english native }
        coverImage { large extraLarge color }
        bannerImage
        description(asHtml: false)
        episodes
        duration
        averageScore
        genres
        season
        seasonYear
        format
        status
      }
    }
  }
`;

const SEASONAL_QUERY = `
  query Seasonal($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) {
        id
        idMal
        title { romaji english native }
        coverImage { large extraLarge color }
        bannerImage
        description(asHtml: false)
        episodes
        duration
        averageScore
        genres
        season
        seasonYear
        format
        status
      }
    }
  }
`;

const SEARCH_QUERY = `
  query Search($search: String!, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
        id
        idMal
        title { romaji english native }
        coverImage { large extraLarge color }
        bannerImage
        description(asHtml: false)
        episodes
        duration
        averageScore
        genres
        season
        seasonYear
        format
        status
      }
    }
  }
`;

const DETAIL_QUERY = `
  query Detail($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native }
      coverImage { large extraLarge color }
      bannerImage
      description(asHtml: false)
      episodes
      duration
      averageScore
      genres
      season
      seasonYear
      format
      status
    }
  }
`;

export async function trendingAnime(page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await anilistQuery<{ Page: { media: AnimeMedia[] } }>(TRENDING_QUERY, { page, perPage });
  return data.Page.media;
}

export async function seasonalAnime(season: "WINTER" | "SPRING" | "SUMMER" | "FALL", year: number, page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await anilistQuery<{ Page: { media: AnimeMedia[] } }>(SEASONAL_QUERY, { season, year, page, perPage });
  return data.Page.media;
}

export async function searchAnime(search: string, page = 1, perPage = 20): Promise<AnimeMedia[]> {
  const data = await anilistQuery<{ Page: { media: AnimeMedia[] } }>(SEARCH_QUERY, { search, page, perPage });
  return data.Page.media;
}

export async function animeDetail(id: number): Promise<AnimeMedia> {
  const data = await anilistQuery<{ Media: AnimeMedia }>(DETAIL_QUERY, { id });
  return data.Media;
}

export function animeDisplayName(a: AnimeMedia): string {
  return a.title.english || a.title.romaji || a.title.native || `Anime ${a.id}`;
}
