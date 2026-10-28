/**
 * LiveTVGT — public live TV channel guide.
 *
 * Aethoplex / Aethoflix uses two directories:
 * - V1: India channels (1,216+ channels including Colors, Star, Zee, Sony, Aaj Tak, DD Sports, etc.)
 * - V2: 24 / 7 mix (Global channels like HBO, CNN, ESPN, Discovery, etc.)
 */

export interface LiveChannel {
  id: string;
  name: string;
  category?: string;
  logo?: string;
  stream?: string;
  watch?: string;
  embed?: string;
}

export interface LiveChannelServer {
  key: string;
  label: string;
  playable: string;
  type: "hls" | "mp4";
}

export const POPULAR_INDIAN_FALLBACK_CHANNELS: LiveChannel[] = [
  { id: "144", name: "Colors HD", category: "Entertainment", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/ColorsHD.png", embed: "https://livetgtv.lovable.app/embed/144" },
  { id: "156", name: "Star Gold HD", category: "Movies", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/Star_Gold_HD.png", embed: "https://livetgtv.lovable.app/embed/156" },
  { id: "165", name: "Zee Cinema HD", category: "Movies", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/Zee_Cinema_HD.png", embed: "https://livetgtv.lovable.app/embed/165" },
  { id: "167", name: "Zee TV HD", category: "Entertainment", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/Zee_TV_HD.png", embed: "https://livetgtv.lovable.app/embed/167" },
  { id: "173", name: "Aaj Tak", category: "News", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/Aaj_Tak.png", embed: "https://livetgtv.lovable.app/embed/173" },
  { id: "204", name: "DD Sports", category: "Sports", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/DD_Sports.png", embed: "https://livetgtv.lovable.app/embed/204" },
  { id: "185", name: "And Pictures HD", category: "Movies", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/And_Pictures_HD.png", embed: "https://livetgtv.lovable.app/embed/185" },
  { id: "183", name: "B4U Music", category: "Music", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/B4U_Music.png", embed: "https://livetgtv.lovable.app/embed/183" },
  { id: "202", name: "DD National", category: "Entertainment", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/DD_National.png", embed: "https://livetgtv.lovable.app/embed/202" },
  { id: "190", name: "CNBC Awaaz", category: "Business News", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/CNBC_Awaaz.png", embed: "https://livetgtv.lovable.app/embed/190" },
  { id: "177", name: "ABP News India", category: "News", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/ABP_News.png", embed: "https://livetgtv.lovable.app/embed/177" },
  { id: "146", name: "History TV18 HD", category: "Infotainment", logo: "https://jiotv.catchup.cdn.jio.com/dare_images/images/History_TV18_HD.png", embed: "https://livetgtv.lovable.app/embed/146" },
];

export const POPULAR_GLOBAL_FALLBACK_CHANNELS: LiveChannel[] = [
  { id: "1", name: "ESPN HD", category: "Sports", embed: "https://livetgtv.lovable.app/v2/embed/1" },
  { id: "2", name: "HBO East HD", category: "Movies", embed: "https://livetgtv.lovable.app/v2/embed/2" },
  { id: "3", name: "CNN US HD", category: "News", embed: "https://livetgtv.lovable.app/v2/embed/3" },
  { id: "4", name: "Discovery Channel", category: "Documentary", embed: "https://livetgtv.lovable.app/v2/embed/4" },
  { id: "5", name: "Cartoon Network HD", category: "Kids", embed: "https://livetgtv.lovable.app/v2/embed/5" },
  { id: "6", name: "BBC News HD", category: "News", embed: "https://livetgtv.lovable.app/v2/embed/6" },
  { id: "7", name: "National Geographic HD", category: "Documentary", embed: "https://livetgtv.lovable.app/v2/embed/7" },
  { id: "8", name: "Fox Sports 1 HD", category: "Sports", embed: "https://livetgtv.lovable.app/v2/embed/8" },
];

export async function liveChannels(version: "v1" | "v2" = "v1"): Promise<LiveChannel[]> {
  const endpoint =
    version === "v1"
      ? "https://livetgtv.lovable.app/api/public/channels"
      : "https://livetgtv.lovable.app/api/public/v2/channels";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, {
      headers: { accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
      next: { revalidate: 1800 },
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`LiveTV HTTP ${res.status}`);
    const data = await res.json();
    const channels = Array.isArray(data) ? data : (data.channels ?? []);

    if (channels.length > 0) {
      return channels.map((c: any) => ({
        id: String(c.id),
        name: c.name,
        category: c.category || (version === "v1" ? "Indian TV" : "24 / 7"),
        logo: c.logo || undefined,
        embed:
          c.embed ||
          (version === "v1"
            ? `https://livetgtv.lovable.app/embed/${c.id}?colour=FFFFFF`
            : `https://livetgtv.lovable.app/v2/embed/${c.id}?colour=FFFFFF`),
        stream: c.stream || undefined,
        watch: c.watch || undefined,
      }));
    }

    return version === "v1" ? POPULAR_INDIAN_FALLBACK_CHANNELS : POPULAR_GLOBAL_FALLBACK_CHANNELS;
  } catch (err) {
    console.warn(`[LiveTV] Fetch error for ${version}, using fallback:`, err);
    return version === "v1" ? POPULAR_INDIAN_FALLBACK_CHANNELS : POPULAR_GLOBAL_FALLBACK_CHANNELS;
  }
}

export function getLiveEmbedUrl(channelId: string | number, version: "v1" | "v2" = "v1"): string {
  return version === "v1"
    ? `https://livetgtv.lovable.app/embed/${channelId}?colour=FFFFFF`
    : `https://livetgtv.lovable.app/v2/embed/${channelId}?colour=FFFFFF`;
}
