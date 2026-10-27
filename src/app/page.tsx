import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { MediaRow } from "@/components/MediaRow";
import { trending, moviesNowPlaying, moviesPopular, moviesTopRated, tvPopular, tvTopRated } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function mediaTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || "Untitled";
}

export default async function Home() {
  const [trendingItems, nowPlaying, popular, topRated, tvPopularItems, tvTopRatedItems] = await Promise.all([
    trending("all", "week"),
    moviesNowPlaying(),
    moviesPopular(),
    moviesTopRated(),
    tvPopular(),
    tvTopRated(),
  ]);

  const heroItem = trendingItems[0] ?? popular[0] ?? nowPlaying[0];

  return (
    <div className="min-h-screen">
      <Navbar />
      {heroItem && <Hero item={heroItem} />}

      <main className="mx-auto max-w-7xl pb-12">
        <MediaRow
          title="Trending this week"
          items={trendingItems}
          hrefForItem={(item) =>
            "media_type" in item && item.media_type === "movie" ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`
          }
          titleForItem={mediaTitle}
          seeAllHref="/movies"
        />
        <MediaRow
          title="Now playing in theaters"
          items={nowPlaying}
          hrefForItem={(item) => `/watch/movie/${item.id}`}
          titleForItem={mediaTitle}
          seeAllHref="/movies"
        />
        <MediaRow
          title="Popular movies"
          items={popular}
          hrefForItem={(item) => `/watch/movie/${item.id}`}
          titleForItem={mediaTitle}
        />
        <MediaRow
          title="Top-rated movies"
          items={topRated}
          hrefForItem={(item) => `/watch/movie/${item.id}`}
          titleForItem={mediaTitle}
        />
        <MediaRow
          title="Popular series"
          items={tvPopularItems}
          hrefForItem={(item) => `/watch/tv/${item.id}`}
          titleForItem={mediaTitle}
          seeAllHref="/series"
        />
        <MediaRow
          title="Top-rated series"
          items={tvTopRatedItems}
          hrefForItem={(item) => `/watch/tv/${item.id}`}
          titleForItem={mediaTitle}
        />
      </main>

      <Footer />
    </div>
  );
}
