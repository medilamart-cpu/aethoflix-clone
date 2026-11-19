import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const PRIMARY_SHARD = "https://vidsync-shard.vs-sharaparvin76.workers.dev";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = `${PRIMARY_SHARD}/api/core/proxy${url.search}`;

  const headers: Record<string, string> = {
    Origin: "https://vidsync.pro",
    Referer: "https://vidsync.pro/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  const range = req.headers.get("range");
  if (range) {
    headers["Range"] = range;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");

    const copyHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];

    for (const h of copyHeaders) {
      const val = upstreamRes.headers.get(h);
      if (val) responseHeaders.set(h, val);
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "Proxy fetch failed", { status: 502 });
  }
}

export async function HEAD(req: NextRequest) {
  return GET(req);
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
