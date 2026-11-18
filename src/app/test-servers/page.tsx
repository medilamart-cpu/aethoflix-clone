"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Film,
  Tv,
  Play,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
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
  buildUrl: (mediaType: "movie" | "tv", tmdbId: string, s?: string, e?: string) => string;
}

const PRESET_MOVIES = [
  { id: "550", title: "Fight Club (1999)" },
  { id: "157336", title: "Interstellar (2014)" },
  { id: "155", title: "The Dark Knight (2008)" },
  { id: "27205", title: "Inception (2010)" },
  { id: "693134", title: "Dune: Part Two (2024)" },
];

const PRESET_SERIES = [
  { id: "1399", title: "Game of Thrones", s: "1", e: "1" },
  { id: "1396", title: "Breaking Bad", s: "1", e: "1" },
  { id: "66732", title: "Stranger Things", s: "1", e: "1" },
  { id: "100088", title: "The Last of Us", s: "1", e: "1" },
  { id: "84958", title: "Loki", s: "1", e: "1" },
];

const SERVERS: ServerSpec[] = [
  {
    id: "server-multihd",
    name: "Server 2 (Multi HD)",
    domain: "nxsha.space",
    ads: "Low (Sandbox Protected)",
    free: "Yes (Multi-Lang Audio)",
    notes: "Multi-Language audio streams with 1080p high bitrate playback via AwsPly.",
    type: "embed",
    buildUrl: (id, s, e) =>
      s && e
        ? `https://nxsha.space/embed/tv/${id}/${s}/${e}?server=AwsPly-[Multi-Lang]`
        : `https://nxsha.space/embed/movie/${id}?server=AwsPly-[Multi-Lang]`,
  },
  {
    id: "direct-recloud",
    name: "Direct CDN (ReCloud Anime)",
    domain: "cdn.4animo.xyz",
    ads: "Zero (Raw HLS Stream)",
    free: "Yes (No ads, soft subs)",
    notes: "Direct HLS anime stream extracted from NovusCloud/4animo inside Video.js.",
    type: "direct",
    buildUrl: () => "",
  },
  {
    id: "direct-cdn",
    name: "Direct CDN (VidSync)",
    domain: "vidsync-shard.workers.dev",
    ads: "Zero (Raw HLS Stream)",
    free: "Yes (No ads, 0 popups)",
    notes: "Direct .m3u8 HLS chunk streaming inside native Video.js player with custom CleanStream skin.",
    type: "direct",
    buildUrl: () => "",
  },
  {
    id: "embedwave",
    name: "EmbedWave",
    domain: "embedwave.cc",
    ads: "Zero, by design",
    free: "Yes, no signup",
    notes: "Drop-in VidSrc replacement — identical /embed/ URL shape, multi-server switcher, ?nobrand=true param.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://embedwave.cc/embed/tv/${id}/${s}/${e}?nobrand=true`
        : `https://embedwave.cc/embed/movie/${id}?nobrand=true`,
  },
  {
    id: "vidcore",
    name: "VidCore",
    domain: "vidcore.org",
    ads: "Zero popups/banners",
    free: "Yes, no key required",
    notes: "4K/HLS support, subtitle tracks, postMessage events, clean dark player.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://vidcore.org/embed/tv/${id}/${s}/${e}`
        : `https://vidcore.org/embed/movie/${id}`,
  },
  {
    id: "vidnest",
    name: "VidNest",
    domain: "vidnest.pro",
    ads: "No injected ads",
    free: "Yes, no account",
    notes: "IMDb + TMDB IDs, resume/quality memory, public catalog API and postMessage watch hooks.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://vidnest.pro/tv/${id}/${s}/${e}`
        : `https://vidnest.pro/movie/${id}`,
  },
  {
    id: "vidlink",
    name: "VidLink",
    domain: "vidlink.pro",
    ads: "Minimal / Clean",
    free: "Yes",
    notes: "High speed multi-CDN embed with auto-play and multi-language subtitle tracks.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true`
        : `https://vidlink.pro/movie/${id}?autoplay=true`,
  },
  {
    id: "zxcstream",
    name: "ZXCStream",
    domain: "zxcstream.cc",
    ads: "Low ad load",
    free: "Yes",
    notes: "Alternative resilient fallback mirror supporting TV and movies with fast initial handshake.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://zxcstream.cc/player/tv/${id}?season=${s}&episode=${e}`
        : `https://zxcstream.cc/player/movie/${id}`,
  },
  {
    id: "videasy",
    name: "Videasy",
    domain: "player.videasy.to",
    ads: "Zero popups",
    free: "Yes",
    notes: "Modern clean iframe player with multiple sources and subtitle selectors.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://player.videasy.to/tv/${id}/${s}/${e}`
        : `https://player.videasy.to/movie/${id}`,
  },
  {
    id: "vidfast",
    name: "VidFast",
    domain: "vidfast.vc",
    ads: "Standard",
    free: "Yes",
    notes: "Fast caching server with autoplay support.",
    type: "embed",
    buildUrl: (type, id, s = "1", e = "1") =>
      type === "tv"
        ? `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true`
        : `https://vidfast.vc/movie/${id}?autoPlay=true`,
  },
];

