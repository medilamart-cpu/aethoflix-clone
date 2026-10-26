import { MediaCard } from "./MediaCard";
import type { MovieListItem, TVListItem, TrendingMedia } from "@/lib/tmdb";
import { Link } from "lucide-react";
import NextLink from "next/link";

type AnyMedia = MovieListItem | TVListItem | TrendingMedia;

interface MediaRowProps {
  title: string;
  items: AnyMedia[];
  hrefForItem: (item: AnyMedia) => string;
  titleForItem: (item: AnyMedia) => string;
  seeAllHref?: string;
}

export function MediaRow({ title, items, hrefForItem, titleForItem, seeAllHref }: MediaRowProps) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
        {seeAllHref && (
          <NextLink
            href={seeAllHref}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
          >
            See all <Link className="h-3 w-3" />
          </NextLink>
        )}
      </div>
      <div className="scrollbar-hide flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            href={hrefForItem(item)}
            title={titleForItem(item)}
          />
        ))}
      </div>
    </section>
  );
}
