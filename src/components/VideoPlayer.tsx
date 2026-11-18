"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, RefreshCw, ShieldCheck, ShieldAlert, Zap, X } from "lucide-react";
import { MirrorPicker } from "./MirrorPicker";
import { WatchGate } from "./WatchGate";
import { isWatchGateEnabled } from "@/lib/watchgate";
import { VideoJSPlayer } from "./VideoJSPlayer";
import { DirectStreamLoader } from "./DirectStreamLoader";
import { VlcButton } from "./VlcButton";
import { raceCandidateMirrors } from "@/lib/serverRacer";
import { isProviderSandboxCompatible } from "@/lib/providers";

export interface DirectStreamItem {
  url: string;
  label: string;
  subtitles?: any[];
  audio?: any;
  quality?: string;
  qualities?: Array<{ quality: string; url: string }>;
  audioTracks?: Array<{ language: string; label: string; url: string }>;
}

interface VideoPlayerProps {
  routingKey: string; // "movie:1400940"
  routingTitle: string;
  mirrors: Record<string, string>;
  adPartnerUrl1?: string;
  adPartnerUrl2?: string;
  poster?: string;
  imdbId?: string;
}

export function VideoPlayer({
  routingKey,
  routingTitle,
  mirrors,
  adPartnerUrl1,
  adPartnerUrl2,
  poster,
  imdbId,
}: VideoPlayerProps) {
  const [gateOpen, setGateOpen] = useState(isWatchGateEnabled());
  const [gateVerified, setGateVerified] = useState(!isWatchGateEnabled());

  // Cached server state check (0ms instant paint for returning visits)
  const initialCache = useMemo(() => {
    if (typeof window === "undefined" || !routingKey) return null;
    try {
      const raw = sessionStorage.getItem(`aethoflix_final_servers_${routingKey}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [routingKey]);

  const defaultInitialMirror = useMemo(() => {
    if (initialCache?.selectedMirror) return initialCache.selectedMirror;
    if (routingKey.startsWith("anime:")) {
      return "Direct CDN (ReCloud)";
    }
    return "Direct CDN (VidSync)";
  }, [initialCache, routingKey]);

  const [directStreams, setDirectStreams] = useState<Array<DirectStreamItem>>(
    initialCache?.directStreams ?? (initialCache?.directStream ? [initialCache.directStream] : [])
  );
  const [verifiedServers, setVerifiedServers] = useState<Array<{ label: string; url: string; latency: number }> | null>(
    initialCache?.verifiedServers ?? null
  );
  const [latencies, setLatencies] = useState<Record<string, number>>(initialCache?.latencies ?? {});
  const [fastestLabel, setFastestLabel] = useState<string | null>(initialCache?.verifiedServers?.[0]?.label ?? null);
  const [isFinalized, setIsFinalized] = useState<boolean>(!!initialCache);
  const [selectedMirror, setSelectedMirror] = useState<string | null>(defaultInitialMirror);
  const [failedDirects, setFailedDirects] = useState<Set<string>>(new Set());
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<string | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState<boolean>(true);
  const [showDirectLoader, setShowDirectLoader] = useState<boolean>(true);
  const userInteractedRef = useRef(false);

  const directStreamsRef = useRef(directStreams);
  directStreamsRef.current = directStreams;
  const verifiedServersRef = useRef(verifiedServers);
  verifiedServersRef.current = verifiedServers;
  const selectedMirrorRef = useRef(selectedMirror);
  selectedMirrorRef.current = selectedMirror;

  const handleFirstFrame = useCallback(() => {
    setIsDirectLoading(false);
    setTimeout(() => {
      setShowDirectLoader(false);
    }, 320);
  }, []);

  // Reset stream states immediately whenever the routingKey changes (new movie/episode)
  useEffect(() => {
    setDirectStreams([]);
    setFailedDirects(new Set());
    setSelectedMirror(defaultInitialMirror);
    setIframeError(false);
    setIsDirectLoading(true);
    setShowDirectLoader(true);
    userInteractedRef.current = false;
  }, [routingKey, defaultInitialMirror]);

  // Single-pass server verification and ranking
  useEffect(() => {
    if (!routingKey) return;

    const parts = routingKey.split(":");
    const type = parts[0];
    const id = parts[1];
    const s = parts[2] || "1";
    const e = parts[3] || "1";

    let isMounted = true;
    setIsFinalized(false);

    // Direct stream resolution endpoints (TheOGPirateBot, ReCloud, VidSync)
    const directTheOgUrl =
      type === "movie" || type === "tv"
        ? `/api/resolve-theog?type=${type}&id=${id}&s=${s}&e=${e}`
        : "";

    const directAnimeUrl =
      type === "anime" ? `/api/resolve-recloud?id=${id}&s=${s}&e=${e}` : "";

    const directTgUrl =
      type === "movie" || type === "tv"
        ? `/api/resolve-tg?type=${type}&id=${id}${imdbId ? `&imdb=${encodeURIComponent(imdbId)}` : ""}${routingTitle ? `&title=${encodeURIComponent(routingTitle)}` : ""}&s=${s}&e=${e}`
        : "";

    const checkServersUrl = `/api/check-servers?type=${type}&id=${id}&s=${s}&e=${e}`;

    // Helper: Mark direct stream as unavailable / not in database and auto-failover immediately
    const markDirectFailed = (failedLabel: string) => {
      if (!isMounted) return;
      setFailedDirects((prev) => {
        const next = new Set(prev);
        next.add(failedLabel);
        return next;
      });

      if (selectedMirrorRef.current === failedLabel) {
        // 1. Try other resolved direct stream first
        const altDirect = directStreamsRef.current.find(
          (d) => d.label !== failedLabel && d.url && !d.url.startsWith("direct:pending:")
        );
        if (altDirect) {
          setSelectedMirror(altDirect.label);
          return;
        }

        // 2. Otherwise auto-failover to available embed server
        setIsDirectLoading(false);
        setShowDirectLoader(false);

        const availableEmbed = verifiedServersRef.current?.find(
          (srv) => srv.label && srv.label !== failedLabel
        );
        if (availableEmbed) {
          setSelectedMirror(availableEmbed.label);
        } else {
          setSelectedMirror("Multi HD (EmbedWave)");
        }
      }
    };

    // Fast-path helper: immediately mounts and activates the direct stream the exact ms it resolves
    const registerDirectStream = (stream: DirectStreamItem, isPrimary: boolean) => {
      if (!isMounted) return;
      setFailedDirects((prev) => {
        const next = new Set(prev);
        next.delete(stream.label);
        return next;
      });
      setDirectStreams((prev) => {
        const next = prev.filter((d) => d.label !== stream.label);
        const updated = [...next, stream];
        try {
          sessionStorage.setItem(
            `aethoflix_final_servers_${routingKey}`,
            JSON.stringify({
              directStreams: updated,
              selectedMirror: isPrimary ? stream.label : (selectedMirrorRef.current || stream.label),
            })
          );
        } catch {}
        return updated;
      });

      if (!userInteractedRef.current && isPrimary) {
        setSelectedMirror(stream.label);
      }
    };

    // 1. Instant Direct Stream 1: VidSync (Primary Server 1)
    if (directTgUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        markDirectFailed("Direct CDN (VidSync)");
      }, 10000);

      fetch(directTgUrl, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Unavailable");
          return r.json();
        })
        .then((res) => {
          clearTimeout(timer);
          if (res?.ok && res?.playable) {
            registerDirectStream(
              {
                url: res.playable,
                label: "Direct CDN (VidSync)",
                subtitles: res.subtitles || [],
                audio: res.audio || "en",
                quality: res.quality || "Auto",
                qualities: res.qualities || [],
                audioTracks: res.audioTracks || [],
              },
              true
            );
          } else {
            markDirectFailed("Direct CDN (VidSync)");
          }
        })
        .catch(() => {
          clearTimeout(timer);
          markDirectFailed("Direct CDN (VidSync)");
        });
    }

    // 2. Instant Direct Stream 2: TheOGPirateBot (Server 2)
    if (directTheOgUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        markDirectFailed("Direct CDN (TheOGPirateBot)");
      }, 3500);

      fetch(directTheOgUrl, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Unavailable");
          return r.json();
        })
        .then((res) => {
          clearTimeout(timer);
          if (res?.ok && res?.playable) {
            registerDirectStream(
              {
                url: res.playable,
                label: "Direct CDN (TheOGPirateBot)",
                subtitles: res.subtitles || [],
                audio: res.audio || ["en"],
                quality: res.quality || "auto",
              },
              false
            );
          } else {
            markDirectFailed("Direct CDN (TheOGPirateBot)");
          }
        })
        .catch(() => {
          clearTimeout(timer);
          markDirectFailed("Direct CDN (TheOGPirateBot)");
        });
    }

    // 3. Instant Direct Stream Anime: ReCloud
    if (directAnimeUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        markDirectFailed("Direct CDN (ReCloud)");
      }, 3500);

      fetch(directAnimeUrl, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error("Unavailable");
          return r.json();
        })
        .then((res) => {
          clearTimeout(timer);
          if (res?.ok && res?.playable) {
            registerDirectStream(
              {
                url: res.playable,
                label: "Direct CDN (ReCloud)",
                subtitles: res.tracks || [],
              },
              true
            );
          } else {
            markDirectFailed("Direct CDN (ReCloud)");
          }
        })
        .catch(() => {
          clearTimeout(timer);
          markDirectFailed("Direct CDN (ReCloud)");
        });
    }

    // 4. Background Server Verification: Probes external embeds silently without stalling playback!
    fetch(checkServersUrl)
      .then((r) => r.json())
      .then((checkRes) => {
        if (!isMounted) return;

        let foundServers: Array<{ label: string; url: string; latency: number }> = [];
        const latMap: Record<string, number> = {};

        if (checkRes?.ok && checkRes?.servers?.length) {
          foundServers = checkRes.servers;
          for (const srv of foundServers) {
            latMap[srv.label] = srv.latency;
          }
        } else {
          for (const [lbl, u] of Object.entries(mirrors)) {
            foundServers.push({ label: lbl, url: u, latency: 150 });
          }
        }

        setVerifiedServers(foundServers);
        setLatencies(latMap);
        if (foundServers[0]?.label) setFastestLabel(foundServers[0].label);
        setIsFinalized(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsFinalized(true);
      });

    return () => {
      isMounted = false;
    };
  }, [routingKey, initialCache, mirrors, imdbId]);

  // Clean verified mirrors dictionary
  const cleanMirrors: Record<string, string> = useMemo(() => {
    if (verifiedServers && verifiedServers.length > 0) {
      const res: Record<string, string> = {};
      for (const srv of verifiedServers) {
        res[srv.label] = srv.url;
      }
      return res;
    }
    return mirrors;
  }, [verifiedServers, mirrors]);

  // Combine direct streams (VidSync, TheOGPirateBot, ReCloud) with verified embed mirrors
  const allMirrors: Record<string, string> = useMemo(() => {
    const res: Record<string, string> = {};

    // 1. Direct CDN 1 (VidSync for Movies/TV, ReCloud for Anime) - PRIMARY DEFAULT
    if (routingKey.startsWith("anime:")) {
      const recloudDirect = directStreams.find((d) => d.label.includes("ReCloud"));
      res["Direct CDN (ReCloud)"] = recloudDirect ? recloudDirect.url : "direct:pending:recloud";
    } else {
      const vidSyncDirect = directStreams.find((d) => d.label.includes("VidSync"));
      res["Direct CDN (VidSync)"] = vidSyncDirect ? vidSyncDirect.url : "direct:pending:vidsync";
    }

    // 2. Server 2: TheOGPirateBot (OGPirate)
    const theOgDirect = directStreams.find((d) => d.label.includes("TheOG"));
    if (routingKey.startsWith("movie:") || routingKey.startsWith("tv:")) {
      res["Direct CDN (TheOGPirateBot)"] = theOgDirect ? theOgDirect.url : "direct:pending:theog";
    }

    // 3. Server 3: Multi HD (EmbedWave / Nxsha with Multi-Lang Audio & 1080p)
    const parts = routingKey.split(":");
    const type = parts[0];
    const id = parts[1];
    const s = parts[2] || "1";
    const e = parts[3] || "1";
    if (type === "movie") {
      res["Multi HD (EmbedWave)"] = `https://nxsha.space/embed/movie/${id}?server=AwsPly-[Multi-Lang]`;
    } else if (type === "tv") {
      res["Multi HD (EmbedWave)"] = `https://nxsha.space/embed/tv/${id}/${s}/${e}?server=AwsPly-[Multi-Lang]`;
    }

    // 4. Other clean mirrors (VidLink, VidFast, VidNest...)
    for (const [key, val] of Object.entries(cleanMirrors)) {
      if (key.toLowerCase().includes("theog") || val.includes("theogpiratebot")) continue;
      if (key.toLowerCase().includes("recloud") || val.includes("4animo")) continue;
      if (
        key.toLowerCase().includes("embedwave") ||
        val.includes("embedwave.cc") ||
        key.toLowerCase().includes("multi") ||
        val.includes("nxsha")
      ) {
        continue;
      }
      res[key] = val;
    }

    return res;
  }, [directStreams, cleanMirrors, routingKey, failedDirects]);

  const mirrorKeys = useMemo(() => Object.keys(allMirrors), [allMirrors]);
  const [iframeError, setIframeError] = useState(false);
  const [adShieldActive, setAdShieldActive] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Background health monitor
  useEffect(() => {
    if (!isFinalized || Object.keys(cleanMirrors).length === 0) return;

    const cancel = raceCandidateMirrors(cleanMirrors, {
      onFirstWinner: () => {},
      onUpdate: (updatedLatencies, fastest) => {
        setLatencies((prev) => ({ ...prev, ...updatedLatencies }));
        if (fastest) setFastestLabel(fastest);
      },
    });

    return () => {
      cancel();
    };
  }, [isFinalized, cleanMirrors]);

  // Auto-failover: If current mirror fails, switch to next fastest mirror
  const handleAutoFailover = useCallback(() => {
    const candidates = mirrorKeys.filter((k) => k !== selectedMirror);
    if (candidates.length === 0) return;

    const sorted = [...candidates].sort((a, b) => {
      const latA = latencies[a] ?? 9999;
      const latB = latencies[b] ?? 9999;
      return latA - latB;
    });

    const nextFastest = sorted[0];
    setAutoSwitchNotice(`Server was unresponsive. Switched to backup: ${nextFastest}`);
    setTimeout(() => setAutoSwitchNotice(null), 4000);
    setSelectedMirror(nextFastest);
    setIframeError(false);
  }, [mirrorKeys, selectedMirror, latencies]);

  const [blockedAdsCount, setBlockedAdsCount] = useState(0);

  // Stealth Ad Shield: Neutralizes rogue popup storms and tab redirects
  useEffect(() => {
    if (!adShieldActive) return;

    const originalOpen = window.open;

    const stealthOpen = function open(...args: any[]) {
      console.info("[Ad Shield] Prevented unwanted popup window:", ...args);
      setBlockedAdsCount((c) => c + 1);

      const stubWindow: any = {
        closed: false,
        focus: () => {},
        blur: () => {},
        close: () => { stubWindow.closed = true; },
        postMessage: () => {},
        location: { href: "about:blank", replace: () => {}, assign: () => {} },
        document: { write: () => {}, open: () => {}, close: () => {} },
        opener: window,
        window: null,
      };
      stubWindow.window = stubWindow;
      return stubWindow;
    };

    try {
      Object.defineProperty(stealthOpen, "toString", {
        value: () => "function open() { [native code] }",
        configurable: true,
      });
      Object.defineProperty(stealthOpen, "name", {
        value: "open",
        configurable: true,
      });
      window.open = stealthOpen as unknown as typeof window.open;
    } catch {
      window.open = stealthOpen as unknown as typeof window.open;
    }

    return () => {
      window.open = originalOpen;
    };
  }, [adShieldActive]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cross-platform fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    const container = viewportRef.current;
    if (!container) return;

    if (isFullscreen || document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        } catch {}
      }
      setIsFullscreen(false);
      document.body.style.overflow = "";
      try {
        (screen.orientation as any)?.unlock?.();
      } catch {}
      return;
    }

    const videoEl = container.querySelector("video");
    if (videoEl && (videoEl as any).webkitEnterFullscreen && !document.fullscreenEnabled) {
      try {
        (videoEl as any).webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn("[Fullscreen] webkitEnterFullscreen failed, continuing to viewport fallback:", err);
      }
    }

    const canNativeFs =
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      !!(container.requestFullscreen || (container as any).webkitRequestFullscreen);

    if (canNativeFs) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
          return;
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
          setIsFullscreen(true);
          return;
        }
      } catch (err) {
        console.warn("[Fullscreen] Native requestFullscreen blocked or unsupported, using viewport fallback:", err);
      }
    }

    setIsFullscreen(true);
    document.body.style.overflow = "hidden";
    try {
      (screen.orientation as any)?.lock?.("landscape").catch(() => {});
    } catch {}
  }, [isFullscreen]);

  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isNativeFs && isFullscreen) {
        setIsFullscreen(false);
        document.body.style.overflow = "";
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const handleDirectError = useCallback(() => {
    setIsDirectLoading(false);
    setShowDirectLoader(false);
    setIframeError(true);
    handleAutoFailover();
  }, [handleAutoFailover]);

  const handleIframeError = useCallback(() => {
    setIframeError(true);
    handleAutoFailover();
  }, [handleAutoFailover]);

  const handleReload = useCallback(() => {
    setIframeError(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (gateOpen) {
    return (
      <WatchGate
        routingKey={routingKey}
        routingTitle={routingTitle}
        adPartnerUrl1={adPartnerUrl1}
        adPartnerUrl2={adPartnerUrl2}
        onVerified={() => {
          setGateVerified(true);
          setGateOpen(false);
        }}
        onClose={() => setGateOpen(false)}
      />
    );
  }

  const url = selectedMirror ? allMirrors[selectedMirror] : mirrorKeys[0] ? allMirrors[mirrorKeys[0]] : null;

  const isPendingDirect =
    url?.startsWith("direct:pending:") || url?.startsWith("pending:");

  // Determine if the selected source is a direct stream (Video.js HLS)
  const isDirectStream =
    url &&
    !isPendingDirect &&
    (url.endsWith(".m3u8") ||
      url.endsWith(".mp4") ||
      url.includes(".m3u8?") ||
      url.includes(".mp4?") ||
      url.includes("/api/v1/stream") ||
      url.includes("/p?t=") ||
      url.startsWith("direct:"));

  const directStreamUrl = url?.replace(/^direct:/, "") || "";

  return (
    <div className="media-video-player flex flex-col gap-3">
      {/* Video Viewport */}
      <div
        ref={viewportRef}
        className={`relative w-full bg-black transition-all ${
          isFullscreen
            ? "fixed inset-0 z-[999999] h-screen w-screen rounded-none flex items-center justify-center p-0 m-0"
            : "aspect-video overflow-hidden rounded-xl border border-white/10 shadow-2xl"
        }`}
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Exit Fullscreen"
            className="absolute top-4 right-4 z-50 rounded-full bg-black/80 p-2.5 text-white backdrop-blur-md hover:bg-black transition-all border border-white/20 shadow-xl cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Smooth Server Switching Transition Overlay */}
        {isSwitching && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-[2px] transition-all duration-200">
            <div className="flex items-center gap-2.5 rounded-full bg-neutral-900/95 border border-white/10 px-4 py-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-white tracking-wide">Connecting server...</span>
            </div>
          </div>
        )}

        {!url && (
          <div className="flex h-full w-full items-center justify-center text-center">
            <div>
              <Play className="mx-auto h-10 w-10 text-white/30" />
              <p className="mt-3 text-sm text-neutral-400">Select a server below to start streaming</p>
            </div>
          </div>
        )}

        {/* Auto-Switch Notice Toast */}
        {autoSwitchNotice && (
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-neutral-900/90 backdrop-blur-md border border-white/15 px-3 py-1.5 text-xs text-white shadow-xl">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span>{autoSwitchNotice}</span>
          </div>
        )}

        {/* 1. Direct Stream Player with Video.js */}
        {url && isDirectStream && (() => {
          const activeMeta = directStreams.find((d) => d.label === selectedMirror || d.url === directStreamUrl);
          return (
            <VideoJSPlayer
              key={`vjs-${directStreamUrl}`}
              src={directStreamUrl}
              poster={poster}
              subtitles={activeMeta?.subtitles}
              availableAudio={activeMeta?.audioTracks || activeMeta?.audio}
              availableQualities={activeMeta?.qualities || [activeMeta?.quality || "Auto"]}
              autoplay={true}
              controls={true}
              storageKey={routingKey}
              onError={handleDirectError}
              onFirstFrame={handleFirstFrame}
            />
          );
        })()}

        {/* Cinematic Direct CDN Loading Animation (VidStuck / ZXCStream / TG Vid style) */}
        {(isPendingDirect || (isDirectStream && showDirectLoader)) && !failedDirects.has(selectedMirror || "") && (
          <div
            onClick={() => {
              setIsDirectLoading(false);
              setShowDirectLoader(false);
            }}
            className={`absolute inset-0 z-20 transition-all duration-300 ${
              !isPendingDirect && !isDirectLoading
                ? "opacity-0 scale-[1.02] filter blur-sm pointer-events-none"
                : "opacity-100 scale-100 cursor-pointer"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            <DirectStreamLoader
              poster={poster}
              title={routingTitle}
              serverName={selectedMirror || "Direct CDN"}
              isBuffering={Boolean(!isPendingDirect && isDirectStream)}
            />
          </div>
        )}

        {/* 2. Error Fallback State with Auto-Failover to Fastest Server */}
        {url && iframeError && !isPendingDirect && (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <div className="text-center px-6">
              <p className="text-sm text-neutral-300">This server is temporarily unavailable or blocked.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={handleAutoFailover}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs text-white hover:bg-cyan-500 transition-all cursor-pointer font-medium"
                >
                  <Zap className="h-3.5 w-3.5" /> Jump to Next Server
                </button>
                <button
                  onClick={() => {
                    setIframeError(false);
                    setReloadKey((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-1.5 text-xs text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Embed Player (Clean Iframe + Stealth Ad Shield) */}
        {url && !isDirectStream && !isPendingDirect && !iframeError && (() => {
          const shouldSandbox = isProviderSandboxCompatible(url) || isProviderSandboxCompatible(selectedMirror || "");
          return (
            <iframe
              key={`${routingKey}-${selectedMirror}-${url}-${reloadKey}`}
              src={url}
              title={`${routingTitle} — ${selectedMirror}`}
              className="h-full w-full border-0 bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen *"
              allowFullScreen={true}
              sandbox={
                shouldSandbox
                  ? "allow-scripts allow-same-origin allow-forms allow-presentation allow-modals"
                  : undefined
              }
              {...({
                webkitallowfullscreen: "true",
                mozallowfullscreen: "true",
                playsInline: true,
                "webkit-playsinline": "true",
              } as any)}
              referrerPolicy="no-referrer"
            />
          );
        })()}
      </div>

      {/* Server Selection & Action Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MirrorPicker
            mirrors={allMirrors}
            selected={selectedMirror}
            latencies={latencies}
            fastestLabel={fastestLabel}
            isLoading={!isFinalized}
            onSelect={(label) => {
              if (label === selectedMirror) return;
              userInteractedRef.current = true;
              setIsSwitching(true);
              setSelectedMirror(label);
              setIframeError(false);
              setIsDirectLoading(true);
              setShowDirectLoader(true);
              setTimeout(() => {
                setIsSwitching(false);
              }, 250);
            }}
          />

          {/* Ad-Shield, Reload & External Player Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdShieldActive(!adShieldActive)}
              title="Stealth Mode: Prevents rogue popup storms and redirects in top window"
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                adShieldActive
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                  : "bg-white/5 border-white/15 text-neutral-400 hover:text-white"
              }`}
            >
              {adShieldActive ? (
                <>
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  <span>
                    Ad Shield Active
                    {blockedAdsCount > 0 ? ` (${blockedAdsCount})` : ""}
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3 w-3 text-neutral-400" /> Ad Shield Off
                </>
              )}
            </button>

            {isDirectStream && (
              <VlcButton
                streamUrl={directStreamUrl}
                title={routingTitle}
                compact={true}
              />
            )}

            <button
              type="button"
              onClick={handleReload}
              title="Reload current stream"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-neutral-400 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-neutral-400 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <Zap className="h-3 w-3" /> Fullscreen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
