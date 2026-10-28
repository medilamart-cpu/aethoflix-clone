import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch, type TVDetail } from "@/lib/tmdb";
import { getKnownAnimeMatch } from "@/lib/providers";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const tmdbId = searchParams.get("tmdbId");

  try {
    // 1. If tmdbId is provided, get the full TV show info and query AniList
    if (tmdbId) {
      const idNum = Number(tmdbId);
      const tv = await tmdbFetch<TVDetail>(`/tv/${idNum}`);
      const searchTitle = tv.name || "";

      // Check known anime map first for instant zero-latency match
      const known = getKnownAnimeMatch(idNum);
      if (known) {
        return NextResponse.json({
          ok: true,
          tv,
          anilistId: known.anilistId,
          malId: known.malId,
        });
      }

      // Query AniList
      let anilistMatch = null;
      try {
        const aniRes = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          body: JSON.stringify({
            query: "query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { romaji english } } }",
            variables: { search: searchTitle },
          }),
        });
        if (aniRes.ok) {
          const aniData = await aniRes.json();
          anilistMatch = aniData?.data?.Media || null;
        }
      } catch {}

      return NextResponse.json({
        ok: true,
        tv,
        anilistId: anilistMatch?.id || null,
        malId: anilistMatch?.idMal || null,
      });
    }

    // 2. If title is provided, search TMDb for the TV show
    if (title) {
      const searchRes = await tmdbFetch<{ results: any[] }>(`/search/tv`, { query: title });
      const first = searchRes.results?.[0];
      if (first) {
        const tv = await tmdbFetch<TVDetail>(`/tv/${first.id}`);
        return NextResponse.json({
          ok: true,
          tv,
        });
      }
    }

    return NextResponse.json({ ok: false, error: "No match found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
