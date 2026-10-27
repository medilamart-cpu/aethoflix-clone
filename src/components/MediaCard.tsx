import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { MovieListItem, TVListItem, TrendingMedia } from "@/lib/tmdb";
import { posterUrl } from "@/lib/tmdb";

type AnyMedia = MovieListItem | TVListItem | TrendingMedia;

interface MovieCardProps {
  item: AnyMedia;
  href: string;
  title: string;
}

export function MediaCard({ item, href, title }: MovieCardProps) {
  const vote = "vote_average" in item ? item.vote_average : 0;
  const safeTitle = title || ("title" in item && item.title) || ("name" in item && (item as { name?: string }).name) || "Media Title";
  return (
    <Link href={href} className="group block flex-shrink-0">
      <div className="relative aspect-[2/3] w-32 overflow-hidden rounded-lg border border-white/5 bg-white/5 sm:w-36 md:w-40">
        <Image
          src={posterUrl(item.poster_path, "w342")}
          alt={safeTitle}
          fill
          sizes="(max-width: 768px) 128px, (max-width: 1024px) 144px, 160px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {vote > 0 && (
          <div className="absolute right-1 top-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">
            <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
            {vote.toFixed(1)}
          </div>
        )}
      </div>
      <div className="mt-2 w-32 sm:w-36 md:w-40">
        <p className="truncate text-xs font-medium text-neutral-200 group-hover:text-white">{title}</p>
        {"release_date" in item && item.release_date && (
          <p className="text-[11px] text-neutral-500">{item.release_date.slice(0, 4)}</p>
        )}
        {"first_air_date" in item && item.first_air_date && (
          <p className="text-[11px] text-neutral-500">{item.first_air_date.slice(0, 4)}</p>
        )}
      </div>
    </Link>
  );
}
