"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Play, Search, Radio, ChevronDown, ArrowLeft, X, ExternalLink, Sparkles } from "lucide-react";
import type { LiveChannel } from "@/lib/livetv";
import { getLiveEmbedUrl } from "@/lib/livetv";

interface LiveTVPlayerProps {
  initialChannels: LiveChannel[];
  initialVersion?: "v1" | "v2";
}

export function LiveTVPlayer({ initialChannels, initialVersion = "v1" }: LiveTVPlayerProps) {
  const [version, setVersion] = useState<"v1" | "v2">(initialVersion);
  const [channels, setChannels] = useState<LiveChannel[]>(initialChannels);
  const [loadingGuide, setLoadingGuide] = useState<boolean>(false);
  const [guideError, setGuideError] = useState<boolean>(false);

  // Active playing channel
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(initialChannels[0] || null);

  // Search & category filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All channels");
  const [visibleCount, setVisibleCount] = useState<number>(48);

  const playerRef = useRef<HTMLDivElement>(null);

  // Fetch channels whenever version (India v1 vs 24/7 v2) changes
  useEffect(() => {
    let isCancelled = false;
    setLoadingGuide(true);
    setGuideError(false);

    fetch(`/api/livetv/channels?version=${version}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.ok && Array.isArray(data.channels) && data.channels.length > 0) {
          setChannels(data.channels);
          // If no channel selected or current channel belongs to other directory, pick first
          setSelectedChannel((prev) => {
            if (!prev) return data.channels[0];
            const exists = data.channels.some((c: LiveChannel) => c.id === prev.id);
            return exists ? prev : data.channels[0];
          });
        }
      })
      .catch(() => {
        if (!isCancelled) setGuideError(true);
      })
      .finally(() => {
        if (!isCancelled) setLoadingGuide(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [version]);

  // Extract unique categories (for India v1)
  const categories = useMemo(() => {
    if (version === "v2") return ["All channels"];
    const cats = Array.from(new Set(channels.map((c) => c.category).filter(Boolean))) as string[];
    return ["All channels", ...cats.sort()];
  }, [channels, version]);

  // Filter channels by search and category
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesCategory = selectedCategory === "All channels" || c.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [channels, searchQuery, selectedCategory]);

  const handleSelectChannel = (channel: LiveChannel) => {
    setSelectedChannel(channel);
    // Smooth scroll to player on mobile
    if (playerRef.current && window.innerWidth < 1024) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeEmbedUrl = selectedChannel ? getLiveEmbedUrl(selectedChannel.id, version) : "";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Active Live Stream Player ── */}
      {selectedChannel && (
        <div ref={playerRef} className="flex flex-col gap-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#05070b] shadow-2xl">
            <iframe
              key={`live-${version}-${selectedChannel.id}`}
              src={activeEmbedUrl}
              title={`${selectedChannel.name} Live Broadcast`}
              className="h-full w-full border-0 bg-black"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
            {/* Corner Live Badge */}
            <div className="screen-corner-label">
              <span className="live-indicator" />
              <span>AETHOFLIX LIVE</span>
            </div>
          </div>

          {/* Active Channel Details Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
            <div className="flex items-center gap-3">
              {selectedChannel.logo ? (
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white p-1">
                  <img
                    src={selectedChannel.logo}
                    alt={selectedChannel.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 font-bold text-cyan-300 text-xs">
                  {selectedChannel.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-300 uppercase">
                    {selectedChannel.category || (version === "v1" ? "India TV" : "24 / 7")}
                  </span>
                  <span className="text-[10px] text-neutral-400">● LIVE BROADCAST</span>
                </div>
                <h2 className="text-base font-bold text-white tracking-tight">{selectedChannel.name}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeEmbedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="theatre-action"
              >
                <span>Full screen window</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Version Switcher (India Channels vs 24/7 Mix) ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
        <div>
          <div className="section-overline">
            <span className="live-indicator" />
            <span>CHANNEL DIRECTORY</span>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-white mt-1">Browse Live Channels</h3>
        </div>

        {/* Directory switcher buttons */}
        <div className="live-version-switch">
          <button
            type="button"
            className={version === "v1" ? "mode-active" : ""}
            onClick={() => {
              setVersion("v1");
              setSelectedCategory("All channels");
              setVisibleCount(48);
            }}
          >
            🇮🇳 India channels ({channels.length > 0 && version === "v1" ? channels.length : "1,200+"})
          </button>
          <button
            type="button"
            className={version === "v2" ? "mode-active" : ""}
            onClick={() => {
              setVersion("v2");
              setSelectedCategory("All channels");
              setVisibleCount(48);
            }}
          >
            🌐 24 / 7 mix
          </button>
        </div>
      </div>

      {/* ── Search & Filter Tools ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(48);
              }}
              placeholder="Find a channel (e.g. Colors, Star, Zee, Aaj Tak, Sony)..."
              className="w-full rounded-xl border border-white/10 bg-neutral-900/60 pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-cyan-500/50 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-neutral-400">
            {loadingGuide ? "Updating guide..." : `${filteredChannels.length} channels available`}
          </span>
        </div>

        {/* ── Category Filter Pills (For India Channels) ── */}
        {version === "v1" && categories.length > 1 && (
          <div className="live-categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={selectedCategory === cat ? "category-active" : ""}
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(48);
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Channel Grid ── */}
      {loadingGuide ? (
        <div className="flex h-48 w-full items-center justify-center rounded-xl border border-white/5 bg-neutral-900/30 text-xs text-neutral-400">
          Loading {version === "v1" ? "India channels" : "24 / 7 channels"}...
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-neutral-900/20 py-16 text-center">
          <Search className="h-6 w-6 text-neutral-500 mb-2" />
          <strong className="text-sm text-neutral-300">No channels match that search</strong>
          <p className="text-xs text-neutral-500 mt-1">Try searching another channel name or category.</p>
        </div>
      ) : (
        <div className="channel-grid">
          {filteredChannels.slice(0, visibleCount).map((channel) => {
            const isPlaying = selectedChannel?.id === channel.id;
            return (
              <button
                key={`${version}-${channel.id}`}
                type="button"
                onClick={() => handleSelectChannel(channel)}
                className={`channel-tile group ${isPlaying ? "border-cyan-500/50 bg-cyan-950/20 shadow-md" : ""}`}
              >
                <span className="channel-logo">
                  {channel.logo ? (
                    <img src={channel.logo} alt={channel.name} loading="lazy" />
                  ) : (
                    <span>{channel.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>

                <span className="channel-tile-copy">
                  <strong className={isPlaying ? "text-cyan-200" : "text-neutral-200"}>
                    {channel.name}
                  </strong>
                  <small>{channel.category || (version === "v1" ? "India Channel" : "24 / 7")}</small>
                </span>

                <span className="channel-watch">
                  {isPlaying ? (
                    <span className="live-indicator" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current text-cyan-300 opacity-60 group-hover:opacity-100" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Load More Button ── */}
      {!loadingGuide && filteredChannels.length > visibleCount && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 48)}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-xs font-semibold text-neutral-200 hover:bg-white/10 hover:text-white transition-all shadow-md"
          >
            <span>Load more channels ({filteredChannels.length - visibleCount} remaining)</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attribution Note */}
      <p className="text-center text-[10px] text-neutral-500 pb-6">
        Live channel listings and streams are provided by the public TG TV channel guide.
      </p>
    </div>
  );
}

export default LiveTVPlayer;
