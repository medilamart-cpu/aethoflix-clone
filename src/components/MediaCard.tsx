"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clapperboard, ExternalLink, Info, LoaderCircle, Play, Star, X } from "lucide-react";
import type { Episode, MovieListItem, TVListItem, TrendingMedia } from "@/lib/tmdb";
import { backdropUrl, posterUrl } from "@/lib/tmdb";
import { WatchlistButton } from "./WatchlistButton";

type AnyMedia = MovieListItem | TVListItem | TrendingMedia;
type MediaKind = "movie" | "tv" | "anime";
type DetailInfo = { overview?:string; year?:string; runtime?:number|null; genres?:string[]; credit?:string; trailer?:string|null; seasons?:{season_number:number;name:string;episode_count:number;air_date:string|null}[] };
interface MovieCardProps { item:AnyMedia; href:string; title:string; mediaType?:MediaKind }

export function MediaCard({ item, href, title, mediaType: mediaTypeOverride }:MovieCardProps) {
  const router=useRouter();
  const vote="vote_average" in item ? item.vote_average : 0;
  const safeTitle=title || ("title" in item && item.title) || ("name" in item && (item as {name?:string}).name) || "Media Title";
  const mediaType=mediaTypeOverride ?? ("media_type" in item ? item.media_type : "title" in item ? "movie" : "tv");
  const year=("release_date" in item ? item.release_date : "first_air_date" in item ? item.first_air_date : null)?.slice(0,4);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [mounted,setMounted]=useState(false);
  const [details,setDetails]=useState<DetailInfo|null>(null);
  const [selectedSeason,setSelectedSeason]=useState(1);
  const [episodes,setEpisodes]=useState<Episode[]>([]);
  const [loadingEpisodes,setLoadingEpisodes]=useState(false);
  const [loadingDetails,setLoadingDetails]=useState(false);
  const [trailerOpen,setTrailerOpen]=useState(false);

  useEffect(()=>setMounted(true),[]);
  useEffect(()=>{
    if(!detailsOpen || mediaType==="anime" || details) return;
    let cancelled=false; setLoadingDetails(true);
    fetch(`/api/media-info?type=${mediaType}&id=${item.id}`).then((response)=>response.json()).then((data)=>{if(!cancelled){setDetails(data);setSelectedSeason(data.seasons?.find((season:{season_number:number})=>season.season_number>0)?.season_number??1);}}).catch(()=>{}).finally(()=>{if(!cancelled)setLoadingDetails(false);});
    return ()=>{cancelled=true;};
  },[detailsOpen,mediaType,item.id,details]);
  useEffect(()=>{
    if(!detailsOpen || mediaType!=="tv" || !details?.seasons?.length) return;
    let cancelled=false; setLoadingEpisodes(true);
    fetch(`/api/tv/${item.id}/season/${selectedSeason}`).then(response=>response.json()).then(data=>{if(!cancelled)setEpisodes(Array.isArray(data.episodes)?data.episodes:[]);}).catch(()=>{if(!cancelled)setEpisodes([]);}).finally(()=>{if(!cancelled)setLoadingEpisodes(false);});
    return ()=>{cancelled=true;};
  },[detailsOpen,mediaType,item.id,selectedSeason,details?.seasons]);
  useEffect(()=>{
    if(!detailsOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setDetailsOpen(false);setTrailerOpen(false);}};
    document.addEventListener("keydown",closeOnEscape); document.body.classList.add("modal-open");
    return ()=>{document.removeEventListener("keydown",closeOnEscape);document.body.classList.remove("modal-open");};
  },[detailsOpen]);

  const kindLabel=mediaType==="movie"?"FILM":mediaType==="anime"?"ANIME":"SERIES";
  const releaseYear=details?.year || year;
  const heroImage=mediaType==="anime" ? item.poster_path : ("backdrop_path" in item ? backdropUrl(item.backdrop_path,"w1280") : "/placeholder.svg");
  const theatreHref=`https://theatre.aethoflix.world/?tmdb=${item.id}&type=${mediaType}&title=${encodeURIComponent(safeTitle)}`;

  return <div className="media-card group"><div className="media-card-frame">
    <Link href={href} className="media-card-link" aria-label={`Open ${safeTitle}`}>
      <div className="media-card-poster relative aspect-[2/3] w-32 overflow-hidden rounded-lg border border-white/5 bg-white/5 sm:w-36 md:w-40">
        <Image src={mediaType==="anime"?(item.poster_path||"/placeholder.svg"):posterUrl(item.poster_path,"w342")} alt={safeTitle} fill sizes="(max-width: 768px) 128px, (max-width: 1024px) 144px, 160px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="media-card-meta"><span>{kindLabel}{year&&<> <i>/</i> {year}</>}</span>{vote>0&&<span className="media-card-rating"><Star size={11} fill="currentColor"/>{vote.toFixed(1)}</span>}</div>
      </div>
      <p className="media-card-title">{safeTitle}</p>
    </Link>
    <div className="media-card-actions"><button type="button" aria-label={`More about ${safeTitle}`} title="More details" onClick={()=>{setDetailsOpen(true);setTrailerOpen(false);}}><Info size={15}/></button><button type="button" aria-label={`Play ${safeTitle}`} title="Watch now" onClick={()=>router.push(href)}><Play size={14} fill="currentColor"/></button></div>
    <WatchlistButton item={{id:item.id,mediaType,title:safeTitle,poster_path:item.poster_path,release_date:year?`${year}-01-01`:null}} />
  </div>
  {detailsOpen&&mounted&&createPortal(<div className="media-details-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget){setDetailsOpen(false);setTrailerOpen(false);}}}>
    <section className="media-details-dialog" role="dialog" aria-modal="true" aria-label={`${safeTitle} details`}>
      <button type="button" className="media-details-close" aria-label="Close details" onClick={()=>{setDetailsOpen(false);setTrailerOpen(false);}}><X size={17}/></button>
      {trailerOpen&&details?.trailer ? <div className="media-trailer"><iframe src={`https://www.youtube-nocookie.com/embed/${details.trailer}?autoplay=1`} title={`${safeTitle} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/><button type="button" onClick={()=>setTrailerOpen(false)} aria-label="Close trailer"><X size={17}/></button></div> : <>
        <div className="media-details-banner"><Image src={heroImage||"/placeholder.svg"} alt="" fill sizes="(max-width: 700px) 100vw, 650px" className="object-cover"/><div className="media-details-shade"/><div className="media-details-copy"><span className="section-kicker"><Clapperboard size={13}/> FEATURED {kindLabel}</span><h2>{safeTitle}</h2><div className="media-details-facts">{releaseYear&&<span>{releaseYear}</span>}{details?.runtime&&<span>{details.runtime} min</span>}{vote>0&&<span><Star size={12} fill="currentColor"/> {vote.toFixed(1)}</span>}<span className="media-details-source">TMDB</span></div>{(details?.genres?.length??0)>0&&<div className="media-details-genres">{details?.genres?.slice(0,4).map((genre)=><span key={genre}>{genre}</span>)}</div>}<div className="media-details-actions"><Link href={href} className="detail-watch-button"><Play size={14} fill="currentColor"/> {mediaType==="tv"?"Play episode":"Watch now"}</Link><div className="detail-save-button"><WatchlistButton item={{id:item.id,mediaType,title:safeTitle,poster_path:item.poster_path,release_date:year?`${year}-01-01`:null}} variant="inline"/></div><a href={theatreHref} target="_blank" rel="noreferrer" className="detail-secondary-button"><Clapperboard size={14}/> Play in Theatre</a>{details?.trailer&&<button type="button" className="detail-secondary-button" onClick={()=>setTrailerOpen(true)}><ExternalLink size={14}/> Trailer</button>}</div></div></div>
        <div className="media-details-description">{loadingDetails?<p className="details-loading">Finding the details…</p>:<><p>{details?.overview||("overview" in item?item.overview:" ")||"Settle in. Your title is ready when you are."}</p>{details?.credit&&<small>{mediaType==="movie"?"Directed by":"Created by"} <strong>{details.credit}</strong></small>}</>}</div>
        {mediaType==="tv"&&details?.seasons?.length ? <section className="episode-guide"><div className="episode-guide-heading"><span className="section-kicker">EPISODE GUIDE</span><h3>Keep watching</h3><label>Choose season<select aria-label="Choose season" value={selectedSeason} onChange={event=>setSelectedSeason(Number(event.target.value))}>{details.seasons.map(season=><option key={season.season_number} value={season.season_number}>{season.name||`Season ${season.season_number}`}</option>)}</select><ChevronDown size={13}/></label></div>{loadingEpisodes?<div className="episode-guide-loading"><LoaderCircle size={16}/>Loading episodes</div>:episodes.map(episode=><Link key={episode.id} href={`/watch/tv/${item.id}?season=${episode.season_number}&episode=${episode.episode_number}`} className="episode-guide-item"><span className="episode-guide-number">{String(episode.episode_number).padStart(2,"0")}</span><span className="episode-guide-copy"><strong>{episode.name||`Episode ${episode.episode_number}`}</strong><small>{episode.runtime?`${episode.runtime} min`:"Episode"}</small>{episode.overview&&<span>{episode.overview}</span>}</span></Link>)}</section>:null}
        <div className="media-details-footnote"><Clapperboard size={15}/><span>Settle in. Your {mediaType==="movie"?"film":"series"} is ready when you are.</span></div>
      </>}
    </section>
  </div>,document.body)}
  </div>;
}
