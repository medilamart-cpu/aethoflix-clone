import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface StreamQuality {
  quality: string;
  url: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dataParam = searchParams.get("data");

  if (!dataParam) {
    return new NextResponse("#EXTM3U\n", { status: 400 });
  }

  try {
    const raw = Buffer.from(dataParam, "base64").toString("utf-8");
    const qualities: StreamQuality[] = JSON.parse(raw);

    if (!Array.isArray(qualities) || qualities.length === 0) {
      return new NextResponse("#EXTM3U\n", { status: 400 });
    }

    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

    // Filter to valid m3u8 streams, skip "Auto" label (HLS master provides Auto automatically), and sort descending (1080p, 720p, 480p, 360p)
    const valid = qualities.filter(
      (q) => q && q.url && q.url.startsWith("http") && q.quality?.toLowerCase() !== "auto"
    );
    const sorted = [...valid].sort((a, b) => {
      const hA = parseInt(a.quality) || 0;
      const hB = parseInt(b.quality) || 0;
      return hB - hA;
    });

    for (const q of sorted) {
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
