"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { animeStreamUrls } from "@/lib/providers";
import { animeDisplayName, type AnimeMedia } from "@/lib/anilist";

const AD_PARTNER_URL_1 = process.env.AD_PARTNER_URL_1 ?? "";
const AD_PARTNER_URL_2 = process.env.AD_PARTNER_URL_2 ?? "";

export function AnimePlayer({ anime }: { anime: AnimeMedia }) {
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const routingKey = `anime:${anime.id}:${season}:${episode}`;
  const mirrors = animeStreamUrls(anime.id, season, episode, anime.idMal);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Season
          <input
            type="number"
            min={1}
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="min-h-10 w-24 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Episode
          <input
            type="number"
            min={1}
            value={episode}
            onChange={(e) => setEpisode(Number(e.target.value))}
            className="min-h-10 w-24 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white"
          />
        </label>
      </div>
      <VideoPlayer
        routingKey={routingKey}
        routingTitle={animeDisplayName(anime)}
        mirrors={mirrors}
        adPartnerUrl1={AD_PARTNER_URL_1 || undefined}
        adPartnerUrl2={AD_PARTNER_URL_2 || undefined}
      />
    </div>
  );
}
