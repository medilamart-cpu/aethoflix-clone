"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { collectionSet, type CollectionDefinition } from "@/lib/collections";
import type { TrendingMedia } from "@/lib/tmdb";

function CollectionShelf({ item }: { item: CollectionDefinition }) {
  const target = useRef<HTMLElement>(null);
  const [results, setResults] = useState<TrendingMedia[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const node = target.current;
    if (!node) return;
    let active = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const query = new URLSearchParams({ type: item.type, page: "1" });
      if (item.genre) query.set("genre", String(item.genre));
      if (item.country) query.set("country", item.country);
      fetch(`/api/browse?${query}`).then(response => response.json()).then(data => {
        if (active) setResults(Array.isArray(data.results) ? data.results.slice(0, 20) : []);
      }).catch(() => { if (active) setResults([]); }).finally(() => { if (active) setLoading(false); });
    }, { rootMargin: "220px" });
    observer.observe(node);
    return () => { active = false; observer.disconnect(); };
  }, [item]);
  return <section ref={target} className="collection-feed-shelf media-shelf">
    <div className="media-shelf-heading"><div><h2>{item.title}</h2><p>{item.description}</p></div></div>
    {loading ? <div className="collection-feed-loading"><LoaderCircle size={16}/><span>Finding your next watch</span></div> : results.length ? <div className="scrollbar-hide flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6">{results.map(entry => {
      const isMovie = entry.media_type === "movie";
      const label = entry.title || "Untitled";
      return <MediaCard key={`${entry.media_type}-${entry.id}`} item={entry} title={label} href={`/watch/${isMovie ? "movie" : "tv"}/${entry.id}`} />;
    })}</div> : <p className="collection-feed-empty">This collection is taking a quiet night off.</p>}
  </section>;
}

export function ThemedCollectionFeed({ type }: { type: string }) {
  return <div aria-label={`${type} collections`} className="themed-collection-feed">{collectionSet(type).map(item => <CollectionShelf key={`${item.title}-${item.country || "all"}`} item={item} />)}</div>;
}
