"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Film, Download, Share2, ChevronDown } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { backdropUrl } from "@/lib/tmdb";
import type { MovieDetail, TVDetail } from "@/lib/tmdb";
import { movieStreamUrls, tvStreamUrls, getKnownAnimeMatch } from "@/lib/providers";
import { AethoAnimePlayer, type AnimeSeasonItem } from "./AethoAnimePlayer";

const AD_PARTNER_URL_1 = process.env.AD_PARTNER_URL_1 ?? "";
const AD_PARTNER_URL_2 = process.env.AD_PARTNER_URL_2 ?? "";

interface MovieDetailPageProps {
  movie: MovieDetail;
}

export function MovieDetailPage({ movie }: MovieDetailPageProps) {
  const routingKey = `movie:${movie.id}`;
  const mirrors = movieStreamUrls(movie.id);
  const [shareToast, setShareToast] = useState(false);

  return (
    <div className="watch-page media-watch-page">
      <header className="watch-header">
        <Link
          href="/movies"
          className="flex items-center gap-2 text-xs font-medium text-neutral-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>
        <div className="watch-header-side"><span className="watch-live-dot" /><span>NOW PLAYING</span></div>
      </header>

      <main className="watch-layout media-watch-layout">
        <section className="watch-main">
          <VideoPlayer
            routingKey={routingKey}
            routingTitle={movie.title}
            mirrors={mirrors}
            poster={backdropUrl(movie.backdrop_path, "w1280")}
            adPartnerUrl1={AD_PARTNER_URL_1 || undefined}
            adPartnerUrl2={AD_PARTNER_URL_2 || undefined}
          />
          <div className="watch-meta-block">
            <div className="watch-meta-row1">
              <span className="section-overline"><Film className="h-3 w-3" /> FILM PLAYER</span>
              <div className="watch-row1-actions">
                <a href={`https://theatre.aethoflix.world/?tmdb=${movie.id}&type=movie&title=${encodeURIComponent(movie.title)}`} target="_blank" rel="noreferrer" className="theatre-action"><Film className="h-3.5 w-3.5 text-blue-300" /><span>Play in Theatre</span></a>
              </div>
            </div>
            <div className="watch-meta-row2">
              <div className="min-w-0">
                <h1>{movie.title}</h1>
                <p className="media-watch-facts">{movie.release_date?.slice(0, 4)}{movie.runtime ? ` / ${movie.runtime} min` : ""}{movie.vote_average > 0 ? ` / ${movie.vote_average.toFixed(1)}` : ""}</p>
              </div>
              <div className="watch-row2-actions">
                <button type="button" className="icon-action-btn" title="Download options" aria-label="Download options"><Download className="h-4 w-4" /></button>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => { setShareToast(true); window.setTimeout(() => setShareToast(false), 2200); }); }} className="icon-action-btn" title="Share link" aria-label="Share link"><Share2 className="h-4 w-4" /></button>
              </div>
            </div>
            {shareToast && <span className="media-share-toast">Link copied</span>}
            <p className="watch-description">{movie.overview || "No overview available."}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

interface TVDetailPageProps {
  tv: TVDetail;
  initialSeason?: number;
  initialEpisode?: number;
}

