"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { RotateCcw } from "lucide-react";

export interface QualityItem {
  quality: string;
  url: string;
}

export interface AudioItem {
  language: string;
  label: string;
  url: string;
}

export interface SubtitleTrack {
  lang?: string;
  label?: string;
  url?: string;
  format?: string;
  default?: boolean;
}

export interface VideoJSPlayerProps {
  src: string;
  type?: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  storageKey?: string;
  subtitles?: SubtitleTrack[];
  availableAudio?: AudioItem[] | string[] | any;
  availableQualities?: QualityItem[] | string[] | any;
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
  onFirstFrame?: () => void;
}

/**
 * Player State Bridge — runs inside <VideoPlayer> context
 * Handles resume timestamp, progress saving, first-frame callback, and native playback tracking
 */
function PlayerStateBridge({
  storageKey,
  onFirstFrame,
  onError,
}: {
  storageKey?: string;
  onFirstFrame?: () => void;
  onError?: (err: any) => void;
}) {
  const store = usePlayer();
  const currentTime = usePlayer((s: any) => s?.currentTime ?? 0);
  const duration = usePlayer((s: any) => s?.duration ?? 0);
  const paused = usePlayer((s: any) => s?.paused ?? true);
  const error = usePlayer((s: any) => s?.error);

  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const hasResumedRef = useRef(false);
  const hasNotifiedFirstFrameRef = useRef(false);

  // Format MM:SS helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Resume playback on load if previously saved
  useEffect(() => {
    if (!storageKey || hasResumedRef.current || !store) return;
    try {
      const saved = localStorage.getItem(`aethoflix_resume_${storageKey}`);
      if (saved) {
        const t = parseFloat(saved);
        if (t > 5 && isFinite(t)) {
          hasResumedRef.current = true;
          if (typeof store.seek === "function") {
            store.seek(t);
          }
          setResumedNotice(`Resumed at ${formatTime(t)}`);
          setTimeout(() => setResumedNotice(null), 3500);
        }
      }
    } catch { }
  }, [storageKey, store]);

  // First frame & readiness detection: dismiss loading screen as soon as stream is ready
  useEffect(() => {
    const notifyReady = () => {
      if (!hasNotifiedFirstFrameRef.current) {
        hasNotifiedFirstFrameRef.current = true;
        onFirstFrame?.();
      }
    };

    if (currentTime > 0.05 || duration > 0 || !paused) {
      notifyReady();
    }

    // Safety watchdog: ensure loader is never stuck if browser delays autoplay
    const safetyTimer = setTimeout(notifyReady, 2000);
    return () => clearTimeout(safetyTimer);
  }, [currentTime, duration, paused, onFirstFrame]);

  // Save progress periodically to localStorage
  useEffect(() => {
    if (!storageKey || !currentTime || !duration) return;
    if (currentTime > 5 && duration - currentTime > 15) {
      try {
        localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(currentTime)));
      } catch { }
    }
  }, [currentTime, duration, storageKey]);

  // Notify on stream error
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  return (
    <>
      {/* Resume Toast */}
      {resumedNotice && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-2 rounded-xl bg-black/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-200">
          <RotateCcw className="h-3.5 w-3.5 text-red-500" />
          <span>{resumedNotice}</span>
        </div>
      )}
    </>
  );
}

/**
 * Modern Video.js 10 React Player Component
 * Architecture:
 * - 100% native Video.js control bar with zero extraneous overlays or portals
 * - Automatically synthesizes multi-rendition HLS manifests for discrete CDN sources
 *   so Video.js's native Quality menu detects all levels and displays:
 *   "Quality  Auto (1080p) >" and "Speed  1x >" directly in the settings popup
 * - Direct CDN multi-language subtitles bound via standard <track> elements
 * - Obsidian dark glass (#050505) aesthetic with signature Netflix crimson (#e50914) accent
 */
