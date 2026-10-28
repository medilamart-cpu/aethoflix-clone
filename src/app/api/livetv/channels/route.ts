import { NextRequest, NextResponse } from "next/server";
import { liveChannels } from "@/lib/livetv";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const version = (searchParams.get("version") === "v2" ? "v2" : "v1") as "v1" | "v2";

  try {
    const channels = await liveChannels(version);
    return NextResponse.json({ ok: true, version, channels });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
