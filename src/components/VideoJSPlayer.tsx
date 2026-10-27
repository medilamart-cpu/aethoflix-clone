"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { VolumeX, RotateCcw } from "lucide-react";

export type VideoJsPlayer = any;

export interface VideoJSPlayerProps {
  src: string;
  type?: string; // "application/x-mpegURL" or "video/mp4"
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  storageKey?: string; // e.g. "movie:1560520" for auto-resume progress
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
}

export function VideoJSPlayer({
  src,
  type,
  poster,
  autoplay = true,
  className = "",
  storageKey,
  onReady,
  onError,
}: VideoJSPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isMutedAutoplay, setIsMutedAutoplay] = useState(false);
  const [resumedNotice, setResumedNotice] = useState<string | null>(null);

  const isHls =
    type === "application/x-mpegURL" ||
    src.includes(".m3u8") ||
    (!src.includes(".mp4") && !src.includes(".webm"));

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleLoadedMetadata = useCallback(() => {
    onReady?.(null);
    const video = wrapperRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!video) return;

    // 1. Auto-Resume from saved position
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`aethoflix_resume_${storageKey}`);
        if (saved) {
          const time = parseFloat(saved);
          if (time > 5 && time < (video.duration - 15)) {
            video.currentTime = time;
            setResumedNotice(`Resumed at ${formatTime(time)}`);
            setTimeout(() => setResumedNotice(null), 3500);
          }
        }
      } catch {}
    }

    // 2. Auto-Play immediately
    if (autoplay) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[Video.js] Unmuted autoplay blocked, attempting muted autoplay:", err);
          video.muted = true;
          video.play().then(() => {
            setIsMutedAutoplay(true);
          }).catch((e) => {
            console.error("[Video.js] Autoplay prevented:", e);
          });
        });
      }
    }

    // 3. Time update listener to save progress
    const onTimeUpdate = () => {
      if (storageKey && video.currentTime > 5 && (video.duration - video.currentTime > 15)) {
        try {
          localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(video.currentTime)));
        } catch {}
      }
    };

    const onEnded = () => {
      if (storageKey) {
        try {
          localStorage.removeItem(`aethoflix_resume_${storageKey}`);
        } catch {}
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
  }, [autoplay, onReady, storageKey]);

  return (
    <div
      ref={wrapperRef}
      data-vjs-player
      className={`w-full h-full relative overflow-hidden rounded-xl bg-black ${className}`}
    >
      {/* Autoplay Muted Notice */}
      {isMutedAutoplay && (
        <button
          type="button"
          onClick={() => {
            const video = wrapperRef.current?.querySelector("video");
            if (video) {
              video.muted = false;
              setIsMutedAutoplay(false);
            }
          }}
          className="absolute top-4 left-4 z-50 flex items-center gap-2 rounded-full bg-indigo-600/90 hover:bg-indigo-600 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-xl border border-indigo-400/40 cursor-pointer animate-in fade-in"
        >
          <VolumeX className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
          <span>Autoplay muted — Tap to Unmute</span>
        </button>
      )}

      {/* Auto-Resume Timestamp Toast */}
      {resumedNotice && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-1.5 rounded-lg bg-black/80 px-3 py-1.5 text-xs text-emerald-400 backdrop-blur-md border border-emerald-500/30 shadow-lg animate-in fade-in">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{resumedNotice}</span>
        </div>
      )}

      <VideoPlayer poster={poster}>
        <VideoSkin style={{ width: "100%", height: "100%" }}>
          {isHls ? (
            <HlsJsVideo
              src={src}
              autoPlay={autoplay}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onError={(e) => onError?.(e)}
            />
          ) : (
            <Video
              src={src}
              autoPlay={autoplay}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onError={(e) => onError?.(e)}
            />
          )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
}

export default VideoJSPlayer;
