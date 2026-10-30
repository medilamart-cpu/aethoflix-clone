"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Star, Info, Sparkles } from "lucide-react";
import type { TrendingMedia } from "@/lib/tmdb";
import { backdropUrl } from "@/lib/tmdb";

interface HeroProps {
  item: TrendingMedia;
  items?: TrendingMedia[];
}

export function Hero({ item: initialItem, items = [initialItem] }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const item = items[activeIndex] ?? initialItem;
  const title = item.title || (item as unknown as { name?: string }).name || "Featured Title";
  const href = item.media_type === "movie" ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}`;
  useEffect(() => {
    let cancelled = false;
    setLogoPath(null);
    fetch(`/api/media-logo?type=${item.media_type}&id=${item.id}`).then((response)=>response.json()).then((data)=>{ if (!cancelled) setLogoPath(data.logo || null); }).catch(()=>{});
    return () => { cancelled = true; };
  },[item.id,item.media_type]);
  return (
    <section className="home-hero">
      <Image
        src={backdropUrl(item.backdrop_path, "original")}
        alt={title}
        fill
        priority
        sizes="100vw"
        className="hero-image object-cover"
      />
      <div className="hero-shade" />
      <div className="hero-content-wrap">
        <div className="hero-content">
          <div className="hero-eyebrow"><Sparkles size={13} /> AETHOPLEX <i /> CURATED FOR TONIGHT</div>
          {logoPath ? <Image src={`https://image.tmdb.org/t/p/w500${logoPath}`} alt={title} width={600} height={260} className="hero-title-art" priority /> : <h1 className={title.length > 16 ? "hero-title-long" : ""}>{title}</h1>}
          <div className="hero-facts">
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
          <p className="hero-overview">
            {item.overview || "No description available."}
          </p>
          <div className="hero-actions">
            <Link
              href={href}
              className="hero-watch-button"
            >
              <Play className="h-4 w-4 fill-current" /> Watch now
            </Link>
            <Link href={href} className="hero-info-button"><Info size={17} /> More details</Link>
          </div>
          {items.length > 1 && <div className="hero-pagination"><span>{String(activeIndex + 1).padStart(2,"0")} <i>/</i> {String(items.length).padStart(2,"0")}</span><div>{items.map((feature,index) => <button type="button" key={feature.id} aria-label={`Show feature ${index + 1}`} aria-current={index === activeIndex} onClick={() => setActiveIndex(index)} className={index === activeIndex ? "hero-page-active" : ""} />)}</div><button type="button" className="hero-arrow" aria-label="Previous feature" onClick={() => setActiveIndex((activeIndex - 1 + items.length) % items.length)}>‹</button><button type="button" className="hero-arrow" aria-label="Next feature" onClick={() => setActiveIndex((activeIndex + 1) % items.length)}>›</button></div>}
        </div>
      </div>
    </section>
  );
}
