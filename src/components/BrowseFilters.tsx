"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { MediaCard } from "./MediaCard";
import type { TrendingMedia } from "@/lib/tmdb";

const TYPES = [{id:"all",label:"For you"},{id:"movie",label:"Films"},{id:"tv",label:"Series"},{id:"anime",label:"Anime"}] as const;
const GENRES = [
  [28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[9648,"Mystery"],[10402,"Music"],[10751,"Family"],[10749,"Romance"],[878,"Sci-Fi"],[53,"Thriller"],[10752,"War"],[37,"Western"],
] as const;
const COLLECTIONS = [
  ["On air this week","tv",10759,""],["Action & adrenaline","all",28,""],["Laugh-out-loud comedies","all",35,""],["Crime series","tv",80,""],["Sci-fi & fantasy","tv",878,""],["Edge-of-your-seat thrillers","all",53,""],["Bollywood blockbusters","movie",28,"IN"],["Horror after dark","movie",27,""],["C-dramas","tv",18,"CN"],["Turkish dramas","tv",18,"TR"],["Action & battle anime","anime",28,""],["Anime films","anime",16,""],["Romance","all",10749,""],["Sci-fi worlds","all",878,""],["Family movie night","movie",10751,""],["Comedy series","tv",35,""],["Docuseries","tv",99,""],["Spanish-language series","tv",18,"ES"],["Tamil cinema","movie",28,"IN"],["Telugu cinema","movie",18,"IN"],["Malayalam cinema","movie",18,"IN"],["Korean films","movie",18,"KR"],["K-dramas to get lost in","tv",18,"KR"],["Hidden gems","movie",9648,""],["Critically acclaimed","all",18,""],["90s nostalgia","all",35,""],["Reality TV","tv",10764,""],["British series","tv",18,"GB"],["Critically acclaimed series","tv",18,""],
] as const;
const COUNTRIES = [["","Everywhere"],["IN","India"],["US","United States"],["GB","United Kingdom"],["KR","South Korea"],["JP","Japan"],["CN","China"],["FR","France"],["ES","Spain"],["TR","Türkiye"],["DE","Germany"],["IT","Italy"],["BR","Brazil"],["CA","Canada"],["AU","Australia"],["MX","Mexico"],["TH","Thailand"],["PH","Philippines"]] as const;

type FilterState = { type:string; genre:string; country:string; title:string };
export function BrowseFilters() {
  const [filter,setFilter] = useState<FilterState>({type:"all",genre:"",country:"",title:""});
  const [results,setResults] = useState<TrendingMedia[]>([]);
  const [loading,setLoading] = useState(false);
  const [active,setActive] = useState(false);
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
  const collection = (entry:typeof COLLECTIONS[number]) => apply({type:entry[1],genre:String(entry[2]),country:entry[3] || "",title:entry[0]});
  return <section className="browse-panel" aria-label="Browse the collection">
    <div className="browse-intro"><div><span className="section-kicker">THE COLLECTION</span><h2>Find your next world.</h2></div><span className="browse-intro-note"><SlidersHorizontal size={14} /> Find it your way</span></div>
    <div className="browse-types" role="tablist" aria-label="Content type">{TYPES.map((entry)=><button key={entry.id} type="button" role="tab" aria-selected={filter.type===entry.id} className={filter.type===entry.id?"browse-type-active":""} onClick={()=>apply({...filter,type:entry.id,title:entry.label})}>{entry.label}</button>)}</div>
    <div className="browse-filter-group"><span className="filter-label">GENRES</span><div className="genre-chips"><button type="button" className={!filter.genre?"genre-chip-active":""} onClick={()=>apply({...filter,genre:"",title:"All genres"})}>All genres</button>{GENRES.map(([id,label])=><button type="button" key={id} className={filter.genre===String(id)?"genre-chip-active":""} onClick={()=>apply({...filter,genre:String(id),title:label})}>{label}</button>)}</div></div>
    <div className="browse-origin"><label htmlFor="origin-select" className="filter-label">ORIGIN</label><div className="origin-select-wrap"><select id="origin-select" value={filter.country} onChange={(event)=>apply({...filter,country:event.target.value,title:COUNTRIES.find(([code])=>code===event.target.value)?.[1] || "Everywhere"})}>{COUNTRIES.map(([code,name])=><option key={code||"all"} value={code}>{name}</option>)}</select><ChevronDown size={14}/></div></div>
    <div className="collection-shortcuts"><div className="collection-shortcuts-head"><span className="section-kicker">COLLECTIONS</span><span>Jump to a collection</span></div><div>{COLLECTIONS.map((entry)=><button key={entry[0]} type="button" onClick={()=>collection(entry)}>{entry[0]}</button>)}</div></div>
    {active && <section className="browse-results"><div className="browse-results-heading"><div><span className="section-kicker">{filter.country ? COUNTRIES.find(([code])=>code===filter.country)?.[1] : "AETHOPLEX PICKS"}</span><h3>{filter.title || "Made for you"}</h3></div><span>{loading ? "Finding your next watch…" : `${results.length} titles`}</span></div>{loading ? <div className="browse-loading"><LoaderCircle size={20} /> Gathering your collection</div> : results.length ? <div className="browse-results-grid">{results.map((item)=><MediaCard key={`${item.media_type}-${item.id}`} item={item} title={item.title} href={item.media_type === "movie" ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`} />)}</div> : <p className="browse-empty">No titles found for this selection. Try another collection.</p>}</section>}
  </section>;
}
