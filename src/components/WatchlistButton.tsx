"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";

export interface WatchlistEntry { id: number; mediaType: "movie" | "tv" | "anime"; title: string; poster_path: string | null; release_date: string | null }
export const WATCHLIST_KEY = "aethoplex:my-list";

export function readWatchlist(): WatchlistEntry[] {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]") as WatchlistEntry[]; } catch { return []; }
}

export function WatchlistButton({ item, variant = "card" }: { item: WatchlistEntry; variant?:"card"|"inline" }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(readWatchlist().some((entry) => entry.id === item.id && entry.mediaType === item.mediaType)); }, [item.id,item.mediaType]);
  function toggle() {
    const current = readWatchlist();
    const exists = current.some((entry) => entry.id === item.id && entry.mediaType === item.mediaType);
    const next = exists ? current.filter((entry) => !(entry.id === item.id && entry.mediaType === item.mediaType)) : [item,...current];
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    setSaved(!exists);
    window.dispatchEvent(new Event("aethoplex-watchlist-change"));
  }
  return <button type="button" className={`${variant === "inline" ? "watchlist-inline-toggle" : "watchlist-toggle"}${saved ? " watchlist-toggle-saved" : ""}`} aria-label={saved ? `Remove ${item.title} from my list` : `Save ${item.title} to my list`} title={saved ? "Remove from my list" : "Save to my list"} onClick={toggle}><Bookmark size={15} fill={saved ? "currentColor" : "none"} />{variant === "inline" && <span>{saved?"Saved":"My list"}</span>}</button>;
}
