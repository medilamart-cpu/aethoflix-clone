import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export const runtime = "edge";

interface FindResult {
  movie_results?: Array<{ id: number; title: string; release_date?: string; poster_path?: string }>;
  tv_results?: Array<{ id: number; name: string; first_air_date?: string; poster_path?: string }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawId = searchParams.get("id")?.trim();
  const typeParam = searchParams.get("type") as "movie" | "tv" | null;

  if (!rawId) {
    return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
  }

  // Case 1: IMDb ID (starts with "tt")
  if (rawId.startsWith("tt")) {
    try {
      const data = await tmdbFetch<FindResult>(`/find/${rawId}`, {
        external_source: "imdb_id",
      });

      if (data.movie_results && data.movie_results.length > 0) {
        const item = data.movie_results[0];
        return NextResponse.json({
          ok: true,
          input: rawId,
          mediaType: "movie",
          tmdbId: String(item.id),
          imdbId: rawId,
          title: item.title,
          year: item.release_date?.slice(0, 4) || "",
          posterPath: item.poster_path,
        });
      }

      if (data.tv_results && data.tv_results.length > 0) {
        const item = data.tv_results[0];
        return NextResponse.json({
          ok: true,
          input: rawId,
          mediaType: "tv",
          tmdbId: String(item.id),
          imdbId: rawId,
          title: item.name,
          year: item.first_air_date?.slice(0, 4) || "",
          posterPath: item.poster_path,
        });
      }

      return NextResponse.json({
        ok: false,
        error: `No TMDb match found for IMDb ID ${rawId}`,
        tmdbId: null,
        imdbId: rawId,
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message || "Failed to resolve IMDb ID",
          imdbId: rawId,
        },
        { status: 502 }
      );
    }
  }

  // Case 2: TMDb numeric ID
  if (/^\d+$/.test(rawId)) {
    const targetType = typeParam === "tv" ? "tv" : "movie";
    try {
      const data = await tmdbFetch<any>(`/${targetType}/${rawId}`, {
        append_to_response: "external_ids",
      });

      const imdbId = data.imdb_id || data.external_ids?.imdb_id || null;
      return NextResponse.json({
        ok: true,
        input: rawId,
        mediaType: targetType,
        tmdbId: rawId,
        imdbId,
        title: data.title || data.name || "",
        year: (data.release_date || data.first_air_date || "").slice(0, 4),
        posterPath: data.poster_path,
      });
    } catch {
      return NextResponse.json({
        ok: true,
        input: rawId,
        mediaType: targetType,
        tmdbId: rawId,
        imdbId: null,
        title: `Item #${rawId}`,
      });
    }
  }

  return NextResponse.json(
    { ok: false, error: "Invalid ID format. Enter TMDb ID (e.g. 693134) or IMDb ID (e.g. tt15239678)." },
    { status: 400 }
  );
}
