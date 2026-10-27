import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MediaRow } from "@/components/MediaRow";
import { tvPopular, tvTopRated, tvAiringToday } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function mediaTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || "Untitled";
}

export default async function SeriesPage() {
  const [popular, topRated, airingToday] = await Promise.all([
    tvPopular(),
    tvTopRated(),
    tvAiringToday(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Series</h1>
        <p className="mt-1 text-sm text-neutral-400">Browse TV series. Each detail page lets you pick a season/episode and a mirror.</p>
        <MediaRow title="Airing today" items={airingToday} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Popular" items={popular} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Top rated" items={topRated} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
      </main>
      <Footer />
    </div>
  );
}
