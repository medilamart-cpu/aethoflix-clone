import { MobileDock, Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { BrowseFilters } from "@/components/BrowseFilters";
import { MediaRow } from "@/components/MediaRow";
import { ThemedCollectionFeed } from "@/components/ThemedCollectionFeed";
import { discoverTV, kdrama, moviesFromIndia, moviesNowPlaying, moviesPopular, trending, tvAiringToday, tvPopular, tvTopRated } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

function titleOf(item: { title?: string; name?: string }): string { return item.title || item.name || "Untitled"; }
function hrefOf(item: { id: number; media_type?: string; title?: string }): string {
  return item.media_type === "movie" || item.title ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`;
}

export default async function Home() {
  const [trendingItems, nowPlaying, films, series, anime, korean, india, classics, onAir] = await Promise.all([
    trending("all", "week"), moviesNowPlaying(), moviesPopular(), tvPopular(),
    discoverTV({ with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc" }),
    kdrama(), moviesFromIndia(), moviesPopular(2), tvAiringToday(),
  ]);
  const heroItems = trendingItems.slice(0, 6);
  const heroItem = heroItems[0] ?? films[0] ?? nowPlaying[0];
  return <div className="min-h-screen">
    <Navbar />
    {heroItem && <Hero item={heroItem} items={heroItems.length ? heroItems : [heroItem]} />}
    <main className="mx-auto max-w-7xl pb-12">
      <BrowseFilters />
      <MediaRow title="Trending this week" description="What’s finding an audience right now" items={trendingItems} hrefForItem={hrefOf} titleForItem={titleOf} />
      <MediaRow title="Films to fall into" description="Stories made for the big screen" items={films} hrefForItem={hrefOf} titleForItem={titleOf} />
      <MediaRow title="Series with staying power" description="Find your next long-running love" items={series} hrefForItem={hrefOf} titleForItem={titleOf} seeAllHref="/series" />
      <MediaRow title="Anime, in another world" description="Animation from Japan, hand-picked" items={anime} hrefForItem={hrefOf} titleForItem={titleOf} seeAllHref="/anime" />
      <MediaRow title="K-dramas to get lost in" description="A little romance, a little suspense" items={korean} hrefForItem={hrefOf} titleForItem={titleOf} />
      <MediaRow title="Stories from India" description="A home for every kind of cinema" items={india} hrefForItem={hrefOf} titleForItem={titleOf} />
      <MediaRow title="The all-time greats" description="Voted into the collection" items={classics} hrefForItem={hrefOf} titleForItem={titleOf} />
      <MediaRow title="On air this week" description="New episodes landing now" items={onAir} hrefForItem={hrefOf} titleForItem={titleOf} />
      <ThemedCollectionFeed type="all" />
    </main>
    <Footer />
    <MobileDock />
  </div>;
}
