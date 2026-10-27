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

const POPULAR_FALLBACK_CHANNELS: LiveChannel[] = [
  { id: "1", name: "ESPN HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/1", watch: "https://livetgtv.lovable.app/watch/1", embed: "https://livetgtv.lovable.app/embed/1" },
  { id: "2", name: "HBO East HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/2", watch: "https://livetgtv.lovable.app/watch/2", embed: "https://livetgtv.lovable.app/embed/2" },
  { id: "3", name: "CNN US HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/3", watch: "https://livetgtv.lovable.app/watch/3", embed: "https://livetgtv.lovable.app/embed/3" },
  { id: "4", name: "Discovery Channel", stream: "https://livetgtv.lovable.app/api/public/v2/channels/4", watch: "https://livetgtv.lovable.app/watch/4", embed: "https://livetgtv.lovable.app/embed/4" },
  { id: "5", name: "Cartoon Network HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/5", watch: "https://livetgtv.lovable.app/watch/5", embed: "https://livetgtv.lovable.app/embed/5" },
  { id: "6", name: "BBC News HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/6", watch: "https://livetgtv.lovable.app/watch/6", embed: "https://livetgtv.lovable.app/embed/6" },
  { id: "7", name: "National Geographic HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/7", watch: "https://livetgtv.lovable.app/watch/7", embed: "https://livetgtv.lovable.app/embed/7" },
  { id: "8", name: "Fox Sports 1 HD", stream: "https://livetgtv.lovable.app/api/public/v2/channels/8", watch: "https://livetgtv.lovable.app/watch/8", embed: "https://livetgtv.lovable.app/embed/8" },
];

export async function liveChannels(): Promise<LiveChannel[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(LIVETV_ENDPOINT, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`LiveTV HTTP ${res.status}`);
    const data = await res.json();
    const channels = Array.isArray(data) ? data : (data.channels ?? []);
    return channels.length > 0 ? (channels as LiveChannel[]) : POPULAR_FALLBACK_CHANNELS;
  } catch (err) {
    console.warn("[LiveTV] Falling back to curated channels:", err);
    return POPULAR_FALLBACK_CHANNELS;
  }
}

export async function liveChannelDetail(channelId: string | number): Promise<{ servers: LiveChannelServer[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`https://livetgtv.lovable.app/api/public/v2/channels/${channelId}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 600 },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`LiveTV channel ${channelId} HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

