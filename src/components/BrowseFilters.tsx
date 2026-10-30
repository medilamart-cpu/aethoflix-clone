"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { MediaCard } from "./MediaCard";
import type { TrendingMedia } from "@/lib/tmdb";
import { collectionSet } from "@/lib/collections";

const TYPES = [{id:"all",label:"For you"},{id:"movie",label:"Films"},{id:"tv",label:"Series"},{id:"anime",label:"Anime"}] as const;
const GENRES = [[28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[9648,"Mystery"],[10402,"Music"],[10751,"Family"],[10749,"Romance"],[878,"Sci-Fi"],[53,"Thriller"],[10752,"War"],[37,"Western"]] as const;
const ANIME_GENRES = [[10759,"Action & Adventure"],[10762,"Kids"],[10763,"News"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10766,"Soap"],[10767,"Talk"],[10768,"War & Politics"]] as const;
const FALLBACK_COUNTRIES = [["","Everywhere"],["IN","India"],["US","United States of America"],["GB","United Kingdom"],["KR","South Korea"],["JP","Japan"],["CN","China"],["FR","France"],["ES","Spain"],["TR","Turkey"],["DE","Germany"],["IT","Italy"],["BR","Brazil"],["CA","Canada"],["AU","Australia"],["MX","Mexico"],["TH","Thailand"],["PH","Philippines"]] as const;
type FilterState = { type:string; genre:string; country:string; title:string };

export function BrowseFilters({ initialType = "all" }: { initialType?: string }) {
  const [filter,setFilter] = useState<FilterState>({type:initialType,genre:"",country:"",title:""});
  const [results,setResults] = useState<TrendingMedia[]>([]);
  const [countries,setCountries] = useState<readonly (readonly [string,string])[]>(FALLBACK_COUNTRIES);
  const [loading,setLoading] = useState(false);
  const [active,setActive] = useState(false);
  useEffect(() => { fetch("/api/countries").then(response => response.json()).then(data => { if (Array.isArray(data.countries)) setCountries([["","Everywhere"], ...data.countries]); }).catch(() => {}); }, []);
  async function apply(next:FilterState) {
    setFilter(next);
    if (next.type === "all" && !next.genre && !next.country) { setActive(false); setResults([]); return; }
    setActive(true); setLoading(true);
    const query = new URLSearchParams({type:next.type});
    if (next.genre) query.set("genre",next.genre);
    if (next.country) query.set("country",next.country);
    try { const response = await fetch(`/api/browse?${query}`); const data = await response.json(); setResults(Array.isArray(data.results) ? data.results : []); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }
  const activeCollections = collectionSet(filter.type);
  const genreOptions = filter.type === "anime" ? ANIME_GENRES : GENRES;
  const collection = (entry:(typeof activeCollections)[number]) => apply({type:entry.type,genre:entry.genre ? String(entry.genre) : "",country:entry.country || "",title:entry.title});
  return <section className="browse-panel" aria-label="Browse filters">
    <div className="browse-intro"><div><span className="section-kicker">THE COLLECTION</span><h2>Find your next world.</h2></div><span className="browse-intro-note"><SlidersHorizontal size={14}/> Find it your way</span></div>
    <div className="browse-types" role="tablist" aria-label="Content type">{TYPES.map(entry=><button key={entry.id} type="button" role="tab" aria-selected={filter.type===entry.id} className={filter.type===entry.id?"browse-type-active":""} onClick={()=>apply({...filter,type:entry.id,title:entry.label})}>{entry.label}</button>)}</div>
    <div className="browse-filter-group"><span className="filter-label">GENRES</span><div className="genre-chips"><button type="button" className={!filter.genre?"genre-chip-active":""} onClick={()=>apply({...filter,genre:"",title:"All genres"})}>All genres</button>{genreOptions.map(([id,label])=><button type="button" key={id} className={filter.genre===String(id)?"genre-chip-active":""} onClick={()=>apply({...filter,genre:String(id),title:label})}>{label}</button>)}</div></div>
    <div className="browse-origin"><label htmlFor="origin-select" className="filter-label">ORIGIN</label><div className="origin-select-wrap"><select id="origin-select" value={filter.country} onChange={event=>apply({...filter,country:event.target.value,title:countries.find(([code])=>code===event.target.value)?.[1]||"Everywhere"})}>{countries.map(([code,name])=><option key={code||"all"} value={code}>{name}</option>)}</select><ChevronDown size={14}/></div></div>
    <div className="collection-shortcuts"><div className="collection-shortcuts-head"><span className="section-kicker">COLLECTIONS</span><span>Jump to a collection</span></div><div>{activeCollections.map(entry=><button key={entry.title} type="button" onClick={()=>collection(entry)}>{entry.title}</button>)}</div></div>
    {active&&<section className="browse-results"><div className="browse-results-heading"><div><span className="section-kicker">{filter.country?countries.find(([code])=>code===filter.country)?.[1]:"AETHOPLEX PICKS"}</span><h3>{filter.title||"Made for you"}</h3></div><span>{loading?"Finding your next watch…":`${results.length} titles`}</span></div>{loading?<div className="browse-loading"><LoaderCircle size={20}/> Gathering your collection</div>:results.length?<div className="browse-results-grid">{results.map(item=><MediaCard key={`${item.media_type}-${item.id}`} item={item} title={item.title} href={item.media_type==="movie"?`/watch/movie/${item.id}`:`/watch/tv/${item.id}`}/>)}</div>:<p className="browse-empty">No titles found for this selection. Try another collection.</p>}</section>}
  </section>;
}
