import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "movie";
  const id = searchParams.get("id");
  const s = searchParams.get("s");
  const e = searchParams.get("e");

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing ID" }, { status: 400 });
  }

  const endpoint =
    type === "tv" && s && e
      ? `https://tgvidapi.lovable.app/api/tv/${id}/${s}/${e}`
      : `https://tgvidapi.lovable.app/api/m/${id}`;

  try {
    const res = await fetch(endpoint, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const link = data?.links?.[0];

    if (link && link.url) {
      return NextResponse.json({
        ok: true,
        playable: link.url,
        label: link.label || "TG Direct HLS 1080p",
        type: link.type || "hls",
      });
    }

    return NextResponse.json({ ok: false, error: "No direct links found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
