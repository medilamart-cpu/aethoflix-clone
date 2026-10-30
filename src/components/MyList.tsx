"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ArrowRight } from "lucide-react";
import { MediaCard } from "./MediaCard";
import { readWatchlist, type WatchlistEntry } from "./WatchlistButton";
import type { MovieListItem } from "@/lib/tmdb";

export function MyList() {
  const [items,setItems] = useState<WatchlistEntry[]>([]);
  useEffect(() => {
    const sync = () => setItems(readWatchlist());
    sync();
    window.addEventListener("storage",sync);
    window.addEventListener("aethoplex-watchlist-change",sync);
    return () => { window.removeEventListener("storage",sync); window.removeEventListener("aethoplex-watchlist-change",sync); };
  },[]);
  return <>
    <div className="my-list-heading"><span className="section-kicker">YOUR COLLECTION</span><h1>My list <small>{String(items.length).padStart(2,"0")}</small></h1><p>Saved for the night you are ready.</p><span className="collection-private"><Bookmark size={12} /> YOUR PRIVATE COLLECTION</span></div>
    {items.length ? <section className="my-list-grid">{items.map((entry) => { const item: MovieListItem = { id:entry.id,title:entry.title,overview:"",poster_path:entry.poster_path,backdrop_path:null,vote_average:0,release_date:entry.release_date }; const href = entry.mediaType === "movie" ? `/watch/movie/${entry.id}` : entry.mediaType === "anime" ? `/anime/${entry.id}` : `/watch/tv/${entry.id}`; return <MediaCard key={`${entry.mediaType}-${entry.id}`} item={item} mediaType={entry.mediaType} title={entry.title} href={href} />; })}</section> : <section className="empty-list"><div className="empty-list-icon"><Bookmark size={23} /></div><span className="section-kicker">A LITTLE SPACE FOR YOUR NEXT FAVOURITE</span><h2>Make this list your own.</h2><p>Save the films and series you want to come back to. They will be waiting here.</p><Link href="/" className="empty-list-button">Explore the collection <ArrowRight size={15} /></Link></section>}
  </>;
}
