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

    // Filter to valid m3u8 streams, skip "Auto" label, sort descending (1080p, 720p, 480p, 360p)
    const validQualities = qualities.filter(
      (q) => q && q.url && q.url.startsWith("http") && q.quality?.toLowerCase() !== "auto"
    );
    const sortedQualities = [...validQualities].sort((a, b) => {
      const hA = parseInt(a.quality) || 0;
      const hB = parseInt(b.quality) || 0;
      return hB - hA;
    });

    // Filter to valid audio tracks
    const validAudios = audios.filter((a) => a && a.url && a.url.startsWith("http"));
    const hasAudios = validAudios.length > 1;

    // Output Audio Track definitions (#EXT-X-MEDIA:TYPE=AUDIO)
    if (hasAudios) {
      const seenAudios = new Set<string>();
      let isFirst = true;
      for (const a of validAudios) {
        const lang = a.language || "en";
        if (seenAudios.has(lang)) continue;
        seenAudios.add(lang);

        const label = a.label || lang.toUpperCase();
        const isDefault = isFirst || lang === "en";
        lines.push(
          `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${label}",DEFAULT=${isDefault ? "YES" : "NO"},AUTOSELECT=YES,LANGUAGE="${lang}",URI="${a.url}"`
        );
        isFirst = false;
      }
    }

    const audioAttr = hasAudios ? ',AUDIO="audio"' : "";

    for (const q of sortedQualities) {
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
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}${audioAttr},NAME="${label}"`
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
