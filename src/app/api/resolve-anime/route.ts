import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id"); // anilist ID
  const e = searchParams.get("e") || "1";
  const sub = searchParams.get("sub") || "sub";

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing AniList ID" }, { status: 400 });
  }

  try {
    const embedUrl = `https://cdn.4animo.xyz/embed/hd-1/ani/${id}/${e}/${sub}?k=1`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://megaplay.buzz/",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` }, { status: res.status });
    }

    const html = await res.text();
    const tokenMatch = html.match(/var\s+sourcesUrl\s*=\s*['"]([^'"]+)['"]/);

    if (!tokenMatch || !tokenMatch[1]) {
      return NextResponse.json({ ok: false, error: "No sources URL token in page" }, { status: 404 });
    }

    const apiRes = await fetch(`https://cdn.4animo.xyz${tokenMatch[1]}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": embedUrl,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!apiRes.ok) {
      return NextResponse.json({ ok: false, error: `API HTTP ${apiRes.status}` }, { status: apiRes.status });
    }

    const data = await apiRes.json();
    const streamPath = data?.sources?.[0]?.file;

    if (streamPath) {
      const fullStreamUrl = streamPath.startsWith("http")
        ? streamPath
        : `https://cdn.4animo.xyz${streamPath}`;

      return NextResponse.json({
        ok: true,
        playable: fullStreamUrl,
        label: "⚡ ReCloud Direct HLS (Video.js)",
        type: "hls",
        tracks: data?.tracks || [],
      });
    }

    return NextResponse.json({ ok: false, error: "No stream source found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
