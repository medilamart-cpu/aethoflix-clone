/**
 * LiveTVGT — public live TV channel guide (899 channels).
 *
 * This is the same endpoint AethoFlix uses. It's hosted on Lovable.
 * If you want to build your own live TV backend, replace this URL with
 * your own channel-list endpoint and update the LiveChannel type to match.
 */

const LIVETV_ENDPOINT = process.env.NEXT_PUBLIC_LIVETV_ENDPOINT ?? "https://livetgtv.lovable.app/api/public/v2/channels";

export interface LiveChannel {
  id: string;
  name: string;
  stream: string; // detail endpoint (returns the servers[] array)
  watch: string; // watch page on livetgtv.lovable.app
  embed: string; // embed URL for the player iframe
}

export interface LiveChannelServer {
  key: string;
  label: string;
  playable: string; // HLS URL (proxied through livetgtv)
  type: "hls" | "mp4";
}

export async function liveChannels(): Promise<LiveChannel[]> {
  const res = await fetch(LIVETV_ENDPOINT, {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 }, // cache 1 hour
  });
  if (!res.ok) throw new Error(`LiveTV HTTP ${res.status}`);
  const data = await res.json();
  // Both v1 and v2 endpoints return either a list or {"channels": [...]}
  const channels = Array.isArray(data) ? data : (data.channels ?? []);
  return channels as LiveChannel[];
}

export async function liveChannelDetail(channelId: string | number): Promise<{ servers: LiveChannelServer[] }> {
  const res = await fetch(`https://livetgtv.lovable.app/api/public/v2/channels/${channelId}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 600 }, // 10 min
  });
  if (!res.ok) throw new Error(`LiveTV channel ${channelId} HTTP ${res.status}`);
  return res.json();
}
