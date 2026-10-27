"use client";

import { useState, useEffect } from "react";
import { Tv, Play, Search, Zap, RefreshCw, Radio } from "lucide-react";
import { VideoJSPlayer } from "./VideoJSPlayer";
import type { LiveChannel, LiveChannelServer } from "@/lib/livetv";

interface LiveTVPlayerProps {
  initialChannels: LiveChannel[];
}

export function LiveTVPlayer({ initialChannels }: LiveTVPlayerProps) {
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(initialChannels[0] || null);
  const [servers, setServers] = useState<LiveChannelServer[]>([]);
  const [activeServer, setActiveServer] = useState<LiveChannelServer | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [playerError, setPlayerError] = useState(false);

  // Fetch direct playable HLS stream for selected channel
  useEffect(() => {
    if (!selectedChannel) return;

    let isMounted = true;
    setLoadingStream(true);
    setPlayerError(false);

    fetch(`https://livetgtv.lovable.app/api/public/v2/channels/${selectedChannel.id}`)
      .then((res) => res.json())
      .then((data: { servers?: LiveChannelServer[] }) => {
        if (!isMounted) return;
        const availableServers = data.servers || [];
        setServers(availableServers);
        setActiveServer(availableServers[0] || null);
        setLoadingStream(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[Live TV stream resolve failed, falling back]", err);
        setServers([]);
        setActiveServer(null);
        setLoadingStream(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedChannel]);

  const filteredChannels = initialChannels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Main Live Player Screen */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
          {activeServer?.playable && !playerError ? (
            <VideoJSPlayer
              key={`live-${selectedChannel?.id}-${activeServer.key}`}
              src={activeServer.playable}
              type={activeServer.type === "hls" ? "application/x-mpegURL" : "video/mp4"}
              autoplay={true}
              controls={true}
              onError={() => setPlayerError(true)}
            />
          ) : selectedChannel?.embed && (playerError || !loadingStream) ? (
            <iframe
              key={`live-embed-${selectedChannel.id}`}
              src={selectedChannel.embed}
              title={selectedChannel.name}
              className="h-full w-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <Radio className="mx-auto h-10 w-10 text-emerald-400 animate-pulse" />
                <p className="mt-3 text-sm text-neutral-300">
                  {loadingStream ? "Tuning into direct HLS live broadcast…" : "Select a channel below to watch"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Channel Info & Active Servers */}
        {selectedChannel && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div>
                <h2 className="text-sm font-bold text-white">{selectedChannel.name}</h2>
                <p className="text-[11px] text-neutral-400">
                  {activeServer ? "Direct CDN Broadcast (Video.js)" : "Live Feed"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {servers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-400">Feed:</span>
                  {servers.map((srv) => (
                    <button
                      key={srv.key}
                      onClick={() => {
                        setActiveServer(srv);
                        setPlayerError(false);
                      }}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        activeServer?.key === srv.key
                          ? "bg-emerald-600 text-white"
                          : "bg-white/10 text-neutral-300 hover:bg-white/20"
                      }`}
                    >
                      {srv.label}
                    </button>
                  ))}
                </div>
              )}
              {activeServer?.playable && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  <Zap className="h-3 w-3" /> Video.js Direct
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Channel Guide / Selector */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Live Channels Guide</h2>
            <span className="text-xs text-neutral-400">({initialChannels.length} Channels)</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 max-h-[500px] overflow-y-auto pr-1">
          {filteredChannels.slice(0, 120).map((ch) => {
            const isCurrent = selectedChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => {
                  setSelectedChannel(ch);
                  setPlayerError(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  isCurrent
                    ? "border-emerald-500/80 bg-emerald-500/15 shadow-lg shadow-emerald-500/10"
                    : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">LIVE</span>
                  </span>
                  {isCurrent && <Play className="h-3 w-3 text-emerald-400 fill-emerald-400" />}
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-white">{ch.name}</p>
                <p className="mt-1 text-[10px] text-neutral-400">{isCurrent ? "Now Playing" : "Watch ↗"}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LiveTVPlayer;
