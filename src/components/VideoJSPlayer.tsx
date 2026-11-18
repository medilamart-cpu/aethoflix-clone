"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import {
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  Subtitles as SubtitlesIcon,
  Gauge,
  Check,
  X,
} from "lucide-react";

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
 * Incorporates:
 * - Direct CDN multi-source quality switching (Auto, 720p, 480p, 360p)
 * - Direct CDN multi-language audio switching (English, Hindi, Tamil, Telugu, Spanish, French, etc.)
 * - Direct CDN multi-language subtitles binding via <track> elements
 * - Seamless timestamp preservation during quality/audio transitions
 * - Netflix-themed Video.js Quick Settings modal
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

  // Sync activeSrc if prop src changes externally
  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  // ── Quick Settings State ──
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"quality" | "audio" | "subtitles" | "speed">("quality");

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

  // Normalize Audio Tracks from direct CDN source
  const audioList = useMemo<AudioItem[]>(() => {
    if (!availableAudio) return [];
    if (Array.isArray(availableAudio)) {
      const items: AudioItem[] = [];
      const seen = new Set<string>();
      for (const a of availableAudio) {
        if (typeof a === "string") {
          if (!seen.has(a)) {
            seen.add(a);
            items.push({ language: a, label: a.toUpperCase(), url: src });
          }
        } else if (a && typeof a === "object") {
          const lang = a.language || a.lang || "en";
          if (!seen.has(lang)) {
            seen.add(lang);
            items.push({
              language: lang,
              label: a.label || lang.toUpperCase(),
              url: a.url || src,
            });
          }
        }
      }
      return items;
    }
    return [];
  }, [availableAudio, src]);

  const [selectedQuality, setSelectedQuality] = useState<string>("Auto");
  const [selectedAudio, setSelectedAudio] = useState<string>("en");
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");
  const [selectedSpeed, setSelectedSpeed] = useState<number>(1);
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Restore timestamp seamlessly after switching stream source (quality or audio)
  const handleMediaCanPlay = useCallback(() => {
    onFirstFrame?.();
    const video = document.querySelector("video");
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
      const video = document.querySelector("video");
      if (video) pendingSeekRef.current = video.currentTime;
      setActiveSrc(q.url);
    }
    setIsSettingsOpen(false);
  };

  // Handle Audio Selection
  const handleSelectAudio = (a: AudioItem) => {
    setSelectedAudio(a.language);
    if (a.url && a.url !== activeSrc) {
      const video = document.querySelector("video");
      if (video) pendingSeekRef.current = video.currentTime;
      setActiveSrc(a.url);
    }
    setIsSettingsOpen(false);
  };

  // Handle Subtitle Selection
  const handleSelectSubtitle = (subLang: string) => {
    setSelectedSubtitle(subLang);
    const video = document.querySelector("video");
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if (subLang === "off") {
          track.mode = "disabled";
        } else if (
          track.language?.toLowerCase() === subLang.toLowerCase() ||
          track.label?.toLowerCase() === subLang.toLowerCase()
        ) {
          track.mode = "showing";
        } else {
          track.mode = "disabled";
        }
      }
    }
    setIsSettingsOpen(false);
  };

  // Handle Playback Speed Selection
  const handleSelectSpeed = (sp: number) => {
    setSelectedSpeed(sp);
    const video = document.querySelector("video");
    if (video) video.playbackRate = sp;
    setIsSettingsOpen(false);
  };

  const isHls =
    activeSrc.includes(".m3u8") ||
    (!activeSrc.includes(".mp4") && !activeSrc.includes(".webm"));

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}>
      {/* Video.js Quick Settings Trigger Button */}
      <button
        type="button"
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        title="Stream Settings"
        className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1.5 rounded-lg bg-black/80 hover:bg-neutral-900 px-2.5 py-1 text-xs font-medium text-neutral-200 border border-white/15 backdrop-blur-md shadow-lg transition cursor-pointer"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-red-500" />
        <span className="hidden sm:inline">Settings</span>
        {selectedQuality !== "Auto" && (
          <span className="ml-0.5 rounded bg-red-600/30 px-1 py-0.2 text-[10px] text-red-400 font-mono">
            {selectedQuality}
          </span>
        )}
      </button>

      {/* Video.js Quick Settings Modal */}
      {isSettingsOpen && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-neutral-950/95 border border-white/15 p-5 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold tracking-wide">Player Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-neutral-900/90 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("quality")}
                className={`py-1.5 rounded-lg font-medium transition ${
                  activeTab === "quality"
                    ? "bg-red-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Quality
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                className={`py-1.5 rounded-lg font-medium transition ${
                  activeTab === "audio"
                    ? "bg-red-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Audio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("subtitles")}
                className={`py-1.5 rounded-lg font-medium transition ${
                  activeTab === "subtitles"
                    ? "bg-red-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Subtitles
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("speed")}
                className={`py-1.5 rounded-lg font-medium transition ${
                  activeTab === "speed"
                    ? "bg-red-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Speed
              </button>
            </div>

            {/* Tab Contents */}
            <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5">
              {/* 1. Quality Tab */}
              {activeTab === "quality" && (
                <div className="space-y-1">
                  {qualityList.map((q) => (
                    <button
                      key={q.quality}
                      type="button"
                      onClick={() => handleSelectQuality(q)}
                      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                        selectedQuality === q.quality
                          ? "bg-red-600/20 text-red-400 border border-red-500/30"
                          : "hover:bg-white/5 text-neutral-300"
                      }`}
                    >
                      <span>{q.quality}</span>
                      {selectedQuality === q.quality && <Check className="h-3.5 w-3.5 text-red-500" />}
                    </button>
                  ))}
                </div>
              )}

              {/* 2. Audio Tab */}
              {activeTab === "audio" && (
                <div className="space-y-1">
                  {audioList.length === 0 ? (
                    <div className="py-4 text-center text-xs text-neutral-400">
                      Single audio stream provided by CDN
                    </div>
                  ) : (
                    audioList.map((a) => (
                      <button
                        key={a.language}
                        type="button"
                        onClick={() => handleSelectAudio(a)}
                        className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                          selectedAudio === a.language
                            ? "bg-red-600/20 text-red-400 border border-red-500/30"
                            : "hover:bg-white/5 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{a.label}</span>
                        </div>
                        {selectedAudio === a.language && <Check className="h-3.5 w-3.5 text-red-500" />}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* 3. Subtitles Tab */}
              {activeTab === "subtitles" && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSelectSubtitle("off")}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                      selectedSubtitle === "off"
                        ? "bg-red-600/20 text-red-400 border border-red-500/30"
                        : "hover:bg-white/5 text-neutral-300"
                    }`}
                  >
                    <span>Off</span>
                    {selectedSubtitle === "off" && <Check className="h-3.5 w-3.5 text-red-500" />}
                  </button>
                  {subtitles.map((sub, idx) => {
                    const langKey = sub.lang || sub.label || `track-${idx}`;
                    const isSelected = selectedSubtitle === langKey;
                    return (
                      <button
                        key={langKey}
                        type="button"
                        onClick={() => handleSelectSubtitle(langKey)}
                        className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-red-600/20 text-red-400 border border-red-500/30"
                            : "hover:bg-white/5 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <SubtitlesIcon className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{sub.label || sub.lang || `Track ${idx + 1}`}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-red-500" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Speed Tab */}
              {activeTab === "speed" && (
                <div className="space-y-1">
                  {speedOptions.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => handleSelectSpeed(sp)}
                      className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                        selectedSpeed === sp
                          ? "bg-red-600/20 text-red-400 border border-red-500/30"
                          : "hover:bg-white/5 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <Gauge className="h-3.5 w-3.5 text-neutral-400" />
                        <span>{sp === 1 ? "1.0x (Normal)" : `${sp}x`}</span>
                      </div>
                      {selectedSpeed === sp && <Check className="h-3.5 w-3.5 text-red-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
