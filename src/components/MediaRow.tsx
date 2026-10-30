import { Link as LinkIcon } from "lucide-react";
import NextLink from "next/link";
import { MediaCard } from "./MediaCard";
import { MediaRail } from "./MediaRail";
import type { MovieListItem, TVListItem, TrendingMedia } from "@/lib/tmdb";

type AnyMedia = MovieListItem | TVListItem | TrendingMedia;
interface MediaRowProps {
  title: string;
  description?: string;
  items: AnyMedia[];
  hrefForItem: (item: AnyMedia) => string;
  titleForItem: (item: AnyMedia) => string;
  seeAllHref?: string;
}

export function MediaRow({ title, description, items, hrefForItem, titleForItem, seeAllHref }: MediaRowProps) {
  if (!items.length) return null;
  return <section className="mt-8 media-shelf">
    <div className="media-shelf-heading">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {seeAllHref && <NextLink href={seeAllHref} className="media-shelf-see-all">See all <LinkIcon size={13}/></NextLink>}
    </div>
    <MediaRail title={title}>{items.map(item => <MediaCard key={`${"media_type" in item ? item.media_type : "title"}-${item.id}`} item={item} href={hrefForItem(item)} title={titleForItem(item)} />)}</MediaRail>
  </section>;
}
