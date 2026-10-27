import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MediaRow } from "@/components/MediaRow";
import { kdrama } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function mediaTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || "Untitled";
}

export default async function KDramaPage() {
  const [byPopularity, byRating, byDate] = await Promise.all([
    kdrama("popularity.desc"),
    kdrama("vote_average.desc"),
    kdrama("first_air_date.desc"),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">K-Drama</h1>
        <p className="mt-1 text-sm text-neutral-400">Korean-language TV shows filtered via TMDb discover.</p>
        <MediaRow title="Most popular" items={byPopularity} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Top rated" items={byRating} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Newest" items={byDate} hrefForItem={(i) => `/watch/tv/${i.id}`} titleForItem={mediaTitle} />
      </main>
      <Footer />
    </div>
  );
}
