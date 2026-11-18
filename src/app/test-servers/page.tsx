"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Film,
  Tv,
  Play,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Gauge,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Columns,
  Square,
  ArrowLeft,
  RefreshCw,
  Info,
  Search,
  Plus,
  Radio,
  Eye,
  EyeOff,
  Layers,
  Settings,
} from "lucide-react";
import { VideoJSPlayer } from "@/components/VideoJSPlayer";

interface ServerSpec {
  id: string;
  name: string;
  domain: string;
  ads: string;
  free: string;
  notes: string;
  type: "direct" | "embed";
  idSupport: "tmdb" | "imdb" | "both";
  buildUrl: (
    mediaType: "movie" | "tv",
    tmdbId: string,
    imdbId: string | null,
    s?: string,
    e?: string,
    idPreference?: "tmdb" | "imdb"
  ) => string;
}

const PRESET_MOVIES = [
  { tmdbId: "693134", imdbId: "tt15239678", title: "Dune: Part Two (2024)" },
  { tmdbId: "60948", imdbId: "tt0065961", title: "On the Comet (1970)" },
  { tmdbId: "550", imdbId: "tt0137523", title: "Fight Club (1999)" },
  { tmdbId: "157336", imdbId: "tt0816692", title: "Interstellar (2014)" },
  { tmdbId: "155", imdbId: "tt0468569", title: "The Dark Knight (2008)" },
];

const PRESET_SERIES = [
  { tmdbId: "1396", imdbId: "tt0903747", title: "Breaking Bad", s: "1", e: "1" },
  { tmdbId: "1399", imdbId: "tt0944947", title: "Game of Thrones", s: "1", e: "1" },
  { tmdbId: "66732", imdbId: "tt4574334", title: "Stranger Things", s: "1", e: "1" },
  { tmdbId: "100088", imdbId: "tt3581920", title: "The Last of Us", s: "1", e: "1" },
  { tmdbId: "84958", imdbId: "tt9140554", title: "Loki", s: "1", e: "1" },
];

