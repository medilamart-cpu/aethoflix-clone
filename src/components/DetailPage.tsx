"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Star, Play } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { MediaRow } from "./MediaRow";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
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

  return (
    <div className="detail-page relative min-h-screen">
      <Image
        src={backdropUrl(movie.backdrop_path, "w1280")}
        alt={movie.title}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-30 blur-sm"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/55 to-background" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          href="/movies"
          className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-black/80 hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

        <div className="mt-6 flex flex-col gap-6 md:flex-row">
          <Image
            src={posterUrl(movie.poster_path, "w500")}
            alt={movie.title}
            width={200}
            height={300}
            className="rounded-xl border border-white/10 shadow-2xl"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{movie.title}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-neutral-300">
              {movie.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  {movie.vote_average.toFixed(1)}
                </span>
              )}
              {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
              {movie.runtime && <span>{movie.runtime} min</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs"
                >
                  {g.name}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-300">
              {movie.overview || "No overview available."}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Play className="h-4 w-4" /> Watch now
          </h2>
          <VideoPlayer
            routingKey={routingKey}
            routingTitle={movie.title}
            mirrors={mirrors}
            adPartnerUrl1={AD_PARTNER_URL_1 || undefined}
            adPartnerUrl2={AD_PARTNER_URL_2 || undefined}
          />
        </div>

        {movie.similar?.results && movie.similar.results.length > 0 && (
          <MediaRow
            title="More like this"
            items={movie.similar.results}
            hrefForItem={(item) => `/watch/movie/${item.id}`}
            titleForItem={(item) => "title" in item ? (item as { title: string }).title : "Untitled"}
          />
        )}
      </div>
    </div>
  );
}

interface TVDetailPageProps {
  tv: TVDetail;
}

export function TVDetailPage({ tv }: TVDetailPageProps) {
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

  const [season, setSeason] = useState<number>(tv.seasons.find((s) => s.season_number > 0)?.season_number ?? 1);
  const [episode, setEpisode] = useState<number>(1);
  const routingKey = `tv:${tv.id}:${season}:${episode}`;
  const mirrors = tvStreamUrls(tv.id, season, episode);

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
    <div className="detail-page relative min-h-screen">
      <Image
        src={backdropUrl(tv.backdrop_path, "w1280")}
        alt={tv.name}
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-30 blur-sm"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/55 to-background" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          href="/series"
          className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-black/80 hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

        <div className="mt-6 flex flex-col gap-6 md:flex-row">
          <Image
            src={posterUrl(tv.poster_path, "w500")}
            alt={tv.name}
            width={200}
            height={300}
            className="rounded-xl border border-white/10 shadow-2xl"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{tv.name}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-neutral-300">
              {tv.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  {tv.vote_average.toFixed(1)}
                </span>
              )}
              {tv.first_air_date && <span>{tv.first_air_date.slice(0, 4)}</span>}
              <span>{tv.number_of_seasons} seasons · {tv.number_of_episodes} eps</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {tv.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs"
                >
                  {g.name}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-neutral-300">
              {tv.overview || "No overview available."}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-400 font-medium">
            Season
            <select
              value={season}
              onChange={(e) => {
                setSeason(Number(e.target.value));
                setEpisode(1);
              }}
              className="min-h-10 rounded-lg border border-white/15 bg-neutral-900 px-3 text-sm text-white cursor-pointer"
            >
              {tv.seasons
                .filter((s) => s.season_number > 0)
                .map((s) => (
                  <option key={s.id} value={s.season_number} className="bg-neutral-900 text-white">
                    {s.name} ({s.episode_count} eps)
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400 font-medium">
            Episode
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={episode <= 1}
                onClick={() => setEpisode((prev) => Math.max(1, prev - 1))}
                className="min-h-10 px-3 rounded-lg border border-white/15 bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ◀
              </button>
              <input
                type="number"
                min={1}
                max={tv.seasons.find((s) => s.season_number === season)?.episode_count ?? 1}
                value={episode}
                onChange={(e) => setEpisode(Math.max(1, Number(e.target.value)))}
                className="min-h-10 w-20 text-center rounded-lg border border-white/15 bg-neutral-900 px-2 text-sm font-semibold text-white"
              />
              <button
                type="button"
                disabled={episode >= (tv.seasons.find((s) => s.season_number === season)?.episode_count ?? 1)}
                onClick={() => setEpisode((prev) => prev + 1)}
                className="min-h-10 px-3 rounded-lg border border-white/15 bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ▶
              </button>
            </div>
          </label>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Play className="h-4 w-4" /> Watch S{season}E{episode}
          </h2>
          <VideoPlayer
            routingKey={routingKey}
            routingTitle={`${tv.name} S${season}E${episode}`}
            mirrors={mirrors}
            adPartnerUrl1={AD_PARTNER_URL_1 || undefined}
            adPartnerUrl2={AD_PARTNER_URL_2 || undefined}
          />
        </div>

        {tv.similar?.results && tv.similar.results.length > 0 && (
          <MediaRow
            title="More like this"
            items={tv.similar.results}
            hrefForItem={(item) => `/watch/tv/${item.id}`}
            titleForItem={(item) => "name" in item ? (item as { name: string }).name : "Untitled"}
          />
        )}
      </div>
    </div>
  );
}
