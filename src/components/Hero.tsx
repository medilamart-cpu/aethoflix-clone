"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import type { TrendingMedia, MovieListItem, TVListItem } from "@/lib/tmdb";
import { posterUrl, backdropUrl } from "@/lib/tmdb";

interface HeroProps {
  item: TrendingMedia;
}

export function Hero({ item }: HeroProps) {
  const title = item.title || (item as unknown as { name?: string }).name || "Featured Title";
  const href = item.media_type === "movie" ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`;
  return (
    <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden md:h-[70vh]">
      <Image
        src={backdropUrl(item.backdrop_path, "original")}
        alt={title}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 md:pb-20">
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl md:leading-[1.1]">
            {title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-sm text-neutral-300">
            {item.vote_average > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                {item.vote_average.toFixed(1)}
              </span>
            )}
            {item.release_date && <span>{item.release_date.slice(0, 4)}</span>}
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs uppercase">
              {item.media_type}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-neutral-300 md:text-base line-clamp-3">
            {item.overview || "No description available."}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href={href}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-transform hover:scale-105"
            >
              <Play className="h-4 w-4 fill-black" /> Watch Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
