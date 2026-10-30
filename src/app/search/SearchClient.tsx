"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchMulti, type TrendingMedia } from "@/lib/tmdb";
import { searchAnime, animeDisplayName, type AnimeMedia } from "@/lib/anilist";
import { MediaCard } from "@/components/MediaCard";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<TrendingMedia[]>([]);
  const [animeResults, setAnimeResults] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function onSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    router.push(`/search?q=${encodeURIComponent(query)}`);
    try {
      const [media, anime] = await Promise.all([
        searchMulti(query).catch(() => [] as TrendingMedia[]),
        searchAnime(query, 1, 10).catch(() => [] as AnimeMedia[]),
      ]);
      setResults(media);
      setAnimeResults(anime);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (q && !hasSearched) {
      setInput(q);
      void onSearch(q);
    }
  }, [q, hasSearched]);

  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(input);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search movies, series, anime…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-12 w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-white/40 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="min-h-12 rounded-full bg-white px-6 text-sm font-semibold text-black disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && animeResults.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">No results found for &quot;{q}&quot;.</p>
      )}

      {results.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Movies &amp; Series</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.id}`}
                item={item as unknown as import("@/lib/tmdb").MovieListItem}
                href={item.media_type === "movie" ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`}
                title={item.title}
              />
            ))}
          </div>
        </section>
      )}

      {animeResults.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Anime</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {animeResults.map((a) => {
              const title = animeDisplayName(a);
              return (
                <Link href={`/anime/${a.id}`} key={a.id} className="group block">
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-white/5 bg-white/5">
                    <Image
                      src={a.coverImage.extraLarge || a.coverImage.large}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 truncate text-xs text-neutral-200 group-hover:text-white">{title}</p>
                  {a.seasonYear && <p className="text-[11px] text-neutral-500">{a.seasonYear}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
