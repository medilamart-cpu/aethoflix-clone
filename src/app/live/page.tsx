import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { liveChannels, type LiveChannel } from "@/lib/livetv";
import { liveChannelDetail } from "@/lib/livetv";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function LivePage() {
  let channels: LiveChannel[] = [];
  let error: string | null = null;
  try {
    channels = await liveChannels();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Live TV</h1>
        <p className="mt-1 text-sm text-neutral-400">Public live TV channels from LiveTVGT.</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load channels: {error}
          </div>
        )}

        {!error && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {channels.slice(0, 60).map((ch) => (
              <LiveChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        )}
        {!error && channels.length > 60 && (
          <p className="mt-4 text-xs text-neutral-500">
            Showing first 60 of {channels.length} channels. Add pagination as needed.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}

async function LiveChannelCard({ channel }: { channel: LiveChannel }) {
  // Each channel has multiple HLS servers — fetch the first server URL.
  // In production you'd want to do this client-side so the page renders fast.
  let firstStreamUrl: string | null = null;
  let serverCount = 0;
  try {
    const detail = await liveChannelDetail(channel.id);
    serverCount = detail.servers.length;
    firstStreamUrl = detail.servers[0]?.playable ?? null;
  } catch {
    // ignore
  }

  return (
    <a
      href={firstStreamUrl ?? channel.embed}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
    >
      <p className="truncate text-sm font-medium">{channel.name}</p>
      <p className="mt-1 text-[11px] text-neutral-500">
        {serverCount > 0 ? `${serverCount} HLS servers` : "Tap to open"}
      </p>
    </a>
  );
}
