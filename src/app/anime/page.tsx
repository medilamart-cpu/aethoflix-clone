import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MediaRow } from "@/components/MediaRow";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { trendingAnime, animeDisplayName, type AnimeMedia } from "@/lib/anilist";

export const dynamic = "force-dynamic";
export const revalidate = 1800;

function AnimeCard({ anime }: { anime: AnimeMedia }) {
  const title = animeDisplayName(anime);
  return (
    <Link href={`/anime/${anime.id}`} className="group block flex-shrink-0">
      <div className="relative aspect-[3/4] w-32 overflow-hidden rounded-lg border border-white/5 bg-white/5 sm:w-36 md:w-40">
        <Image
          src={anime.coverImage.extraLarge || anime.coverImage.large}
          alt={title}
          fill
          sizes="(max-width: 768px) 128px, (max-width: 1024px) 144px, 160px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {anime.averageScore && (
          <div className="absolute right-1 top-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">
            <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
            {Math.round(anime.averageScore / 10).toFixed(1)}
          </div>
        )}
      </div>
      <div className="mt-2 w-32 sm:w-36 md:w-40">
        <p className="truncate text-xs font-medium text-neutral-200 group-hover:text-white">{title}</p>
        {anime.seasonYear && <p className="text-[11px] text-neutral-500">{anime.seasonYear}</p>}
      </div>
    </Link>
  );
}

export default async function AnimePage() {
  const trending = await trendingAnime(1, 30);
  const seasonalYear = new Date().getFullYear();
  const seasonName = (() => {
    const m = new Date().getMonth();
    if (m <= 1 || m === 11) return "WINTER" as const;
    if (m <= 4) return "SPRING" as const;
    if (m <= 7) return "SUMMER" as const;
    return "FALL" as const;
  })();
  const { seasonalAnime } = await import("@/lib/anilist");
  const seasonal = await seasonalAnime(seasonName, seasonalYear);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Anime</h1>
        <p className="mt-1 text-sm text-neutral-400">Trending and this season&apos;s anime, from AniList.</p>

        <section className="mt-6">
          <h2 className="mb-3 px-1 text-lg font-semibold">Trending now</h2>
          <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
            {trending.map((a) => <AnimeCard key={a.id} anime={a} />)}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 px-1 text-lg font-semibold">This season ({seasonName} {seasonalYear})</h2>
          <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
            {seasonal.map((a) => <AnimeCard key={a.id} anime={a} />)}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
