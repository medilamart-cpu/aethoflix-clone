"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, RefreshCw, ShieldCheck, ShieldAlert, Zap, X } from "lucide-react";
import { MirrorPicker } from "./MirrorPicker";
import { WatchGate } from "./WatchGate";
import { isWatchGateEnabled } from "@/lib/watchgate";
import { VideoJSPlayer } from "./VideoJSPlayer";
import { VlcButton } from "./VlcButton";
import { raceCandidateMirrors } from "@/lib/serverRacer";

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

  const [directStream, setDirectStream] = useState<{ url: string; label: string } | null>(
    initialCache?.directStream ?? null
  );
  const [verifiedServers, setVerifiedServers] = useState<Array<{ label: string; url: string; latency: number }> | null>(
    initialCache?.verifiedServers ?? null
  );
  const [latencies, setLatencies] = useState<Record<string, number>>(initialCache?.latencies ?? {});
  const [fastestLabel, setFastestLabel] = useState<string | null>(initialCache?.verifiedServers?.[0]?.label ?? null);
  const [isFinalized, setIsFinalized] = useState<boolean>(!!initialCache);
  const [selectedMirror, setSelectedMirror] = useState<string | null>(initialCache?.selectedMirror ?? null);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<string | null>(null);
  const userInteractedRef = useRef(false);

  // Reset stream states immediately whenever the routingKey changes (new movie/episode)
  useEffect(() => {
    setDirectStream(null);
    setSelectedMirror(null);
    setVerifiedServers(null);
    setIsFinalized(false);
    setIframeError(false);
    userInteractedRef.current = false;
  }, [routingKey]);

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

    // Direct stream resolution for anime and movies/TV (VidSync Direct CDN)
    const directAnimeUrl =
      type === "anime" ? `/api/resolve-anime?id=${id}&s=${s}&e=${e}` : "";

    const directTgUrl =
      type === "movie" || type === "tv"
        ? `/api/resolve-tg?type=${type}&id=${id}${imdbId ? `&imdb=${encodeURIComponent(imdbId)}` : ""}&s=${s}&e=${e}`
        : "";

    const checkServersUrl = `/api/check-servers?type=${type}&id=${id}&s=${s}&e=${e}`;

    Promise.allSettled([
      directAnimeUrl ? fetch(directAnimeUrl).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
      directTgUrl ? fetch(directTgUrl).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
      fetch(checkServersUrl).then((r) => r.json()).catch(() => null),
    ]).then(([animeRes, tgRes, checkRes]) => {
      if (!isMounted) return;

      let foundDirect: { url: string; label: string } | null = null;
      if (animeRes.status === "fulfilled" && animeRes.value?.ok && animeRes.value?.playable) {
        foundDirect = {
          url: animeRes.value.playable,
          label: "Direct Anime (Video.js)",
        };
      } else if (tgRes.status === "fulfilled" && tgRes.value?.ok && tgRes.value?.playable) {
        foundDirect = {
          url: tgRes.value.playable,
          label: "Direct CDN (VidSync)",
        };
      }

      let foundServers: Array<{ label: string; url: string; latency: number }> = [];
      const latMap: Record<string, number> = {};

      if (checkRes.status === "fulfilled" && checkRes.value?.ok && checkRes.value?.servers?.length) {
        foundServers = checkRes.value.servers;
        for (const srv of foundServers) {
          latMap[srv.label] = srv.latency;
        }
      } else {
        // Fallback to static mirrors if ping probe fails
        for (const [lbl, u] of Object.entries(mirrors)) {
          foundServers.push({ label: lbl, url: u, latency: 150 });
        }
      }

      const defaultSelection = foundDirect
        ? foundDirect.label
        : (foundServers[0]?.label || Object.keys(mirrors)[0] || null);

      setDirectStream(foundDirect);
      setVerifiedServers(foundServers);
      setLatencies(latMap);
      if (foundServers[0]?.label) setFastestLabel(foundServers[0].label);
      if (!userInteractedRef.current && defaultSelection) {
        setSelectedMirror(defaultSelection);
      }
      setIsFinalized(true);

      try {
        sessionStorage.setItem(
          `aethoflix_final_servers_${routingKey}`,
          JSON.stringify({
            directStream: foundDirect,
            verifiedServers: foundServers,
            latencies: latMap,
            selectedMirror: defaultSelection || "",
          })
        );
      } catch {}
    });

    return () => {
      isMounted = false;
    };
  }, [routingKey, initialCache, mirrors]);

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

  // Combine direct stream (TG Vid Direct CDN / Anime Direct) with verified embed mirrors
  const allMirrors: Record<string, string> = useMemo(() => {
    const res: Record<string, string> = {};
    if (directStream) {
      res[directStream.label] = directStream.url;
    }
    for (const [key, val] of Object.entries(cleanMirrors)) {
      if (directStream && (key.toLowerCase().includes("tg vid") || val.includes("tgvid"))) {
        continue; // omit duplicate TG Vid iframe since Direct CDN is active
      }
      res[key] = val;
    }
    return res;
  }, [directStream, cleanMirrors]);

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

  // Determine if the selected source is a direct stream (e.g. for anime)
  const isDirectStream =
    url &&
    (url.endsWith(".m3u8") ||
      url.endsWith(".mp4") ||
      url.includes(".m3u8?") ||
      url.includes(".mp4?") ||
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

        {/* 1. Direct Stream Player with HLS.js (for anime direct HLS) */}
        {url && isDirectStream && (
          <VideoJSPlayer
            key={`vjs-${directStreamUrl}-${reloadKey}`}
            src={directStreamUrl}
            poster={poster}
            autoplay={true}
            controls={true}
            storageKey={routingKey}
            onError={() => {
              setIframeError(true);
              handleAutoFailover();
            }}
          />
        )}

        {/* 2. Error Fallback State with Auto-Failover to Fastest Server */}
        {url && iframeError && (
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
                  onClick={handleReload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-1.5 text-xs text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Embed Player (Clean Iframe + Stealth Ad Shield) */}
        {url && !isDirectStream && !iframeError && (
          <iframe
            key={`${routingKey}-${selectedMirror}-${url}-${reloadKey}`}
            src={url}
            title={`${routingTitle} — ${selectedMirror}`}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen *"
            allowFullScreen={true}
            {...({
              webkitallowfullscreen: "true",
              mozallowfullscreen: "true",
              playsInline: true,
              "webkit-playsinline": "true",
            } as any)}
            referrerPolicy="origin"
            onError={() => {
              setIframeError(true);
              handleAutoFailover();
            }}
          />
        )}
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
              userInteractedRef.current = true;
              setSelectedMirror(label);
              setIframeError(false);
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
