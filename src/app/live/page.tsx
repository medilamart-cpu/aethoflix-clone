import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { liveChannels, type LiveChannel } from "@/lib/livetv";
import { LiveTVPlayer } from "@/components/LiveTVPlayer";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export default async function LivePage() {
  let channels: LiveChannel[] = [];
  try {
    // Default to V1 (India channels)
    channels = await liveChannels("v1");
  } catch (e) {
    console.warn("Failed to load initial live channels:", e);
  }

  return (
    <div className="min-h-screen bg-[#080a0f]">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LiveTVPlayer initialChannels={channels} initialVersion="v1" />
      </main>
      <Footer />
    </div>
  );
}
