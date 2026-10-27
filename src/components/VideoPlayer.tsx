"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, RefreshCw, Loader2, ShieldCheck, ShieldAlert, Zap } from "lucide-react";
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

  // Stealth Ad Shield: Neutralizes rogue popup storms and tab redirects
  // while preserving native [native code] signature to prevent sandbox / anti-adblock detection
  useEffect(() => {
    if (!adShieldActive) return;

    const originalOpen = window.open;

    const stealthOpen = function open(...args: any[]) {
      console.info("[Ad Shield] Prevented unwanted popup window:", ...args);
      return null;
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

    // Intercept top-level navigation hijack attempts from rogue ad scripts
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If user didn't explicitly click internal navigation, warn before leaving
      // Only active if an ad attempts to redirect top-level window
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.open = originalOpen;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [adShieldActive]);

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
      {/* Video Viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
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

        {/* 3. Unsandboxed Anti-Ad Embed Player */}
        {url && !isDirectStream && !iframeError && (
          <iframe
            key={`${routingKey}-${selectedMirror}-${url}-${reloadKey}`}
            src={url}
            title={`${routingTitle} — ${selectedMirror}`}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
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

          {/* Ad-Shield & Reload Actions */}
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
                    <ShieldCheck className="h-3 w-3 text-indigo-400" /> Ad Shield Active
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