export default function TestServersPage() {
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [tmdbId, setTmdbId] = useState("550");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [activeServerId, setActiveServerId] = useState("direct-theog");
  const [splitServerId, setSplitServerId] = useState<string | null>("embedwave");
  const [isSplitView, setIsSplitView] = useState(false);
  const [strictSandbox, setStrictSandbox] = useState(true);

  // Direct CDN state
  const [directLoading, setDirectLoading] = useState(false);
  const [directStream, setDirectStream] = useState<string | null>(null);
  const [directDetails, setDirectDetails] = useState<any>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Latency & status benchmark
  const [serverLatencies, setServerLatencies] = useState<Record<string, { ms: number; ok: boolean } | null>>({});
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Fetch Direct CDN stream when media changes
  const resolveDirectCdn = useCallback(async () => {
    setDirectLoading(true);
    setDirectError(null);
    setDirectStream(null);
    setDirectDetails(null);

    try {
      let endpoint = `/api/resolve-tg?type=${mediaType}&id=${tmdbId}&s=${season}&e=${episode}`;
      if (activeServerId === "direct-theog") {
        endpoint = `/api/resolve-theog?type=${mediaType}&id=${tmdbId}&s=${season}&e=${episode}`;
      } else if (activeServerId === "direct-recloud") {
        endpoint = `/api/resolve-recloud?id=${tmdbId}&e=${episode}`;
      }

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
  }, [mediaType, tmdbId, season, episode, activeServerId]);

  useEffect(() => {
    resolveDirectCdn();
  }, [resolveDirectCdn]);

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

  const activeServer = SERVERS.find((s) => s.id === activeServerId) || SERVERS[0];
  const splitServer = SERVERS.find((s) => s.id === splitServerId) || SERVERS[1];

  const getEmbedUrl = (spec: ServerSpec) => spec.buildUrl(mediaType, tmdbId, season, episode);

  const sandboxAttributes = strictSandbox
    ? "allow-scripts allow-same-origin allow-forms"
    : "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation";

  return (
    <div className="min-h-screen bg-[#0c0d12] text-zinc-100 flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
      {/* Top Navigation Bar */}
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
              Streaming Lab & Server Tester
            </h1>
            <span className="text-xs bg-red-950/80 text-red-400 border border-red-800/50 px-2 py-0.5 rounded font-mono font-medium">
              Zero-Ad Lab
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
            <span>{isSplitView ? "Single Focus View" : "Side-by-Side Dual View"}</span>
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

      {/* Media & Parameter Controls */}
      <section className="bg-[#14151f] border-b border-zinc-800/80 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Movie / TV Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg bg-zinc-900/90 p-1 border border-zinc-800">
              <button
                onClick={() => {
                  setMediaType("movie");
                  setTmdbId("550");
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
                  setTmdbId("1399");
                  setSeason("1");
                  setEpisode("1");
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

            {/* TMDB ID Input */}
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-mono text-zinc-400 font-medium uppercase">TMDB ID</span>
              <input
                type="text"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value.trim())}
                placeholder="e.g. 550"
                className="w-20 bg-transparent text-xs font-mono text-white outline-none focus:text-red-400"
              />
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
            {(mediaType === "movie" ? PRESET_MOVIES : PRESET_SERIES).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTmdbId(item.id);
                  const seriesItem = item as { id: string; title: string; s?: string; e?: string };
                  if (seriesItem.s) {
                    setSeason(seriesItem.s);
                  }
                  if (seriesItem.e) {
                    setEpisode(seriesItem.e);
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  tmdbId === item.id
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Server Selection Cards Grid */}
      <section className="px-4 lg:px-8 py-3.5 bg-[#0f1017] border-b border-zinc-800/80 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-2.5 min-w-max">
          {SERVERS.map((server) => {
            const isSelected = activeServerId === server.id;
            const isSplitSelected = isSplitView && splitServerId === server.id;
            const latencyData = serverLatencies[server.id];

            return (
              <div
                key={server.id}
                onClick={() => {
                  if (isSplitView && activeServerId === server.id) {
                    // don't toggle if same
                  } else {
                    setActiveServerId(server.id);
                  }
                }}
                className={`relative flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all min-w-[190px] ${
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
                  <span className="truncate max-w-[110px]">{server.domain}</span>
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

      {/* Main Player Display Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-6 flex flex-col gap-6">
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
              <>
                <button
                  onClick={() => setStrictSandbox(!strictSandbox)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded border transition-all ${
                    strictSandbox
                      ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                      : "bg-amber-950/60 border-amber-700/60 text-amber-300"
                  }`}
                  title={
                    strictSandbox
                      ? "Strict sandbox blocks popups, tabs and external redirects"
                      : "Permissive mode allows player popups"
                  }
                >
                  {strictSandbox ? "Strict Sandbox (Anti-Ad)" : "Permissive Sandbox"}
                </button>
                <a
                  href={getEmbedUrl(activeServer)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded border border-zinc-700 transition-colors"
                >
                  <span>Direct URL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
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
              <span className="font-mono text-[11px] text-zinc-500">
                {mediaType === "movie" ? `Movie #${tmdbId}` : `Series #${tmdbId} S${season}E${episode}`}
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
                      onClick={() => setActiveServerId("embedwave")}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                    >
                      Switch to EmbedWave (Zero Ads)
                    </button>
                  </div>
                )
              ) : (
                <iframe
                  key={`${activeServer.id}-${mediaType}-${tmdbId}-${season}-${episode}-${strictSandbox}`}
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
                  {mediaType === "movie" ? `Movie #${tmdbId}` : `Series #${tmdbId} S${season}E${episode}`}
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
                    key={`split-${splitServer.id}-${mediaType}-${tmdbId}-${season}-${episode}`}
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
                Server Specifications & Zero-Ad Policies
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Detailed comparison of the new zero-ad candidates and existing AethoFlix servers.
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Total {SERVERS.length} Servers Available
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="py-2.5 px-3">Server</th>
                  <th className="py-2.5 px-3">Domain</th>
                  <th className="py-2.5 px-3">Ad Status</th>
                  <th className="py-2.5 px-3">Protocol</th>
                  <th className="py-2.5 px-3">Features & Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {SERVERS.map((s) => (
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
    </div>
  );
}

