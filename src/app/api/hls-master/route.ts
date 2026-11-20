import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface StreamQuality {
  quality: string;
  url: string;
}

interface AudioTrack {
  language: string;
  label: string;
  url: string;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dataParam = searchParams.get("data");

  if (!dataParam) {
    return new NextResponse("#EXTM3U\n", { status: 400 });
  }

  try {
    const raw = Buffer.from(decodeURIComponent(dataParam), "base64").toString("utf-8");
    const parsed = JSON.parse(raw);

    let qualities: StreamQuality[] = [];
    let audios: AudioTrack[] = [];

    if (Array.isArray(parsed)) {
      qualities = parsed;
    } else if (parsed && typeof parsed === "object") {
      qualities = parsed.qualities || [];
      audios = parsed.audios || [];
    }

    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

    // Filter to valid direct CDN m3u8 streams, skip "Auto" label, remove worker shard URLs
    const validQualities = qualities.filter(
      (q) => q && q.url && q.url.startsWith("http") && q.quality?.toLowerCase() !== "auto" && !q.url.includes("workers.dev")
    );
    const sortedQualities = [...validQualities].sort((a, b) => {
      const hA = parseInt(a.quality) || 0;
      const hB = parseInt(b.quality) || 0;
      return hB - hA;
    });

    // Strictly deduplicate by resolution height
    const seenHeights = new Set<number>();
    const uniqueQualities: StreamQuality[] = [];
    for (const q of sortedQualities) {
      const h = parseInt(q.quality) || 720;
      if (!seenHeights.has(h)) {
        seenHeights.add(h);
        uniqueQualities.push(q);
      }
    }

    // Pure multivariant HLS video playlist (audio is in-stream multiplexed per language stream)
    for (const q of uniqueQualities) {
      const label = q.quality || "720p";
      const height = parseInt(label) || 720;
      let width = 1280;
      let bandwidth = 2500000;

      if (height >= 1080) {
        width = 1920;
        bandwidth = 5000000;
      } else if (height >= 720) {
        width = 1280;
        bandwidth = 2500000;
      } else if (height >= 480) {
        width = 854;
        bandwidth = 1200000;
      } else {
        width = 640;
        bandwidth = 800000;
      }

      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${label}"`
      );
      lines.push(q.url);
    }

    const manifest = lines.join("\n") + "\n";

    return new NextResponse(manifest, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err: any) {
    return new NextResponse("#EXTM3U\n", { status: 500 });
  }
}