export function TVDetailPage({ tv, initialSeason, initialEpisode }: TVDetailPageProps) {
  const isPotentialAnime =
    tv.original_language === "ja" ||
    tv.genres?.some((g) => g.name.toLowerCase() === "animation");

  const [animeMatch, setAnimeMatch] = useState<{ anilistId: number; malId: number | null } | null>(() => {
    return getKnownAnimeMatch(tv.id);
  });

  useEffect(() => {
    if (!isPotentialAnime || animeMatch?.anilistId) return;
    fetch(`/api/anime-match?tmdbId=${tv.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.anilistId) {
          setAnimeMatch({ anilistId: d.anilistId, malId: d.malId });
        }
      })
      .catch(() => {});
  }, [tv.id, isPotentialAnime, animeMatch?.anilistId]);

  const [season, setSeason] = useState<number>(initialSeason ?? tv.seasons.find((s) => s.season_number > 0)?.season_number ?? 1);
  const [episode, setEpisode] = useState<number>(initialEpisode ?? 1);
  const [episodes, setEpisodes] = useState<Array<{ id: number; episode_number: number; name: string; still_path: string | null; runtime?: number | null; overview?: string }>>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const routingKey = `tv:${tv.id}:${season}:${episode}`;
  const mirrors = tvStreamUrls(tv.id, season, episode);

  useEffect(() => {
    let cancelled = false;
    setEpisodesLoading(true);
    fetch(`/api/tv/${tv.id}/season/${season}`)
      .then((response) => response.json())
      .then((data) => { if (!cancelled && Array.isArray(data.episodes)) setEpisodes(data.episodes); })
      .catch(() => { if (!cancelled) setEpisodes([]); })
      .finally(() => { if (!cancelled) setEpisodesLoading(false); });
    return () => { cancelled = true; };
  }, [tv.id, season]);

  // If this TV series has an AniList anime match (e.g. One Piece), render the Aethoplex Anime Player!
  if (animeMatch?.anilistId) {
    const animeSeasons: AnimeSeasonItem[] = (tv.seasons || [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({
        id: s.id,
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
      }));

    // For One Piece, check if Wano or another arc is selected or default to Season 1
    const wanoSeason = animeSeasons.find((s) => s.name.toLowerCase().includes("wano"));
    const initialSeason = wanoSeason ? wanoSeason.season_number : (animeSeasons[0]?.season_number ?? 1);

    return (
      <AethoAnimePlayer
        title={tv.name}
        overview={tv.overview}
        posterPath={tv.poster_path}
        backdropPath={tv.backdrop_path}
        anilistId={animeMatch.anilistId}
        malId={animeMatch.malId}
        tmdbId={tv.id}
        initialSeason={initialSeason}
        seasons={animeSeasons}
        backHref="/series"
      />
    );
  }

  return (
    <div className="watch-page media-watch-page">
      <header className="watch-header">
        <Link
          href="/series"
          className="flex items-center gap-2 text-xs font-medium text-neutral-300 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to browse
        </Link>
        <div className="watch-header-side"><span className="watch-live-dot" /><span>NOW PLAYING</span></div>
      </header>

      <main className="watch-layout media-watch-layout">
        <section className="watch-main">
          <VideoPlayer
            routingKey={routingKey}
            routingTitle={`${tv.name} S${season}E${episode}`}
            mirrors={mirrors}
            poster={backdropUrl(tv.backdrop_path, "w1280")}
            adPartnerUrl1={AD_PARTNER_URL_1 || undefined}
            adPartnerUrl2={AD_PARTNER_URL_2 || undefined}
          />
          <div className="watch-meta-block">
            <div className="watch-meta-row1"><span className="section-overline"><Film className="h-3 w-3" /> SERIES PLAYER</span><div className="watch-row1-actions"><button type="button" className="next-episode-action" disabled={episode >= (tv.seasons.find((item) => item.season_number === season)?.episode_count ?? 1)} onClick={() => setEpisode((current) => current + 1)}>Next episode</button><a href={`https://theatre.aethoflix.world/?tmdb=${tv.id}&type=tv&season=${season}&episode=${episode}&title=${encodeURIComponent(tv.name)}`} target="_blank" rel="noreferrer" className="theatre-action"><Film className="h-3.5 w-3.5 text-blue-300" /><span>Play in Theatre</span></a></div></div>
            <div className="watch-meta-row2"><div className="min-w-0"><h1>{tv.name} / {episodes.find((item) => item.episode_number === episode)?.name ?? `Episode ${episode}`}</h1><p className="media-watch-facts">{tv.first_air_date?.slice(0, 4)} / {tv.number_of_seasons} seasons / {tv.number_of_episodes} episodes</p></div></div>
            <p className="watch-description">{tv.overview || "No overview available."}</p>
          </div>
          <section className="player-episodes">
            <div className="episodes-header-block"><div className="episodes-header-row1"><span className="section-overline">UP NEXT, ON YOUR TERMS</span></div><div className="episodes-header-row2"><h2>Episodes</h2><label className="season-select-wrap"><select aria-label="Choose season" value={season} onChange={(event) => { setSeason(Number(event.target.value)); setEpisode(1); }}>{tv.seasons.filter((item) => item.season_number > 0).map((item) => <option key={item.id} value={item.season_number}>{item.name} ({item.episode_count} eps)</option>)}</select><ChevronDown className="h-3.5 w-3.5 text-neutral-400" /></label></div></div>
            <div className="player-episode-list">{episodesLoading ? <div className="py-8 text-center text-xs text-neutral-400">Loading episodes...</div> : episodes.map((item) => <button key={item.id} type="button" onClick={() => setEpisode(item.episode_number)} className={`player-episode group ${item.episode_number === episode ? "selected" : ""}`}><span className="player-episode-number">{String(item.episode_number).padStart(2, "0")}</span><span className="player-episode-still">{item.still_path ? <img src={`https://image.tmdb.org/t/p/w300${item.still_path}`} alt={item.name} loading="lazy" /> : <Film className="h-4 w-4 text-neutral-500" />}</span><span className="player-episode-copy"><strong>{item.name || `Episode ${item.episode_number}`}</strong><small>{item.runtime ? `${item.runtime} min` : `Episode ${item.episode_number}`}</small></span>{item.episode_number === episode && <span className="playing-label">PLAYING</span>}</button>)}</div>
          </section>
        </section>
      </main>
    </div>
  );
}
