"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Play, RefreshCw, Loader2, ShieldCheck, ShieldAlert, Zap, Maximize, Minimize, X, Activity } from "lucide-react";
import { MirrorPicker } from "./MirrorPicker";
import { WatchGate } from "./WatchGate";
import { isWatchGateEnabled } from "@/lib/watchgate";
import { VideoJSPlayer } from "./VideoJSPlayer";
import { VlcButton } from "./VlcButton";
import { raceCandidateMirrors, getHistoricallyFastest } from "@/lib/serverRacer";
import { isProviderSandboxCompatible } from "@/lib/providers";

interface VideoPlayerProps {
  routingKey: string; // "movie:1400940"
  routingTitle: string;
  mirrors: Record<string, string>;
  adPartnerUrl1?: string;
  adPartnerUrl2?: string;
  poster?: string;
}

export function VideoPlayer({
  routingKey,
  routingTitle,
  mirrors,
  adPartnerUrl1,
  adPartnerUrl2,
  poster,
}: VideoPlayerProps) {
  const [gateOpen, setGateOpen] = useState(isWatchGateEnabled());
  const [gateVerified, setGateVerified] = useState(!isWatchGateEnabled());
  const [directStream, setDirectStream] = useState<{ url: string; label: string } | null>(null);

  // Auto-Racer State: Real-time mirror latency & fastest candidate detection
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [fastestLabel, setFastestLabel] = useState<string | null>(null);
  const [autoSwitchNotice, setAutoSwitchNotice] = useState<string | null>(null);
  const userInteractedRef = useRef(false);

  // Auto-resolve direct HLS stream (0 ads, 0 popups, 100% native Video.js mobile player)
  // - Movies/TV: resolved from tgvidapi (TG HUB v2 / TG OUT)
  // - Anime: resolved from ReCloud (cdn.4animo.xyz HD-1)
  useEffect(() => {
    if (!routingKey) return;
    const parts = routingKey.split(":");
    const type = parts[0];
    const id = parts[1];
    const s = parts[2] || "1";
    const e = parts[3] || "1";

    let isMounted = true;
    let url = "";

    if (type === "anime") {
      url = `/api/resolve-anime?id=${id}&s=${s}&e=${e}`;
    } else {
      url = `/api/resolve-tg?type=${type}&id=${id}`;
      if (type === "tv" && s && e) {
        url += `&s=${s}&e=${e}`;
      }
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && data.playable) {
          const directObj = {
            url: data.playable,
            label: type === "anime" ? "⚡ Direct Anime (Video.js)" : "⚡ Direct CDN (Video.js)",
          };
          setDirectStream(directObj);
          // Direct CDN stream is the absolute highest priority (0 ads, native player)
          setSelectedMirror(directObj.label);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [routingKey]);

  // Clean mirrors: If direct stream is active or tgvid is requested, replace ad-infested tgvid.lovable embed iframe
  const cleanMirrors: Record<string, string> = useMemo(() => {
    const res: Record<string, string> = {};
    for (const [key, val] of Object.entries(mirrors)) {
      if (val.includes("tgvid.lovable.app")) {
        // If direct stream is available, don't show the ad-infested iframe mirror
        if (!directStream) {
          res[key] = val;
        }
      } else {
        res[key] = val;
      }
    }
    return res;
  }, [mirrors, directStream]);

  // Combine direct stream with mirror options (Direct CDN placed first)
  const allMirrors: Record<string, string> = useMemo(() => {
    return directStream
      ? { [directStream.label]: directStream.url, ...cleanMirrors }
      : cleanMirrors;
  }, [directStream, cleanMirrors]);

  const mirrorKeys = useMemo(() => Object.keys(allMirrors), [allMirrors]);
  const [selectedMirror, setSelectedMirror] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [adShieldActive, setAdShieldActive] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Initialize selected mirror with historically fastest or first mirror
  useEffect(() => {
    if (selectedMirror && allMirrors[selectedMirror]) return;
    if (directStream) {
      setSelectedMirror(directStream.label);
      return;
    }
    const historical = getHistoricallyFastest(cleanMirrors);
    if (historical && allMirrors[historical]) {
      setSelectedMirror(historical);
    } else if (mirrorKeys.length > 0) {
      setSelectedMirror(mirrorKeys[0]);
    }
  }, [allMirrors, cleanMirrors, directStream, mirrorKeys, selectedMirror]);

  // Real-time Fastest Server Auto-Racer:
  // Concurrently probes candidate servers to pick the fastest responding server from the user's location
  useEffect(() => {
    if (Object.keys(cleanMirrors).length === 0) return;

    const cancel = raceCandidateMirrors(cleanMirrors, {
      onFirstWinner: (label, latency) => {
        setFastestLabel(label);
        // Only auto-switch to first responder if direct stream isn't active and user hasn't chosen manually
        if (!directStream && !userInteractedRef.current) {
          setSelectedMirror(label);
          setAutoSwitchNotice(`⚡ Auto-selected fastest server: ${label} (${latency}ms)`);
          setTimeout(() => setAutoSwitchNotice(null), 3500);
        }
      },
      onUpdate: (updatedLatencies, fastest) => {
        setLatencies({ ...updatedLatencies });
        if (fastest) setFastestLabel(fastest);
      },
    });

    return () => {
      cancel();
    };
  }, [cleanMirrors, directStream]);

  // Auto-failover: If current server fails, immediately promote the next fastest responding mirror
  const handleAutoFailover = useCallback(() => {
    const candidates = mirrorKeys.filter((k) => k !== selectedMirror);
    if (candidates.length === 0) return;

    // Rank candidates by measured ping response time
    const sorted = [...candidates].sort((a, b) => {
      const latA = latencies[a] ?? 9999;
      const latB = latencies[b] ?? 9999;
      return latA - latB;
    });

    const nextFastest = sorted[0];
    setAutoSwitchNotice(`⚡ Server was unresponsive. Auto-switched to fastest backup: ${nextFastest}!`);
    setTimeout(() => setAutoSwitchNotice(null), 4000);
    setSelectedMirror(nextFastest);
    setIframeError(false);
  }, [mirrorKeys, selectedMirror, latencies]);

  const [blockedAdsCount, setBlockedAdsCount] = useState(0);

  // Stealth Ad Shield: Neutralizes rogue popup storms and tab redirects
  // Providers like Vidrift check: if (!window.open() || win.closed) throw "Remove sandboxing"
  // Returning a realistic stub window satisfies this check without opening any real window/tab.
  useEffect(() => {
    if (!adShieldActive) return;

    const originalOpen = window.open;

    const stealthOpen = function open(...args: any[]) {
      console.info("[Ad Shield] Prevented unwanted popup window:", ...args);
      setBlockedAdsCount((c) => c + 1);

      // Return realistic stub Window object to deceive sandbox/popup detection
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

    // Ensure toString() returns standard native code signature
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
  // Supports native iOS Safari <video> fullscreen, standard HTML5 Fullscreen API, and CSS pseudo-fullscreen.
  const toggleFullscreen = useCallback(async () => {
    const container = viewportRef.current;
    if (!container) return;

    // 1. If currently in fullscreen mode, exit it
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

    // 2. Try native <video> element WebKit fullscreen on iOS Safari / iPad
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

    // 3. Try standard HTML5 Fullscreen API (Windows, Mac, Android Chrome)
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

    // 4. Viewport fallback (iOS Safari / mobile WebKit for iframes)
    setIsFullscreen(true);
    document.body.style.overflow = "hidden";
    try {
      (screen.orientation as any)?.lock?.("landscape").catch(() => {});
    } catch {}
  }, [isFullscreen]);

  // Sync state when exiting fullscreen via Escape key or mobile gestures
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

  // Intercept any TG Vid mirror so it NEVER loads the ad-infested tgvid.lovable.app iframe!
  const isTgVidMirror = !!(selectedMirror?.includes("TG Vid") || url?.includes("tgvid.lovable.app"));

  // Determine if the selected source is a direct stream suitable for Video.js
  const isDirectStream =
    (url &&
      (url.endsWith(".m3u8") ||
        url.endsWith(".mp4") ||
        url.includes(".m3u8?") ||
        url.includes(".mp4?") ||
        url.includes("/api/out?") ||
        url.startsWith("direct:"))) ||
    (isTgVidMirror && !!directStream);

  const directStreamUrl =
    isTgVidMirror && directStream
      ? directStream.url
      : url?.replace(/^direct:/, "") || "";

  const activeStreamUrl = (isDirectStream && directStreamUrl) ? directStreamUrl : (directStream?.url || null);

  return (
    <div className="flex flex-col gap-3">
      {/* Video Viewport (Supports Native & Mobile Viewport Fullscreen) */}
      <div
        ref={viewportRef}
        className={`relative w-full bg-black transition-all ${
          isFullscreen
            ? "fixed inset-0 z-[999999] h-screen w-screen rounded-none flex items-center justify-center p-0 m-0"
            : "aspect-video overflow-hidden rounded-xl border border-white/10 shadow-2xl"
        }`}
      >
        {/* Floating Close Button for Mobile Pseudo-Fullscreen */}
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
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-indigo-600/90 backdrop-blur-md border border-indigo-400/40 px-3 py-1.5 text-xs text-white shadow-xl animate-in fade-in slide-in-from-top-2">
            <Zap className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
            <span>{autoSwitchNotice}</span>
          </div>
        )}

        {/* 1. Direct CDN Player with Video.js (0 ads, 0 popups, 100% mobile fullscreen) */}
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

        {/* 2. Resolving TG Direct Stream State (Prevents ever falling back to ad-infested iframe) */}
        {isTgVidMirror && !directStream && !iframeError && (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <div className="text-center px-6">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
              <p className="mt-3 text-sm text-neutral-300 font-medium">Connecting Direct Ad-Free Stream...</p>
              <p className="mt-1 text-xs text-neutral-500">Bypassing iframe ads and initializing mobile player</p>
            </div>
          </div>
        )}

        {/* 3. Error Fallback State with Auto-Failover to Fastest Server */}
        {url && iframeError && (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <div className="text-center px-6">
              <p className="text-sm text-red-400">This server couldn&apos;t load or is blocked in your area.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={handleAutoFailover}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-500 transition-all cursor-pointer font-medium shadow-md shadow-amber-600/20"
                >
                  <Zap className="h-3.5 w-3.5" /> Jump to Fastest Server
                </button>
                <button
                  onClick={handleReload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Current
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Embed Player (Sandbox Removed to Eliminate "Please Disable Sandbox" on Servers 1, 5, 7, etc.) */}
        {url && !isDirectStream && !iframeError && !isTgVidMirror && (
          <iframe
            key={`${routingKey}-${selectedMirror}-${url}-${reloadKey}`}
            src={url}
            title={`${routingTitle} — ${selectedMirror}`}
            className="h-full w-full border-0 bg-black"
            sandbox={undefined}
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

      {/* Control bar: Servers + Status Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MirrorPicker
            mirrors={allMirrors}
            selected={selectedMirror}
            latencies={latencies}
            fastestLabel={fastestLabel}
            onSelect={(label) => {
              userInteractedRef.current = true;
              setSelectedMirror(label);
              setIframeError(false);
            }}
          />

          {/* Ad-Shield, Reload & Fullscreen Actions */}
          <div className="flex items-center gap-2">
            {isDirectStream ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                <Zap className="h-3 w-3" /> Direct CDN (Video.js)
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAdShieldActive(!adShieldActive)}
                title="Stealth Mode: Prevents rogue popup storms and redirects in top window without sandbox errors"
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  adShieldActive
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25"
                    : "bg-white/5 border-white/15 text-neutral-400 hover:text-white"
                }`}
              >
                {adShieldActive ? (
                  <>
                    <ShieldCheck className="h-3 w-3 text-indigo-400" />
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
            )}

            {/* Stream in VLC & External Players */}
            {activeStreamUrl && (
              <VlcButton
                streamUrl={activeStreamUrl}
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

            {/* Cross-platform Fullscreen Button (Solves mobile iframe fullscreen restrictions) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen (Mobile Friendly)"}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:border-white/20 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-3 w-3" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize className="h-3 w-3" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3" />
            <span>
              {isDirectStream
                ? "Streaming ad-free directly via high-speed CDN in native Video.js."
                : "Unsandboxed player enabled with Stealth Ad Shield & Auto-Racer."}
            </span>
          </div>
          {fastestLabel && latencies[fastestLabel] && (
            <div className="flex items-center gap-1 font-medium text-emerald-400">
              <Zap className="h-3 w-3" />
              <span>Fastest: {fastestLabel} ({latencies[fastestLabel]}ms)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
