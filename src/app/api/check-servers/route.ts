import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface CandidateProvider {
  id: string;
  provider: string;
  buildUrl: (id: string, s?: string, e?: string) => string;
}

const CANDIDATE_PROVIDERS: CandidateProvider[] = [
  {
    id: "vidlink",
    provider: "VidLink",
    buildUrl: (id, s, e) =>
      s && e ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true` : `https://vidlink.pro/movie/${id}?autoplay=true`,
  },
  {
    id: "vidfast",
    provider: "VidFast",
    buildUrl: (id, s, e) =>
      s && e ? `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true` : `https://vidfast.vc/movie/${id}?autoPlay=true`,
  },
  {
    id: "zxc",
    provider: "ZXCStream",
    buildUrl: (id, s, e) =>
      s && e ? `https://zxcstream.cc/player/tv/${id}?season=${s}&episode=${e}` : `https://zxcstream.cc/player/movie/${id}`,
  },
  {
    id: "vidstuck",
    provider: "VidStuck",
    buildUrl: (id, s, e) =>
      s && e ? `https://vidstuck.cc/embed/tv/${id}/${s}/${e}?color=ffffff` : `https://vidstuck.cc/embed/movie/${id}?color=ffffff`,
  },
  {
    id: "bingr",
    provider: "Bingr",
    buildUrl: (id, s, e) =>
      s && e ? `https://bingr.one/watch/tv/${id}/${s}/${e}` : `https://bingr.one/watch/movie/${id}`,
  },
  {
    id: "nxsha",
    provider: "Nxsha",
    buildUrl: (id, s, e) =>
      s && e ? `https://nxsha.space/embed/tv/${id}/${s}/${e}` : `https://nxsha.space/embed/movie/${id}`,
  },
  {
    id: "vidsrc",
    provider: "VidSrc",
    buildUrl: (id, s, e) =>
      s && e ? `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` : `https://vidsrc.pm/embed/movie/${id}`,
  },
  {
    id: "2embed",
    provider: "2Embed",
    buildUrl: (id, s, e) =>
      s && e ? `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` : `https://www.2embed.cc/embed/${id}`,
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "movie";
  const id = searchParams.get("id");
  const s = searchParams.get("s") || "1";
  const e = searchParams.get("e") || "1";

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing media ID" }, { status: 400 });
  }

  // Probe candidates concurrently with a strict 2.5s timeout
  const probePromises = CANDIDATE_PROVIDERS.map(async (c) => {
    const url = c.buildUrl(id, type === "tv" ? s : undefined, type === "tv" ? e : undefined);
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://aethoplex.aethoflix.world/",
        },
        signal: AbortSignal.timeout(2800),
      });

      const latency = Date.now() - start;
      if (!res.ok) return null;

      // Check text for common "not found" / "no stream" signatures
      const text = await res.text();
      const isMissing =
        text.includes("File not found") ||
        text.includes("No stream found") ||
        text.includes("Coming soon") ||
        text.includes("File was deleted") ||
        text.includes("404 Not Found");

      if (isMissing) return null;

      return {
        id: c.id,
        provider: c.provider,
        url,
        latency,
        available: true,
      };
    } catch {
      return null;
    }
  });

  const probeResults = await Promise.all(probePromises);
  const availableServers = probeResults.filter((r): r is NonNullable<typeof r> => r !== null);

  // Sort available servers by actual response latency
  availableServers.sort((a, b) => a.latency - b.latency);

  // Dynamically assign sequential Server numbers (Server 1, Server 2...)
  const servers = availableServers.map((s, idx) => ({
    label: `Server ${idx + 1} (${s.provider})`,
    shortLabel: `Server ${idx + 1}`,
    id: s.id,
    provider: s.provider,
    url: s.url,
    latency: s.latency,
    available: true,
  }));

  return NextResponse.json(
    {
      ok: true,
      count: servers.length,
      servers,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
