"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Check,
  ArrowUpRight,
  Info,
  ChevronDown,
  Film,
  Download,
  Share2,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";
import { getAnimeServers, type AnimeServerOption } from "@/lib/providers";
import { VideoJSPlayer } from "./VideoJSPlayer";

export interface AnimeEpisodeItem {
  id: number;
  episode_number: number;
  season_number?: number;
  name: string;
  still_path: string | null;
  runtime?: number | null;
  overview?: string;
}

export interface AnimeSeasonItem {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
}

interface AethoAnimePlayerProps {
  title: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  anilistId: number;
  malId?: number | null;
  tmdbId?: number | null;
  initialSeason?: number;
  initialEpisode?: number;
  seasons?: AnimeSeasonItem[];
  episodes?: AnimeEpisodeItem[];
  backHref?: string;
}

export function AethoAnimePlayer({
  title,
  overview,
  posterPath,
  backdropPath,
  anilistId,
  malId,
  tmdbId,
  initialSeason = 1,
  initialEpisode = 1,
  seasons = [],
  episodes: initialEpisodes = [],
  backHref = "/anime",
}: AethoAnimePlayerProps) {
  const router = useRouter();
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode);
  const [subOrDub, setSubOrDub] = useState<"sub" | "dub">("sub");
  const [serverId, setServerId] = useState<string>("megaplay");
  const [showSourcesInfo, setShowSourcesInfo] = useState<boolean>(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string>("");

  // Direct HLS CDN stream via Video.js
  const [directHlsUrl, setDirectHlsUrl] = useState<string | null>(null);
  const [resolvingDirect, setResolvingDirect] = useState<boolean>(false);

  // Auto-resolve direct HLS whenever episode or audio changes
  useEffect(() => {
    let cancelled = false;
    setResolvingDirect(true);
    setDirectHlsUrl(null);

    fetch(`/api/resolve-anime?id=${anilistId}&e=${selectedEpisode}&sub=${subOrDub}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok && data.playable) {
          setDirectHlsUrl(data.playable);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolvingDirect(false);
      });

    return () => {
      cancelled = true;
    };
  }, [anilistId, selectedEpisode, subOrDub]);

  // Season episodes state
  const [currentEpisodes, setCurrentEpisodes] = useState<AnimeEpisodeItem[]>(initialEpisodes);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);

  // Dynamic live viewer count (matching the aesthetic in photos)
  const [liveCount, setLiveCount] = useState<number>(214);

  useEffect(() => {
    // Subtle realistic fluctuation for live viewer badge
    const interval = setInterval(() => {
      setLiveCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(180, Math.min(290, prev + delta));
      });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Fetch episodes when season changes if tmdbId is available
  useEffect(() => {
    if (!tmdbId || selectedSeason <= 0) return;

    let isCancelled = false;
    setLoadingEpisodes(true);

    fetch(`/api/tv/${tmdbId}/season/${selectedSeason}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.ok && Array.isArray(data.episodes) && data.episodes.length > 0) {
          setCurrentEpisodes(data.episodes);
          // If current episode is not in this season, default to first episode of season
          const hasCurrent = data.episodes.some((e: AnimeEpisodeItem) => e.episode_number === selectedEpisode);
          if (!hasCurrent && data.episodes[0]) {
            setSelectedEpisode(data.episodes[0].episode_number);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setLoadingEpisodes(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [tmdbId, selectedSeason]);

  // Compute available anime servers for the current episode & audio
  const servers: AnimeServerOption[] = useMemo(() => {
    return getAnimeServers(anilistId, selectedEpisode, subOrDub, malId ?? null);
  }, [anilistId, selectedEpisode, subOrDub, malId]);

  const activeServer = useMemo(() => {
    return servers.find((s) => s.id === serverId) || servers[0];
  }, [servers, serverId]);

  // Next episode availability
  const currentEpIndex = currentEpisodes.findIndex((e) => e.episode_number === selectedEpisode);
  const hasNextEpisode = currentEpIndex >= 0 && currentEpIndex < currentEpisodes.length - 1;
  const nextEpisodeNumber = hasNextEpisode ? currentEpisodes[currentEpIndex + 1].episode_number : null;

  const currentEpisodeDetails = currentEpisodes.find((e) => e.episode_number === selectedEpisode);

  // Handle theatre mode
  const theatreUrl = tmdbId
    ? `https://aethoflix.world/?tmdb=${tmdbId}&type=tv&season=${selectedSeason}&episode=${selectedEpisode}&title=${encodeURIComponent(title)}`
    : activeServer.url;

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareToast("Link copied to clipboard!");
      setTimeout(() => setShareToast(""), 3000);
    }
  };

  const scrollToServers = () => {
    const el = document.getElementById("server-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="watch-page">
      {/* ── Top Header ── */}
      <header className="watch-header">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to browse</span>
        </Link>

        <div className="watch-header-side">
          <span className="watch-live-dot" />
          <span>NOW PLAYING</span>
        </div>
      </header>

      {/* ── Main Layout (Screen + Sidebar) ── */}
      <main className="watch-layout">
        {/* Left / Main Section */}
        <section className="watch-main">
          {/* 16:9 Video Player Screen */}
          <div className="watch-screen">
            {serverId === "videojs" ? (
              directHlsUrl ? (
                <VideoJSPlayer
                  key={`videojs-${selectedEpisode}-${subOrDub}`}
                  src={directHlsUrl}
                  type="application/x-mpegURL"
                  poster={backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : undefined}
                  storageKey={`anime:${anilistId}:${selectedEpisode}`}
                  className="h-full w-full"
                />
              ) : resolvingDirect ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black/90 p-4 text-center">
                  <Zap className="h-8 w-8 animate-pulse text-sky-400" />
                  <span className="text-sm font-semibold text-white">Connecting to Direct CDN (Video.js)...</span>
                  <span className="text-xs text-neutral-400">Resolving high-speed 1080p HLS stream</span>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
                  <span className="text-sm text-neutral-300">Direct CDN not available for this episode.</span>
                  <button
                    type="button"
                    onClick={() => setServerId(servers[0]?.id || "megaplay")}
                    className="rounded-lg bg-sky-500/20 border border-sky-400/30 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/30"
                  >
                    Switch to Server 1 (MegaPlay)
                  </button>
                </div>
              )
            ) : activeServer?.url ? (
              <iframe
                key={`${activeServer.id}-${selectedSeason}-${selectedEpisode}-${subOrDub}`}
                src={activeServer.url}
                title={`${title} Episode ${selectedEpisode} Player`}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/60 text-sm text-neutral-400">
                Finding anime server...
              </div>
            )}

            {/* Corner Badge */}
            <div className="screen-corner-label">
              <span className="screen-dot" />
              <span>{serverId === "videojs" ? "AETHOFLIX VIDEO.JS" : "AETHOFLIX PLAYER"}</span>
            </div>
          </div>

          {/* Title bar & Actions matching screenshot */}
          <div className="watch-meta-block">
            {/* Row 1: Overline + Next Episode & Play in Theatre */}
            <div className="watch-meta-row1">
              <div className="section-overline">
                <span>ANIME PLAYER</span>
                <button
                  type="button"
                  onClick={scrollToServers}
                  className="server-badge"
                  title="Click to change server"
                >
                  {serverId === "videojs" ? "⚡ DIRECT (VIDEO.JS)" : `SERVER ${activeServer.serverNumber}`}
                </button>
              </div>

              <div className="watch-row1-actions">
                <button
                  type="button"
                  disabled={!hasNextEpisode}
                  onClick={() => nextEpisodeNumber && setSelectedEpisode(nextEpisodeNumber)}
                  className="next-episode-action"
                >
                  <span>Next episode</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>

                <a
                  href={theatreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="theatre-action"
                >
                  <Film className="h-3.5 w-3.5 text-blue-300" />
                  <span>Play in Theatre</span>
                </a>
              </div>
            </div>

            {/* Row 2: Clean Series Title & Utility Actions */}
            <div className="watch-meta-row2">
              <div className="min-w-0">
                <h1>{title}</h1>
                {currentEpisodeDetails?.name && (
                  <p className="watch-episode-subtitle">
                    Episode {selectedEpisode}: {currentEpisodeDetails.name}
                  </p>
                )}
              </div>

              <div className="watch-row2-actions">
                <button
                  type="button"
                  onClick={() => setShowDownloadDialog(true)}
                  className="icon-action-btn"
                  title="Download options"
                >
                  <Download className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="icon-action-btn"
                  title="Share link"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Share toast notification */}
            {shareToast && (
              <div className="mt-1 inline-flex items-center gap-1.5 self-start rounded-lg border border-cyan-500/30 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-200">
                <Check className="h-3.5 w-3.5 text-cyan-400" /> {shareToast}
              </div>
            )}

            {/* Overview synopsis */}
            {overview && (
              <p className="watch-description leading-relaxed">
                {overview.replace(/<[^>]*>?/gm, "")}
              </p>
            )}
          </div>

          {/* ── Episodes Section ("UP NEXT, ON YOUR TERMS") ── */}
          <div className="player-episodes">
            <div className="episodes-header-block">
              <div className="episodes-header-row1">
                <span className="section-overline">UP NEXT, ON YOUR TERMS</span>
                {/* Live counter badge */}
                <div className="live-pill-badge">
                  <span className="live-pill-dot" />
                  <span>{liveCount} live</span>
                </div>
              </div>

              <div className="episodes-header-row2">
                <div className="episode-heading">
                  <h2>Episodes</h2>
                </div>

                {/* Arc / Season Dropdown */}
                {seasons.length > 0 && (
                  <div className="season-select-wrap">
                    <select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    >
                      {seasons.map((s) => (
                        <option key={s.id} value={s.season_number}>
                          {s.name} ({s.episode_count} eps)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Episode List */}
            <div className="player-episode-list">
              {loadingEpisodes ? (
                <div className="py-8 text-center text-xs text-neutral-400">Loading episodes...</div>
              ) : currentEpisodes.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  No episodes found for this season.
                </div>
              ) : (
                currentEpisodes.map((ep) => {
                  const isCurrent = ep.episode_number === selectedEpisode;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setSelectedEpisode(ep.episode_number)}
                      className={`player-episode group ${isCurrent ? "selected" : ""}`}
                    >
                      <span className="player-episode-number">{ep.episode_number}</span>

                      <span className="player-episode-still">
                        {ep.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                            alt={ep.name}
                            loading="lazy"
                          />
                        ) : posterPath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${posterPath}`}
                            alt={ep.name}
                            loading="lazy"
                          />
                        ) : (
                          <Film className="h-4 w-4 text-neutral-500" />
                        )}
                      </span>

                      <span className="player-episode-copy">
                        <strong>{ep.name || `Episode ${ep.episode_number}`}</strong>
                        <small>
                          {ep.runtime ? `${ep.runtime} min` : `Episode ${ep.episode_number}`}
                        </small>
                      </span>

                      {isCurrent ? (
                        <span className="playing-label">
                          <span className="playing-bars">
                            <i />
                            <i />
                            <i />
                          </span>
                          <span>PLAYING</span>
                        </span>
                      ) : (
                        <Play className="h-4 w-4 text-neutral-500 transition-colors group-hover:text-white" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right / Sidebar Section (Server Selection Panel) */}
        <aside className="watch-sidebar">
          <div id="server-panel" className="server-panel">
            <div className="server-panel-heading">
              <span className="section-overline">
                <Film className="h-3 w-3" />
                <span>STREAMING SERVERS</span>
              </span>
              <h2>Choose a server</h2>
              <p>Switch between servers if a stream does not start. Audio is matched by AniList ID.</p>
            </div>

            {/* Subtitled / Dubbed switch */}
            <div className="audio-switch" role="group" aria-label="Audio track selection">
              <button
                type="button"
                className={subOrDub === "sub" ? "audio-active" : ""}
                onClick={() => setSubOrDub("sub")}
              >
                SUBTITLED
              </button>
              <button
                type="button"
                className={subOrDub === "dub" ? "audio-active" : ""}
                onClick={() => setSubOrDub("dub")}
              >
                DUBBED
              </button>
            </div>

            {/* Server Grid: Video.js Direct + Embed Mirrors */}
            <div className="server-list">
              {/* Premier Option: Direct CDN Video.js */}
              <button
                type="button"
                onClick={() => setServerId("videojs")}
                className={`server-option col-span-2 ${serverId === "videojs" ? "server-active" : ""}`}
                aria-pressed={serverId === "videojs"}
              >
                <span className="server-number flex items-center justify-center text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <span className="server-name">
                  <span className="flex items-center gap-1.5">
                    <span>Direct CDN</span>
                    <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[7.5px] font-bold text-sky-300">Video.js</span>
                  </span>
                  <small>{serverId === "videojs" ? "Now streaming ad-free" : directHlsUrl ? "Ad-Free • Ready" : resolvingDirect ? "Resolving stream..." : "High-speed HLS"}</small>
                </span>
                {serverId === "videojs" ? (
                  <Check className="h-4 w-4 text-cyan-300 ml-auto" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400 ml-auto" />
                )}
              </button>

              {servers.map((s) => {
                const isActive = serverId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServerId(s.id)}
                    className={`server-option ${isActive ? "server-active" : ""}`}
                    aria-pressed={isActive}
                  >
                    <span className="server-number">{String(s.serverNumber).padStart(2, "0")}</span>
                    <span className="server-name">
                      <span>Server {s.serverNumber}</span>
                      <small>{isActive ? "Now streaming" : "Tap to play"}</small>
                    </span>
                    {isActive ? (
                      <Check className="h-4 w-4 text-cyan-300" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* About Sources disclaimer toggle */}
            <button
              type="button"
              className="sources-toggle"
              onClick={() => setShowSourcesInfo(!showSourcesInfo)}
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showSourcesInfo ? "Hide source details" : "About these sources"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showSourcesInfo ? "rotate-180" : ""}`}
              />
            </button>

            {showSourcesInfo && (
              <p className="source-note">
                Aethoflix does not host or control third-party streams. Source availability,
                playback speed and audio tracks are managed directly by each embed provider.
              </p>
            )}
          </div>
        </aside>
      </main>

      {/* ── Offline Viewing / Download Dialog ── */}
      {showDownloadDialog && (
        <div
          className="dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDownloadDialog(false);
          }}
        >
          <div className="download-dialog">
            <button
              type="button"
              onClick={() => setShowDownloadDialog(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300">
              <Download className="h-5 w-5" />
            </div>

            <span className="section-overline">OFFLINE VIEWING</span>
            <h2 className="mb-2 mt-1 text-xl font-semibold text-white">
              Download from your streaming app.
            </h2>
            <p className="text-xs leading-relaxed text-neutral-400">
              TMDb provides title and catalog information, not raw video files. For offline viewing,
              use official streaming services that offer this title in your region.
            </p>

            <a
              href={`https://www.themoviedb.org/${tmdbId ? `tv/${tmdbId}` : ""}/watch`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-400"
            >
              <span>Find official options</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
