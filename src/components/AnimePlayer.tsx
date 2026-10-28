"use client";

import { useState, useEffect } from "react";
import { animeDisplayName, type AnimeMedia } from "@/lib/anilist";
import { AethoAnimePlayer, type AnimeEpisodeItem, type AnimeSeasonItem } from "@/components/AethoAnimePlayer";

export function AnimePlayer({ anime }: { anime: AnimeMedia }) {
  const title = animeDisplayName(anime);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<AnimeSeasonItem[]>([]);
  const [initialEpisodes, setInitialEpisodes] = useState<AnimeEpisodeItem[]>([]);
  const [initialSeason, setInitialSeason] = useState<number>(1);
  const [initialEpisode, setInitialEpisode] = useState<number>(1);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    // Search for TMDb TV match to pull rich arcs and episode stills
    const searchTitle = anime.title.english || anime.title.romaji || title;
    fetch(`/api/anime-match?title=${encodeURIComponent(searchTitle)}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (isCancelled) return;
        if (data.ok && data.tv) {
          const tv = data.tv;
          setTmdbId(tv.id);

          const validSeasons: AnimeSeasonItem[] = (tv.seasons || [])
            .filter((s: any) => s.season_number > 0)
            .map((s: any) => ({
              id: s.id,
              season_number: s.season_number,
              name: s.name,
              episode_count: s.episode_count,
            }));

          setSeasons(validSeasons);

          // For One Piece or long running anime, default to the last or active season (e.g. Wano or Season 1)
          // If One Piece (TMDb 37854 or AniList 21), we can find Wano or default to Season 1
          const wanoSeason = validSeasons.find((s) => s.name.toLowerCase().includes("wano"));
          const chosenSeason = wanoSeason ? wanoSeason.season_number : (validSeasons[0]?.season_number ?? 1);
          setInitialSeason(chosenSeason);

          // Fetch initial episodes
          try {
            const epRes = await fetch(`/api/tv/${tv.id}/season/${chosenSeason}`);
            const epData = await epRes.json();
            if (epData.ok && Array.isArray(epData.episodes) && epData.episodes.length > 0) {
              setInitialEpisodes(epData.episodes);
              setInitialEpisode(epData.episodes[0].episode_number);
            }
          } catch {}
        } else {
          // Fallback to AniList episode count
          const totalEps = anime.episodes || 12;
          const fallbackEpisodes: AnimeEpisodeItem[] = Array.from({ length: totalEps }, (_, i) => ({
            id: i + 1,
            episode_number: i + 1,
            name: `Episode ${i + 1}`,
            still_path: null,
            runtime: 24,
          }));
          setInitialEpisodes(fallbackEpisodes);
          setSeasons([
            {
              id: 1,
              season_number: 1,
              name: "Season 1",
              episode_count: totalEps,
            },
          ]);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        const totalEps = anime.episodes || 12;
        setInitialEpisodes(
          Array.from({ length: totalEps }, (_, i) => ({
            id: i + 1,
            episode_number: i + 1,
            name: `Episode ${i + 1}`,
            still_path: null,
            runtime: 24,
          }))
        );
      })
      .finally(() => {
        if (!isCancelled) setLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [anime, title]);

  if (!loaded) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-white/10 bg-neutral-900/40 text-xs text-neutral-400">
        Loading anime streams and episodes...
      </div>
    );
  }

  return (
    <AethoAnimePlayer
      title={title}
      overview={anime.description ?? undefined}
      posterPath={anime.coverImage.large}
      backdropPath={anime.bannerImage}
      anilistId={anime.id}
      malId={anime.idMal}
      tmdbId={tmdbId}
      initialSeason={initialSeason}
      initialEpisode={initialEpisode}
      seasons={seasons}
      episodes={initialEpisodes}
      backHref="/anime"
    />
  );
}