export function VideoJSPlayer({
  src,
  poster,
  autoplay = true,
  controls = true,
  className = "",
  subtitles = [],
  availableQualities,
  storageKey,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const isHls =
    src.includes(".m3u8") ||
    (!src.includes(".mp4") && !src.includes(".webm"));

  // Ensure Video.js native Quality menu has multi-rendition levels to display
  const effectiveSrc = useMemo(() => {
    if (!src || !isHls) return src;
    if (src.startsWith("/api/hls-master")) return src;

    // Collect all candidate HLS stream renditions
    let hlsQualities: Array<{ quality: string; url: string }> = [];

    if (Array.isArray(availableQualities)) {
      for (const q of availableQualities) {
        if (q && typeof q === "object" && q.url && q.url.includes(".m3u8")) {
          hlsQualities.push({ quality: q.quality || "720p", url: q.url });
        }
      }
    }

    // Auto-detect paired resolution for single-level Castle HLS streams (e.g. 720p <-> 480p)
    if (hlsQualities.length <= 1 && src.includes("/720/")) {
      hlsQualities = [
        { quality: "720p", url: src },
        { quality: "480p", url: src.replace("/720/", "/480/") },
      ];
    } else if (hlsQualities.length <= 1 && src.includes("/1080/")) {
      hlsQualities = [
        { quality: "1080p", url: src },
        { quality: "720p", url: src.replace("/1080/", "/720/") },
        { quality: "480p", url: src.replace("/1080/", "/480/") },
      ];
    }

    if (hlsQualities.length > 1 && typeof window !== "undefined") {
      // Build standard HLS Master Playlist
      const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
      const sorted = [...hlsQualities].sort((a, b) => {
        const hA = parseInt(a.quality) || 0;
        const hB = parseInt(b.quality) || 0;
        return hB - hA;
      });

      const seen = new Set<string>();
      for (const q of sorted) {
        const label = q.quality || "720p";
        if (seen.has(label)) continue;
        seen.add(label);

        const height = parseInt(label) || 720;
        let width = 1280;
        let bandwidth = 2500000;

        if (height >= 1080) {
          width = 1920;
          bandwidth = 5000000;
        } else if (height >= 720) {
          width = 1280;
          bandwidth = 2500000;
        } else if (height >= 480) {
          width = 854;
          bandwidth = 1200000;
        } else {
          width = 640;
          bandwidth = 800000;
        }

        lines.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${label}"`
        );
        lines.push(q.url);
      }

      const manifest = lines.join("\n") + "\n";
      const blob = new Blob([manifest], { type: "application/vnd.apple.mpegurl" });
      return URL.createObjectURL(blob);
    }

    return src;
  }, [src, isHls, availableQualities]);

  useEffect(() => {
    return () => {
      if (effectiveSrc && effectiveSrc.startsWith("blob:")) {
        URL.revokeObjectURL(effectiveSrc);
      }
    };
  }, [effectiveSrc]);

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}>
      <VideoPlayer poster={poster}>
        <PlayerStateBridge
          storageKey={storageKey}
          onFirstFrame={onFirstFrame}
          onError={onError}
        />
        <VideoSkin
          style={
            {
              "--media-accent-color": "#e50914",
              "--media-accent-text-color": "#ffffff",
              "--media-border-color": "transparent",
              "--media-border-radius": "0.75rem",
              "--media-font-family":
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              width: "100%",
              height: "100%",
              aspectRatio: "16 / 9",
            } as React.CSSProperties
          }
        >
          {isHls ? (
            <HlsJsVideo
              src={effectiveSrc}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={onFirstFrame}
              onCanPlay={onFirstFrame}
              onPlay={onFirstFrame}
            >
              {subtitles?.map((s, idx) => (
                <track
                  key={s.url || s.lang || idx}
                  kind="subtitles"
                  src={s.url}
                  srcLang={s.lang || "en"}
                  label={s.label || s.lang || `Track ${idx + 1}`}
                  default={s.default}
                />
              ))}
            </HlsJsVideo>
          ) : (
            <Video
              src={src}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={onFirstFrame}
              onCanPlay={onFirstFrame}
              onPlay={onFirstFrame}
            >
              {subtitles?.map((s, idx) => (
                <track
                  key={s.url || s.lang || idx}
                  kind="subtitles"
                  src={s.url}
                  srcLang={s.lang || "en"}
                  label={s.label || s.lang || `Track ${idx + 1}`}
                  default={s.default}
                />
              ))}
            </Video>
          )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
}

export default VideoJSPlayer;