const DEFAULT_SERVERS: ServerSpec[] = [
  {
    id: "moviesnexus",
    name: "MoviesNexus",
    domain: "moviesnexus.fun",
    ads: "Sandboxed (Popups Blocked)",
    free: "Yes (1080p Stream)",
    notes: "Direct high-speed streaming embed used as underlying provider in TGFLIX. Works with strict sandboxing to block ads and popups.",
    type: "embed",
    idSupport: "both",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1", idPref = "tmdb") => {
      const activeId = idPref === "imdb" && imdb ? imdb : tmdb;
      return type === "tv"
        ? `https://www.moviesnexus.fun/tv/${activeId}/${s}/${e}`
        : `https://www.moviesnexus.fun/movie/${activeId}`;
    },
  },
  {
    id: "tgvid",
    name: "TGFLIX (TG Vid)",
    domain: "tgvid.lovable.app",
    ads: "Sandboxed (Zero Popups)",
    free: "Yes (Custom Shell)",
    notes: "TGFLIX player shell hosted on Lovable. Embeds player or proxies stream with custom overlay. Strict sandbox blocks all popups.",
    type: "embed",
    idSupport: "tmdb",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1") =>
      type === "tv"
        ? `https://tgvid.lovable.app/embed/tv/${tmdb}/${s}/${e}`
        : `https://tgvid.lovable.app/embed/movie/${tmdb}`,
  },
  {
    id: "direct-cdn",
    name: "Direct CDN (VidSync HLS)",
    domain: "vidsync-shard.workers.dev",
    ads: "Zero (Raw HLS Stream)",
    free: "Yes (Multi-Audio)",
    notes: "Direct .m3u8 HLS chunk streaming inside native Video.js player with custom CleanStream skin and multi-audio support.",
    type: "direct",
    idSupport: "tmdb",
    buildUrl: () => "",
  },
  {
    id: "server-multihd",
    name: "Server 2 (Multi HD)",
    domain: "nxsha.space",
    ads: "Low (Sandbox Protected)",
    free: "Yes (Multi-Lang Audio)",
    notes: "Multi-Language audio streams with 1080p high bitrate playback via AwsPly.",
    type: "embed",
    idSupport: "tmdb",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1") =>
      type === "tv"
        ? `https://nxsha.space/embed/tv/${tmdb}/${s}/${e}?server=AwsPly-[Multi-Lang]`
        : `https://nxsha.space/embed/movie/${tmdb}?server=AwsPly-[Multi-Lang]`,
  },
  {
    id: "vidlink",
    name: "Server 3 (VidLink)",
    domain: "vidlink.pro",
    ads: "Minimal / Clean",
    free: "Yes (Fast CDN)",
    notes: "High speed multi-CDN embed with auto-play and multi-language subtitle tracks.",
    type: "embed",
    idSupport: "both",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1", idPref = "tmdb") => {
      const activeId = idPref === "imdb" && imdb ? imdb : tmdb;
      return type === "tv"
        ? `https://vidlink.pro/tv/${activeId}/${s}/${e}?autoplay=true`
        : `https://vidlink.pro/movie/${activeId}?autoplay=true`;
    },
  },
  {
    id: "vidcore",
    name: "Server 4 (VidStuck / VidCore)",
    domain: "vidcore.org",
    ads: "Zero popups/banners",
    free: "Yes (No key required)",
    notes: "VidStuck fallback provider. 1080p/HLS support, subtitle tracks, clean dark player.",
    type: "embed",
    idSupport: "tmdb",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1") =>
      type === "tv"
        ? `https://vidcore.org/embed/tv/${tmdb}/${s}/${e}`
        : `https://vidcore.org/embed/movie/${tmdb}`,
  },
  {
    id: "embedwave",
    name: "EmbedWave",
    domain: "embedwave.cc",
    ads: "Zero, by design",
    free: "Yes (No signup)",
    notes: "Drop-in clean embed — identical /embed/ URL shape, multi-server switcher, ?nobrand=true param.",
    type: "embed",
    idSupport: "tmdb",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1") =>
      type === "tv"
        ? `https://embedwave.cc/embed/tv/${tmdb}/${s}/${e}?nobrand=true`
        : `https://embedwave.cc/embed/movie/${tmdb}?nobrand=true`,
  },
  {
    id: "videasy",
    name: "Videasy",
    domain: "player.videasy.to",
    ads: "Zero popups",
    free: "Yes",
    notes: "Modern clean iframe player with multiple sources and subtitle selectors.",
    type: "embed",
    idSupport: "tmdb",
    buildUrl: (type, tmdb, imdb, s = "1", e = "1") =>
      type === "tv"
        ? `https://player.videasy.to/tv/${tmdb}/${s}/${e}`
        : `https://player.videasy.to/movie/${tmdb}`,
  },
];

