import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { liveChannels, type LiveChannel } from "@/lib/livetv";
import { LiveTVPlayer } from "@/components/LiveTVPlayer";

export const runtime = "edge";
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
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Live TV</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Ad-free live broadcasts streaming directly via native Video.js HLS playback.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load channels: {error}
          </div>
        )}

        {!error && <LiveTVPlayer initialChannels={channels} />}
      </main>
      <Footer />
    </div>
  );
}
