"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { RotateCcw, Maximize2 } from "lucide-react";

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
  availableAudio?: string[] | string;
  availableQualities?: string[];
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
  onFirstFrame?: () => void;
}

function detectPlatform() {
  if (typeof window === "undefined") return { isIOS: false, isAndroid: false };
  const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return { isIOS, isAndroid };
}

/**
 * Player State Bridge — runs inside <VideoPlayer> context
 * Handles resume timestamp, progress saving, first-frame callback, and native fullscreen handoff
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
    } catch {}
  }, [storageKey, store]);

  // First frame playback detection
  useEffect(() => {
    if (!hasNotifiedFirstFrameRef.current && currentTime > 0.1 && !paused) {
      hasNotifiedFirstFrameRef.current = true;
      onFirstFrame?.();
    }
  }, [currentTime, paused, onFirstFrame]);

  // Save progress periodically to localStorage
  useEffect(() => {
    if (!storageKey || !currentTime || !duration) return;
    if (currentTime > 5 && duration - currentTime > 15) {
      try {
        localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(currentTime)));
      } catch {}
    }
  }, [currentTime, duration, storageKey]);

  // Notify on stream error
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  // Native Device Fullscreen Bridge (iOS AVPlayer & Android Hardware Player from xilust)
  const openInNativeDevicePlayer = useCallback(() => {
    const video = document.querySelector("video");
    if (!video) return;

    const { isIOS, isAndroid } = detectPlatform();

    if (!video.hasAttribute("playsinline")) video.setAttribute("playsinline", "");
    if (!video.hasAttribute("webkit-playsinline")) video.setAttribute("webkit-playsinline", "");

    const wasPlaying = !video.paused && !video.ended;

    if (isIOS) {
      if (typeof (video as any).webkitEnterFullscreen === "function") {
        try {
          const onBeginIOS = function () {
            video.removeEventListener("webkitbeginfullscreen", onBeginIOS);
            if (wasPlaying && video.paused) {
              try {
                const p = video.play();
                if (p && typeof p.catch === "function") p.catch(() => {});
              } catch {}
            }
          };
          video.addEventListener("webkitbeginfullscreen", onBeginIOS);

          const onExitIOS = function () {
            video.removeEventListener("webkitendfullscreen", onExitIOS);
            if (wasPlaying && video.paused) {
              try {
                const p = video.play();
                if (p && typeof p.catch === "function") p.catch(() => {});
              } catch {}
            }
          };
          video.addEventListener("webkitendfullscreen", onExitIOS);

          (video as any).webkitEnterFullscreen();
          return;
        } catch (err) {
          console.warn("[VideoJS] iOS webkitEnterFullscreen error:", err);
        }
      }
    }

    if (isAndroid) {
      const reqVideoFs =
        video.requestFullscreen ||
        (video as any).webkitRequestFullscreen ||
        (video as any).webkitEnterFullscreen;

      if (typeof reqVideoFs === "function") {
        try {
          const onFsChange = function () {
            const isFs =
              document.fullscreenElement === video ||
              (document as any).webkitFullscreenElement === video;
            if (!isFs) {
              document.removeEventListener("fullscreenchange", onFsChange);
              document.removeEventListener("webkitfullscreenchange", onFsChange);
              if (wasPlaying && video.paused) {
                try {
                  const p = video.play();
                  if (p && typeof p.catch === "function") p.catch(() => {});
                } catch {}
              }
            }
          };
          document.addEventListener("fullscreenchange", onFsChange);
          document.addEventListener("webkitfullscreenchange", onFsChange);

          const promise = reqVideoFs.call(video);
          if (promise && typeof promise.catch === "function") {
            promise.catch(() => {
              if (store && typeof store.requestFullscreen === "function") {
                store.requestFullscreen();
              }
            });
          }
          return;
        } catch (err) {
          console.warn("[VideoJS] Android video fullscreen error:", err);
        }
      }
    }

    // Fallback standard fullscreen
    if (store && typeof store.requestFullscreen === "function") {
      store.requestFullscreen();
    }
  }, [store]);

  return (
    <>
      {/* Resume Toast */}
      {resumedNotice && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-2 rounded-xl bg-black/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-200">
          <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
          <span>{resumedNotice}</span>
        </div>
      )}

      {/* Native Device Fullscreen Action (Mobile) */}
      <button
        type="button"
        onClick={openInNativeDevicePlayer}
        title="Open in Native Device Player"
        className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-1.5 rounded-lg bg-black/70 hover:bg-black/90 px-2.5 py-1 text-[11px] font-medium text-neutral-200 border border-white/10 shadow-lg backdrop-blur-md transition cursor-pointer"
      >
        <Maximize2 className="h-3 w-3 text-cyan-400" />
        <span>Native FS</span>
      </button>
    </>
  );
}

/**
 * Modern Video.js 10 React Player Component
 * Incorporates:
 * - HlsJsVideo for adaptive HLS CDN streams with automatic multi-rendition Quality discovery
 * - Dynamic <track kind="subtitles"> binding for full source-based caption selection
 * - VideoSkin with Video.js 10 UI, built-in captions toggle & menu, quality selector, and audio track switcher
 */
export function VideoJSPlayer({
  src,
  poster,
  autoplay = true,
  controls = true,
  className = "",
  subtitles = [],
  storageKey,
  onReady,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const isHls =
    src.includes(".m3u8") ||
    (!src.includes(".mp4") && !src.includes(".webm"));

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
              src={src}
              playsInline
              crossOrigin="anonymous"
              autoPlay={autoplay}
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
              crossOrigin="anonymous"
              autoPlay={autoplay}
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

