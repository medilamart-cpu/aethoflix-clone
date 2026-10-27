import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MediaRow } from "@/components/MediaRow";
import { moviesNowPlaying, moviesPopular, moviesTopRated } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function mediaTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || "Untitled";
}

export default async function MoviesPage() {
  const [nowPlaying, popular, topRated] = await Promise.all([
    moviesNowPlaying(),
    moviesPopular(),
    moviesTopRated(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Movies</h1>
        <p className="mt-1 text-sm text-neutral-400">All movies from TMDb. Watch via the mirror picker on each detail page.</p>
        <MediaRow title="Now playing" items={nowPlaying} hrefForItem={(i) => `/watch/movie/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Popular" items={popular} hrefForItem={(i) => `/watch/movie/${i.id}`} titleForItem={mediaTitle} />
        <MediaRow title="Top rated" items={topRated} hrefForItem={(i) => `/watch/movie/${i.id}`} titleForItem={mediaTitle} />
      </main>
      <Footer />
    </div>
  );
}
