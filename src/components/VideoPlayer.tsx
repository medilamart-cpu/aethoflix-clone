"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, RefreshCw, Loader2, ShieldCheck, ShieldAlert, Zap, Maximize, Minimize, X } from "lucide-react";
import { MirrorPicker } from "./MirrorPicker";
import { WatchGate } from "./WatchGate";
import { isWatchGateEnabled } from "@/lib/watchgate";
import { VideoJSPlayer } from "./VideoJSPlayer";

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
  const mirrorKeys = Object.keys(mirrors);
  const [selectedMirror, setSelectedMirror] = useState<string | null>(mirrorKeys[0] || null);
  const [iframeError, setIframeError] = useState(false);
  const [adShieldActive, setAdShieldActive] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const keys = Object.keys(mirrors);
    if (keys.length > 0 && (!selectedMirror || !mirrors[selectedMirror])) {
      setSelectedMirror(keys[0]);
    }
    setIframeError(false);
  }, [routingKey, mirrors, selectedMirror]);

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
  // Mobile browsers (especially iOS Safari) block requestFullscreen() on cross-origin iframes.
  // We seamlessly support both standard HTML5 Fullscreen API and CSS Pseudo-Fullscreen for mobile.
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

    // 2. Try native Fullscreen API first (Windows, Mac, Android Chrome)
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

    // 3. Viewport fallback (iOS Safari / mobile WebKit)
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

  const url = selectedMirror ? mirrors[selectedMirror] : mirrorKeys[0] ? mirrors[mirrorKeys[0]] : null;

  // Determine if the selected source is a direct stream suitable for Video.js
  const isDirectStream =
    url &&
    (url.endsWith(".m3u8") ||
      url.endsWith(".mp4") ||
      url.includes(".m3u8?") ||
      url.includes(".mp4?") ||
      url.startsWith("direct:"));

  const directStreamUrl = url?.replace(/^direct:/, "") || "";

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

        {/* 1. Direct CDN Player with Video.js */}
        {url && isDirectStream && (
          <VideoJSPlayer
            key={`vjs-${directStreamUrl}-${reloadKey}`}
            src={directStreamUrl}
            poster={poster}
            autoplay={true}
            controls={true}
            onError={() => setIframeError(true)}
          />
        )}

        {/* 2. Error Fallback State */}
        {url && iframeError && (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <div className="text-center px-6">
              <p className="text-sm text-red-400">This server couldn&apos;t load or is blocked in your area.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={handleReload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry Current
                </button>
                <button
                  onClick={() => {
                    const nextIdx = (mirrorKeys.indexOf(selectedMirror || "") + 1) % mirrorKeys.length;
                    setSelectedMirror(mirrorKeys[nextIdx]);
                    setIframeError(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Next Server
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Unsandboxed Anti-Ad Embed Player (Mobile Fullscreen Enabled) */}
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
            onError={() => setIframeError(true)}
          />
        )}
      </div>

      {/* Control bar: Servers + Status Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MirrorPicker
            mirrors={mirrors}
            selected={selectedMirror}
            onSelect={(label) => {
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
                title="Toggle Stealth Ad Shield to block popups and redirects"
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
                      Ad Shield {blockedAdsCount > 0 ? `(${blockedAdsCount} blocked)` : "Active"}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3 text-neutral-400" /> Ad Shield Off
                  </>
                )}
              </button>
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

        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Loader2 className="h-3 w-3" />
          <span>
            {isDirectStream
              ? "Streaming ad-free directly via high-speed CDN in native Video.js."
              : "Unsandboxed player enabled with Stealth Ad Shield. Switch servers if any mirror takes too long to load."}
          </span>
        </div>
      </div>
    </div>
  );
}