export default function TestServersPage() {
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [idInput, setIdInput] = useState("693134");
  const [tmdbId, setTmdbId] = useState("693134");
  const [imdbId, setImdbId] = useState<string | null>("tt15239678");
  const [mediaTitle, setMediaTitle] = useState("Dune: Part Two (2024)");
  const [mediaYear, setMediaYear] = useState("2024");
  const [isResolvingId, setIsResolvingId] = useState(false);
  const [idPreference, setIdPreference] = useState<"tmdb" | "imdb">("tmdb");

  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [activeServerId, setActiveServerId] = useState("moviesnexus");
  const [splitServerId, setSplitServerId] = useState<string | null>("tgvid");
  const [isSplitView, setIsSplitView] = useState(false);

  // Sandbox controls: Strict Stealth Sandbox (anti-ad) vs Permissive (testing popups)
  const [strictSandbox, setStrictSandbox] = useState(true);
  const [blockedPopupCount, setBlockedPopupCount] = useState(0);

  // Custom Server Testing
  const [customServerTemplate, setCustomServerTemplate] = useState("https://www.moviesnexus.fun/movie/{id}");
  const [customServerName, setCustomServerName] = useState("Custom Server Test");
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Direct CDN state
  const [directLoading, setDirectLoading] = useState(false);
  const [directStream, setDirectStream] = useState<string | null>(null);
  const [directDetails, setDirectDetails] = useState<any>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Latency & status benchmark
  const [serverLatencies, setServerLatencies] = useState<Record<string, { ms: number; ok: boolean } | null>>({});
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Intercept window.open attempts to monitor ad popups
  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (...args) {
      setBlockedPopupCount((prev) => prev + 1);
      return null;
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === "string" && (event.data.includes("ad") || event.data.includes("popup"))) {
        setBlockedPopupCount((prev) => prev + 1);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.open = originalOpen;
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Resolve ID helper: resolves TMDb ID <-> IMDb ID
  const handleResolveId = useCallback(async (queryId: string, currentMediaType: "movie" | "tv") => {
    const trimmed = queryId.trim();
    if (!trimmed) return;

    setIsResolvingId(true);
    try {
      const res = await fetch(`/api/resolve-id?id=${encodeURIComponent(trimmed)}&type=${currentMediaType}`);
      const data = await res.json();

      if (data.ok) {
        if (data.tmdbId) setTmdbId(String(data.tmdbId));
        if (data.imdbId) setImdbId(String(data.imdbId));
        if (data.title) setMediaTitle(data.year ? `${data.title} (${data.year})` : data.title);
        if (data.year) setMediaYear(data.year);
        if (data.mediaType && data.mediaType !== currentMediaType) {
          setMediaType(data.mediaType);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsResolvingId(false);
    }
  }, []);

  // Fetch Direct CDN stream when media changes
  const resolveDirectCdn = useCallback(async () => {
    if (activeServerId !== "direct-cdn" && splitServerId !== "direct-cdn") return;

    setDirectLoading(true);
    setDirectError(null);
    setDirectStream(null);
    setDirectDetails(null);

    try {
      const endpoint = `/api/resolve-tg?type=${mediaType}&id=${tmdbId}&s=${season}&e=${episode}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (data.ok && data.playable) {
        setDirectStream(data.playable);
        setDirectDetails(data);
      } else {
        setDirectError(data.error || "Direct CDN unavailable for this title");
      }
    } catch (err: any) {
      setDirectError(err.message || "Failed to reach Direct CDN resolver");
    } finally {
      setDirectLoading(false);
    }
  }, [mediaType, tmdbId, season, episode, activeServerId, splitServerId]);

  useEffect(() => {
    resolveDirectCdn();
  }, [resolveDirectCdn]);

  // Combined servers list including custom server if defined
  const allServers = useMemo(() => {
    const customSpec: ServerSpec = {
      id: "custom-tester",
      name: customServerName || "Custom Tester",
      domain: "custom-template",
      ads: "Testing Environment",
      free: "Configurable",
      notes: "Custom embed server configured via URL pattern. Tests custom headers, parameters, and sandbox suppression.",
      type: "embed",
      idSupport: "both",
      buildUrl: (type, tmdb, imdb, s = "1", e = "1", idPref = "tmdb") => {
        const id = idPref === "imdb" && imdb ? imdb : tmdb;
        return customServerTemplate
          .replace(/{id}/g, id)
          .replace(/{tmdbId}/g, tmdb)
          .replace(/{imdbId}/g, imdb || tmdb)
          .replace(/{type}/g, type)
          .replace(/{s}/g, s)
          .replace(/{season}/g, s)
          .replace(/{e}/g, e)
          .replace(/{episode}/g, e);
      },
    };

    return [...DEFAULT_SERVERS, customSpec];
  }, [customServerName, customServerTemplate]);

  // Run benchmark ping
  const runBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const q = new URLSearchParams({
        type: mediaType,
        id: tmdbId,
        s: season,
        e: episode,
      });
      const res = await fetch(`/api/check-servers?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const results: Record<string, { ms: number; ok: boolean }> = {};
        if (Array.isArray(data.results)) {
          for (const item of data.results) {
            results[item.id] = { ms: item.latency, ok: item.available };
          }
        }
        setServerLatencies(results);
      }
    } catch {
      // Fallback
    } finally {
      setIsBenchmarking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const activeServer = allServers.find((s) => s.id === activeServerId) || allServers[0];
  const splitServer = allServers.find((s) => s.id === splitServerId) || allServers[1];

  const getEmbedUrl = (spec: ServerSpec) =>
    spec.buildUrl(mediaType, tmdbId, imdbId, season, episode, idPreference);

  // Stealth Sandbox vs Permissive Sandbox
  // Strict mode explicitly omits allow-popups and allow-top-navigation
  const sandboxAttributes = strictSandbox
    ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-modals"
    : "allow-scripts allow-same-origin allow-forms allow-presentation allow-modals allow-popups allow-top-navigation";

  return (
    <div className="min-h-screen bg-[#0c0d12] text-zinc-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-[#12131a]/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to AethoFlix</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-base font-semibold text-white tracking-wide">
              Server Testing & Ad-Shield Lab
            </h1>
            <span className="text-xs bg-red-950/80 text-red-400 border border-red-800/50 px-2 py-0.5 rounded font-mono font-medium">
              MoviesNexus & Embed Testing
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSplitView(!isSplitView)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isSplitView
                ? "bg-red-600/20 border-red-500/50 text-red-200"
                : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/60"
            }`}
          >
            {isSplitView ? <Square className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
            <span>{isSplitView ? "Single Focus" : "Side-by-Side Dual View"}</span>
          </button>

          <button
            onClick={runBenchmark}
            disabled={isBenchmarking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/80 text-zinc-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBenchmarking ? "animate-spin text-red-400" : ""}`} />
            <span>{isBenchmarking ? "Pinging..." : "Benchmark Latency"}</span>
          </button>
        </div>
      </header>

      {/* ID Resolver & Parameter Controls */}
      <section className="bg-[#14151f] border-b border-zinc-800/80 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Movie / TV Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg bg-zinc-900/90 p-1 border border-zinc-800">
                <button
                  onClick={() => {
                    setMediaType("movie");
                    setIdInput("693134");
                    handleResolveId("693134", "movie");
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    mediaType === "movie"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Movie</span>
                </button>
                <button
                  onClick={() => {
                    setMediaType("tv");
                    setIdInput("1396");
                    setSeason("1");
                    setEpisode("1");
                    handleResolveId("1396", "tv");
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    mediaType === "tv"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Series / TV</span>
                </button>
              </div>

              {/* ID Input: Accepts TMDb or IMDb ID */}
              <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase">
                  TMDb or IMDb ID:
                </span>
                <input
                  type="text"
                  value={idInput}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setIdInput(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleResolveId(idInput, mediaType);
                    }
                  }}
                  placeholder="e.g. 693134 or tt15239678"
                  className="w-36 bg-transparent text-xs font-mono text-white outline-none focus:text-red-400"
                />
                <button
                  onClick={() => handleResolveId(idInput, mediaType)}
                  disabled={isResolvingId}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                >
                  {isResolvingId ? "Resolving..." : "Resolve"}
                </button>
              </div>

              {/* TV Season / Episode Inputs */}
              {mediaType === "tv" && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-mono text-zinc-400 font-medium">S</span>
                    <input
                      type="number"
                      min="1"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      className="w-12 bg-transparent text-xs font-mono text-white outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-mono text-zinc-400 font-medium">E</span>
                    <input
                      type="number"
                      min="1"
                      value={episode}
                      onChange={(e) => setEpisode(e.target.value)}
                      className="w-12 bg-transparent text-xs font-mono text-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 font-medium mr-1">Presets:</span>
              {(mediaType === "movie" ? PRESET_MOVIES : PRESET_SERIES).map((item) => {
                const isCurrent = tmdbId === item.tmdbId || idInput === item.imdbId;
                return (
                  <button
                    key={item.tmdbId}
                    onClick={() => {
                      setIdInput(item.tmdbId);
                      setTmdbId(item.tmdbId);
                      setImdbId(item.imdbId);
                      setMediaTitle(item.title);
                      const seriesItem = item as { s?: string; e?: string };
                      if (seriesItem.s) setSeason(seriesItem.s);
                      if (seriesItem.e) setEpisode(seriesItem.e);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      isCurrent
                        ? "bg-red-500/20 text-red-300 border border-red-500/40"
                        : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Media Identification Banner & ID Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-zinc-900/70 border border-zinc-800/80 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="text-zinc-400 font-sans font-medium">Selected Media:</span>
              <span className="text-white font-semibold font-sans">{mediaTitle}</span>
              <div className="h-3 w-px bg-zinc-700" />
              <span>TMDb: <strong className="text-red-400">{tmdbId}</strong></span>
              <span>IMDb: <strong className="text-amber-400">{imdbId || "None"}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-sans">Use for Server URLs:</span>
              <button
                onClick={() => setIdPreference("tmdb")}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  idPreference === "tmdb"
                    ? "bg-red-600 text-white font-semibold"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                TMDb ({tmdbId})
              </button>
              {imdbId && (
                <button
                  onClick={() => setIdPreference("imdb")}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    idPreference === "imdb"
                      ? "bg-amber-600 text-white font-semibold"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  IMDb ({imdbId})
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Server Selection Cards Grid */}
      <section className="px-4 lg:px-8 py-3.5 bg-[#0f1017] border-b border-zinc-800/80 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 min-w-max">
          {allServers.map((server) => {
            const isSelected = activeServerId === server.id;
            const isSplitSelected = isSplitView && splitServerId === server.id;
            const latencyData = serverLatencies[server.id];

            return (
              <div
                key={server.id}
                onClick={() => {
                  if (server.id === "custom-tester") {
                    setShowCustomModal(true);
                  }
                  setActiveServerId(server.id);
                }}
                className={`relative flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all min-w-[200px] ${
                  isSelected
                    ? "bg-red-950/30 border-red-500/60 shadow-lg shadow-red-950/20"
                    : isSplitSelected
                    ? "bg-blue-950/30 border-blue-500/60"
                    : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    {server.type === "direct" ? (
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                    ) : server.id === "moviesnexus" || server.id === "tgvid" ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs font-semibold text-white tracking-tight">
                      {server.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500" />
                  )}
                  {isSplitSelected && (
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-950 px-1 rounded">
                      Right
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1 font-mono">
                  <span className="truncate max-w-[120px]">{server.domain}</span>
                  {latencyData ? (
                    <span
                      className={`text-[10px] font-semibold px-1 rounded ${
                        latencyData.ok
                          ? "bg-emerald-950/80 text-emerald-400"
                          : "bg-red-950/80 text-red-400"
                      }`}
                    >
                      {latencyData.ms}ms
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">{server.ads}</span>
                  )}
                </div>

                {isSplitView && !isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSplitServerId(server.id);
                    }}
                    className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 font-medium text-left underline"
                  >
                    Compare on right pane →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Workbench Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 flex flex-col gap-6">
        {/* Sandbox & Ad-Shield Diagnostics Dashboard */}
        <section className="bg-[#12131b] border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                strictSandbox
                  ? "bg-emerald-950/50 border-emerald-600/40 text-emerald-400"
                  : "bg-amber-950/50 border-amber-600/40 text-amber-400"
              }`}
            >
              {strictSandbox ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-white">
                  Stealth Ad-Shield & Sandbox Guard
                </h2>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium border ${
                    strictSandbox
                      ? "bg-emerald-950/80 border-emerald-700/60 text-emerald-300"
                      : "bg-amber-950/80 border-amber-700/60 text-amber-300"
                  }`}
                >
                  {strictSandbox ? "ACTIVE: Popups & Redirects Prohibited" : "UNSANDBOXED: Popups Allowed (Testing)"}
                </span>
                <span className="text-[11px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  Blocked Popups: {blockedPopupCount}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {strictSandbox
                  ? "The iframe sandbox engine strips 'allow-popups' and 'allow-top-navigation'. Even if MoviesNexus or ad scripts attempt window.open or redirects, the browser physically terminates the attempt."
                  : "Permissive test mode. Popups and redirects can trigger. Switch back to Strict Sandbox to verify that all ads disappear."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => setStrictSandbox(!strictSandbox)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                strictSandbox
                  ? "bg-amber-950/40 hover:bg-amber-900/50 border-amber-700/50 text-amber-200"
                  : "bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-700/50 text-emerald-200"
              }`}
            >
              {strictSandbox ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{strictSandbox ? "Disable Shield (Test Ads)" : "Enable Stealth Shield (Block Ads)"}</span>
            </button>

            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure Custom Server</span>
            </button>
          </div>
        </section>

        {/* Active Server Info Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#13141e] border border-zinc-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400">
              {activeServer.type === "direct" ? (
                <Zap className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">{activeServer.name}</h2>
                <span className="text-[11px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  {activeServer.domain}
                </span>
                <span className="text-[11px] font-medium bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded">
                  {activeServer.ads}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{activeServer.notes}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {activeServer.type === "embed" && (
              <a
                href={getEmbedUrl(activeServer)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded border border-zinc-700 transition-colors"
              >
                <span>Open Raw URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {activeServer.type === "direct" && directStream && (
              <button
                onClick={() => copyToClipboard(directStream)}
                className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded border border-zinc-700 transition-colors"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? "Copied HLS" : "Copy .m3u8"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Players Area: Single or Side-by-Side Dual View */}
        <div className={`grid gap-6 ${isSplitView ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Primary View */}
          <div className="flex flex-col gap-2 bg-[#12131b] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-3.5 py-2 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">
                Primary: {activeServer.name}
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                URL: <span className="text-zinc-500">{activeServer.type === "embed" ? getEmbedUrl(activeServer) : "Direct HLS Stream"}</span>
              </span>
            </div>

            <div className="relative aspect-video w-full bg-black flex items-center justify-center">
              {activeServer.type === "direct" ? (
                directLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                    <p className="text-sm font-medium text-zinc-300">
                      Resolving Direct CDN HLS Stream from VidSync Shards...
                    </p>
                  </div>
                ) : directStream ? (
                  <VideoJSPlayer
                    src={directStream}
                    type="application/x-mpegURL"
                    autoplay={true}
                    controls={true}
                    className="w-full h-full"
                    storageKey={`lab:${mediaType}:${tmdbId}:${season}:${episode}`}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-6 text-center max-w-md">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                    <h3 className="text-base font-semibold text-white">Direct CDN Stream Unavailable</h3>
                    <p className="text-xs text-zinc-400">
                      {directError || "The TG Vid / VidSync cluster could not find active chunks for this ID."}
                    </p>
                    <button
                      onClick={() => setActiveServerId("moviesnexus")}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                    >
                      Switch to MoviesNexus (1080p Sandboxed)
                    </button>
                  </div>
                )
              ) : (
                <iframe
                  key={`${activeServer.id}-${mediaType}-${tmdbId}-${imdbId}-${season}-${episode}-${strictSandbox}-${idPreference}`}
                  src={getEmbedUrl(activeServer)}
                  className="w-full h-full border-0"
                  allowFullScreen
                  sandbox={sandboxAttributes}
                  referrerPolicy="origin"
                />
              )}
            </div>

            {/* Direct CDN Stream Diagnostics */}
            {activeServer.type === "direct" && directDetails && (
              <div className="p-3 bg-zinc-950/60 border-t border-zinc-800/80 text-xs font-mono text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> HLS Live 200 OK
                  </span>
                  <span>Audio: <strong className="text-white">{directDetails.audio || "en"}</strong></span>
                  <span>Quality: <strong className="text-white">{directDetails.quality || "Auto"}</strong></span>
                  <span>Sources: <strong className="text-white">{directDetails.availableCount || 1}</strong></span>
                </div>
                <div className="truncate max-w-md text-zinc-500 text-[11px]">
                  {directStream}
                </div>
              </div>
            )}
          </div>

          {/* Secondary View (Split / Side-by-Side) */}
          {isSplitView && (
            <div className="flex flex-col gap-2 bg-[#12131b] border border-blue-900/40 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-3.5 py-2 bg-blue-950/30 border-b border-blue-900/40 flex items-center justify-between text-xs text-blue-300">
                <span className="font-semibold">
                  Secondary: {splitServer.name}
                </span>
                <span className="font-mono text-[11px] text-blue-400/80">
                  {splitServer.type === "embed" ? getEmbedUrl(splitServer) : "Direct HLS Stream"}
                </span>
              </div>

              <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                {splitServer.type === "direct" ? (
                  directLoading ? (
                    <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                  ) : directStream ? (
                    <VideoJSPlayer
                      src={directStream}
                      type="application/x-mpegURL"
                      autoplay={true}
                      controls={true}
                      className="w-full h-full"
                    />
                  ) : (
                    <p className="text-xs text-zinc-500">Direct CDN Unavailable</p>
                  )
                ) : (
                  <iframe
                    key={`split-${splitServer.id}-${mediaType}-${tmdbId}-${imdbId}-${season}-${episode}-${strictSandbox}-${idPreference}`}
                    src={getEmbedUrl(splitServer)}
                    className="w-full h-full border-0"
                    allowFullScreen
                    sandbox={sandboxAttributes}
                    referrerPolicy="origin"
                  />
                )}
              </div>

              <div className="p-3 bg-zinc-950/60 border-t border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
                <span>{splitServer.notes}</span>
                <a
                  href={getEmbedUrl(splitServer)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Server Comparison Matrix Table */}
        <section className="bg-[#12131b] border border-zinc-800 rounded-2xl p-5 mt-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Server Specifications & Sandbox Compatibility
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Comparison of candidate streaming servers, ad behaviors, and ID routing.
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Total {allServers.length} Servers Available
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="py-2.5 px-3">Server</th>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">ID Support</th>
                  <th className="py-2.5 px-3">Ad Status</th>
                  <th className="py-2.5 px-3">Protocol</th>
                  <th className="py-2.5 px-3">Features & Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {allServers.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-zinc-800/30 transition-colors ${
                      activeServerId === s.id ? "bg-red-950/15" : ""
                    }`}
                  >
                    <td className="py-3 px-3 font-sans font-semibold text-white">
                      {s.name}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">{s.domain}</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        {s.idSupport === "both" ? "TMDb & IMDb" : s.idSupport.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-sans text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded">
                        {s.ads}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[11px] font-sans px-2 py-0.5 rounded ${
                          s.type === "direct"
                            ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {s.type === "direct" ? "Direct HLS (.m3u8)" : "Sandboxed Embed"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-zinc-400 text-xs">
                      {s.notes}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setActiveServerId(s.id)}
                        className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-all ${
                          activeServerId === s.id
                            ? "bg-red-600 text-white"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {activeServerId === s.id ? "Active" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal: Custom Server Configuration */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14151f] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Configure Custom Server</h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Test any third-party streaming server embed URL. Use variables like{" "}
              <code className="text-red-400 font-mono">{"{id}"}</code>,{" "}
              <code className="text-red-400 font-mono">{"{tmdbId}"}</code>,{" "}
              <code className="text-red-400 font-mono">{"{imdbId}"}</code>,{" "}
              <code className="text-red-400 font-mono">{"{type}"}</code>,{" "}
              <code className="text-red-400 font-mono">{"{s}"}</code>, and{" "}
              <code className="text-red-400 font-mono">{"{e}"}</code>.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-zinc-300 block mb-1">Server Name</label>
                <input
                  type="text"
                  value={customServerName}
                  onChange={(e) => setCustomServerName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500"
                  placeholder="e.g. My Test Mirror"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1">URL Template</label>
                <input
                  type="text"
                  value={customServerTemplate}
                  onChange={(e) => setCustomServerTemplate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-red-500"
                  placeholder="https://example.com/embed/{id}"
                />
              </div>

              <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800/80 text-xs font-mono text-zinc-400">
                <span className="text-zinc-500 block mb-1">Live Rendered Preview:</span>
                <span className="text-emerald-400 break-all">
                  {customServerTemplate
                    .replace(/{id}/g, idPreference === "imdb" && imdbId ? imdbId : tmdbId)
                    .replace(/{tmdbId}/g, tmdbId)
                    .replace(/{imdbId}/g, imdbId || tmdbId)
                    .replace(/{type}/g, mediaType)
                    .replace(/{s}/g, season)
                    .replace(/{season}/g, season)
                    .replace(/{e}/g, episode)
                    .replace(/{episode}/g, episode)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setActiveServerId("custom-tester");
                  setShowCustomModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
              >
                Apply & Test Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
