"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { Menu } from "@videojs/react";
import { QualityIcon, CheckIcon } from "@videojs/react/icons";
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
 * Video.js Native Quality Menu Component
 * Placed directly within the Video.js controls layer (bottom control bar)
 * Leverages official Video.js Menu primitives and icons:
 * - Menu.Root, Menu.Trigger, Menu.Popup, Menu.Content, Menu.RadioGroup, Menu.RadioItem
 * - QualityIcon, CheckIcon from @videojs/react/icons
 */
function VideoJSQualityControl({
  qualityList,
  selectedQuality,
  onSelectQuality,
}: {
  qualityList: QualityItem[];
  selectedQuality: string;
  onSelectQuality: (q: QualityItem) => void;
}) {
  if (!qualityList || qualityList.length <= 1) return null;

  return (
    <div className="flex items-center">
      <Menu.Root side="top" align="center">
        <Menu.Trigger
          className="media-button video-controls-settings-button flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-300 hover:text-white rounded-md transition cursor-pointer select-none"
          aria-label="Quality"
          title="Stream Quality"
        >
          <QualityIcon className="media-button-icon-base w-4 h-4 text-neutral-300" />
          <span className="text-[11px] font-mono font-medium tracking-tight text-neutral-200">
            {selectedQuality}
          </span>
        </Menu.Trigger>
        <Menu.Popup
          keepMounted
          className="media-popup media-popup-surface media-menu-popup z-50 min-w-[130px] rounded-xl bg-neutral-950/95 border border-white/15 p-1.5 shadow-2xl backdrop-blur-md"
        >
          <Menu.Content className="media-menu-content flex flex-col gap-0.5">
            <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 mb-1">
              Quality
            </div>
            <Menu.RadioGroup
              value={selectedQuality}
              onValueChange={(val) => {
                const target = qualityList.find((q) => q.quality === val);
                if (target) onSelectQuality(target);
              }}
            >
              {qualityList.map((q) => {
                const isSelected = selectedQuality === q.quality;
                return (
                  <Menu.RadioItem
                    key={q.quality}
                    value={q.quality}
                    className={`media-menu-radio-item flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-red-600/20 text-red-400 border border-red-500/30"
                        : "text-neutral-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{q.quality}</span>
                    {isSelected && <CheckIcon className="w-3.5 h-3.5 text-red-500" />}
                  </Menu.RadioItem>
                );
              })}
            </Menu.RadioGroup>
          </Menu.Content>
        </Menu.Popup>
      </Menu.Root>
    </div>
  );
}

/**
 * Modern Video.js 10 React Player Component
 * Architecture:
 * - Zero ad-hoc floating buttons in corners; controls are strictly housed in Video.js's controls layer
 * - Native Video.js control bar with Quality Control, Captions, Fullscreen, Volume, and Seek
 * - Direct CDN multi-source quality switching integrated with Video.js Menu primitives
 * - Direct CDN multi-language subtitles binding via standard <track> elements
 * - Seamless timestamp preservation during quality transitions
 * - Obsidian dark glass (#050505) aesthetic with signature Netflix crimson (#e50914) accent
 */
export function VideoJSPlayer({
  src,
  poster,
  autoplay = true,
  controls = true,
  className = "",
  subtitles = [],
  availableAudio,
  availableQualities,
  storageKey,
  onReady,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const [activeSrc, setActiveSrc] = useState<string>(src);
  const pendingSeekRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlsHost, setControlsHost] = useState<Element | null>(null);

  // Sync activeSrc if prop src changes externally
  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  // Find Video.js native controls container to portal quality control into the bottom bar
  useEffect(() => {
    const findHost = () => {
      if (!containerRef.current) return false;
      const primary = containerRef.current.querySelector(".video-controls-primary");
      if (primary) {
        setControlsHost(primary);
        return true;
      }
      return false;
    };

    if (!findHost()) {
      const interval = setInterval(() => {
        if (findHost()) clearInterval(interval);
      }, 100);
      const timeout = setTimeout(() => clearInterval(interval), 3000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  // Normalize Qualities from direct CDN source
  const qualityList = useMemo<QualityItem[]>(() => {
    if (!availableQualities) return [{ quality: "Auto", url: src }];
    if (Array.isArray(availableQualities)) {
      const items: QualityItem[] = [];
      const seen = new Set<string>();
      for (const q of availableQualities) {
        if (typeof q === "string") {
          if (!seen.has(q)) {
            seen.add(q);
            items.push({ quality: q, url: src });
          }
        } else if (q && typeof q === "object") {
          const name = q.quality || q.label || "Auto";
          if (!seen.has(name)) {
            seen.add(name);
            items.push({ quality: name, url: q.url || src });
          }
        }
      }
      return items.length > 0 ? items : [{ quality: "Auto", url: src }];
    }
    return [{ quality: "Auto", url: src }];
  }, [availableQualities, src]);

  const [selectedQuality, setSelectedQuality] = useState<string>("Auto");

  // Restore timestamp seamlessly after switching stream quality
  const handleMediaCanPlay = useCallback(() => {
    onFirstFrame?.();
    const video = containerRef.current?.querySelector("video") || document.querySelector("video");
    if (video && pendingSeekRef.current !== null && isFinite(pendingSeekRef.current)) {
      const t = pendingSeekRef.current;
      pendingSeekRef.current = null;
      try {
        video.currentTime = t;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => { });
      } catch { }
    }
  }, [onFirstFrame]);

  // Handle Quality Selection
  const handleSelectQuality = (q: QualityItem) => {
    setSelectedQuality(q.quality);
    if (q.url && q.url !== activeSrc) {
      const video = containerRef.current?.querySelector("video") || document.querySelector("video");
      if (video) pendingSeekRef.current = video.currentTime;
      setActiveSrc(q.url);
    }
  };

  const isHls =
    activeSrc.includes(".m3u8") ||
    (!activeSrc.includes(".mp4") && !activeSrc.includes(".webm"));

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}
    >
      {/* Video.js Quality Control mounted directly inside Video.js bottom control bar */}
      {controlsHost &&
        qualityList.length > 1 &&
        createPortal(
          <VideoJSQualityControl
            qualityList={qualityList}
            selectedQuality={selectedQuality}
            onSelectQuality={handleSelectQuality}
          />,
          controlsHost
        )}

      {/* Main Video.js Player Tree */}
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
              src={activeSrc}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={handleMediaCanPlay}
              onCanPlay={handleMediaCanPlay}
              onPlay={handleMediaCanPlay}
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
              src={activeSrc}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={handleMediaCanPlay}
              onCanPlay={handleMediaCanPlay}
              onPlay={handleMediaCanPlay}
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
