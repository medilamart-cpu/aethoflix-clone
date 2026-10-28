import { NextRequest, NextResponse } from "next/server";
import { tvSeasonDetail } from "@/lib/tmdb";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  try {
    const { id, seasonNumber } = await params;
    const tvId = Number(id);
    const season = Number(seasonNumber);

    if (!Number.isFinite(tvId) || tvId <= 0 || !Number.isFinite(season) || season < 0) {
      return NextResponse.json({ ok: false, error: "Invalid parameters" }, { status: 400 });
    }

    const data = await tvSeasonDetail(tvId, season);
    return NextResponse.json({ ok: true, episodes: data.episodes || [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to fetch season" }, { status: 500 });
  }
}
