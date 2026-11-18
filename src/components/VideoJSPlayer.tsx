"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  Subtitles,
  Gauge,
  Check,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export type VideoJsPlayer = Player;

export interface SubtitleTrack {
  lang?: string;
  label?: string;
  url?: string;
  format?: string;
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

export interface QualityOption {
  id: string;
  height: number;
  label: string;
  bitrate?: number;
}

export interface AudioOption {
  index: number;
  label: string;
  language: string;
}

export interface SubtitleOption {
  id: string;
  label: string;
  language: string;
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

export function VideoJSPlayer({
  src,
  type,
  poster,
  autoplay = true,
  controls = true,
  className = "",
  storageKey,
  subtitles,
  availableAudio,
  availableQualities,
  onReady,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vjsPlayerRef = useRef<Player | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);

  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [useNativeCleanStream, setUseNativeCleanStream] = useState<boolean>(true);

  // ── Quick Settings State ──
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"quality" | "audio" | "subtitles" | "speed">("quality");

  // Quality
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number | "auto">("auto");

  // Audio Tracks
  const [audioOptions, setAudioOptions] = useState<AudioOption[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number>(0);

  // Subtitles
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOption[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");

  // Playback Speed
  const [selectedSpeed, setSelectedSpeed] = useState<number>(1);
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  const subtitlesRef = useRef(subtitles);
  subtitlesRef.current = subtitles;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isHls =
    src.includes(".m3u8") ||
    type === "application/x-mpegURL" ||
    (!src.includes(".mp4") && !src.includes(".webm"));

  // ── Native Fullscreen Engine ──
  const openInNativeDevicePlayer = useCallback((targetVideo?: HTMLVideoElement | null) => {
    const video =
      targetVideo ||
      nativeVideoRef.current ||
      containerRef.current?.querySelector("video") ||
      (document.querySelector("#cleanVideoPlayer") as HTMLVideoElement);

    if (!video) return false;

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
              video.play().catch(() => {});
            }
          };
          video.addEventListener("webkitbeginfullscreen", onBeginIOS);

          const onExitIOS = function () {
            video.removeEventListener("webkitendfullscreen", onExitIOS);
            if (wasPlaying && video.paused) {
              video.play().catch(() => {});
            }
          };
          video.addEventListener("webkitendfullscreen", onExitIOS);

          (video as any).webkitEnterFullscreen();
          return true;
        } catch (err) {
          console.warn("[CleanStream] iOS webkitEnterFullscreen error:", err);
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
                video.play().catch(() => {});
              }
            }
          };
          document.addEventListener("fullscreenchange", onFsChange);
          document.addEventListener("webkitfullscreenchange", onFsChange);

          const promise = reqVideoFs.call(video);
          if (promise && typeof promise.catch === "function") {
            promise.catch(() => fallbackContainerFullscreen());
          }
          return true;
        } catch (err) {
          console.warn("[CleanStream] Android video fullscreen error:", err);
        }
      }
    }

    return fallbackContainerFullscreen();

    function fallbackContainerFullscreen() {
      const cont = containerRef.current || document.documentElement;
      const reqCont =
        cont.requestFullscreen ||
        (cont as any).webkitRequestFullscreen ||
        (cont as any).mozRequestFullScreen ||
        (cont as any).msRequestFullscreen;

      if (reqCont) {
        try {
          reqCont.call(cont);
          return true;
        } catch {}
      }
      return false;
    }
  }, []);

  // Fullscreen Message Listener
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (
        e.data &&
        (e.data.type === "CLEANSTREAM_NATIVE_FULLSCREEN" ||
          e.data === "CLEANSTREAM_NATIVE_FULLSCREEN")
      ) {
        openInNativeDevicePlayer();
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [openInNativeDevicePlayer]);

  // Close Settings on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen]);

  // ── Quality Switching Handler ──
  const handleSelectQuality = useCallback((targetHeight: number | "auto") => {
    setSelectedQuality(targetHeight);
    const player = vjsPlayerRef.current;
    if (!player) return;

    if (typeof (player as any).qualityLevels === "function") {
      const ql = (player as any).qualityLevels();
      for (let i = 0; i < ql.length; i++) {
        const level = ql[i];
        const h = level.height || (level.width ? Math.round((level.width * 9) / 16) : 0);
        if (targetHeight === "auto") {
          level.enabled = true;
        } else {
          level.enabled = h === targetHeight;
        }
      }
    }
  }, []);

  // ── Audio Track Switching Handler ──
  const handleSelectAudio = useCallback((index: number) => {
    setSelectedAudioIndex(index);
    const player = vjsPlayerRef.current;
    if (!player) return;

    if (typeof player.audioTracks === "function") {
      const atList = player.audioTracks() as any;
      for (let i = 0; i < atList.length; i++) {
        if (atList[i]) {
          atList[i].enabled = i === index;
        }
      }
    }
  }, []);

  // ── Subtitle Switching Handler ──
  const handleSelectSubtitle = useCallback((id: string) => {
    setSelectedSubtitle(id);
    const player = vjsPlayerRef.current;
    if (!player) return;

    const tracks = player.textTracks() as any;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track) {
        if (id === "off") {
          track.mode = "disabled";
        } else {
          const trackId = track.id || track.language || `sub-${i}`;
          track.mode = trackId === id ? "showing" : "disabled";
        }
      }
    }
  }, []);

  // ── Speed Switching Handler ──
  const handleSelectSpeed = useCallback((speed: number) => {
    setSelectedSpeed(speed);
    const player = vjsPlayerRef.current;
    if (player) {
      player.playbackRate(speed);
    }
  }, []);

  // ── Player Initialization ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !src) return;

    let isDisposed = false;

    setUseNativeCleanStream(false);
    container.innerHTML = "";

    const videoElement = document.createElement("video-js");
    videoElement.classList.add(
      "vjs-big-play-centered",
      "vjs-fluid",
      "vjs-default-skin",
      "cleanstream-vjs"
    );
    container.appendChild(videoElement);

    const player = (vjsPlayerRef.current = videojs(
      videoElement,
      {
        autoplay: true,
        muted: false,
        controls,
        responsive: true,
        fluid: true,
        poster,
        preload: "auto",
        playbackRates: speedOptions,
        controlBar: {
          skipButtons: { forward: 10, backward: 10 },
          subsCapsButton: true,
          audioTrackButton: true,
        },
        html5: {
          vhs: {
            overrideNative: true,
            initialBufferLength: 0.5,
            maxBufferLength: 30,
            fastQualityChange: true,
            handlePartialData: true,
          },
        },
        sources: [
          {
            src,
            type: isHls ? "application/x-mpegURL" : "video/mp4",
          },
        ],
      },
      () => {
        if (isDisposed) return;
        onReadyRef.current?.(player);

        // Auto-resume from saved position
        const key = storageKeyRef.current;
        if (key) {
          try {
            const saved = localStorage.getItem(`aethoflix_resume_${key}`);
            if (saved) {
              const time = parseFloat(saved);
              if (time > 5) {
                player.currentTime(time);
                setResumedNotice(`Resumed at ${formatTime(time)}`);
                setTimeout(() => setResumedNotice(null), 3500);
              }
            }
          } catch {}
        }

        // First frame playback detection
        player.one("playing", () => {
          if (isDisposed) return;
          onFirstFrameRef.current?.();
        });
        player.one("timeupdate", () => {
          if (isDisposed) return;
          if ((player.currentTime() || 0) > 0.1) {
            onFirstFrameRef.current?.();
          }
        });

        // ── 1. Setup Quality Levels ──
        if (typeof (player as any).qualityLevels === "function") {
          const ql = (player as any).qualityLevels();
          const syncQualities = () => {
            const levels: QualityOption[] = [];
            const seen = new Set<number>();
            for (let i = 0; i < ql.length; i++) {
              const level = ql[i];
              const h = level.height || (level.width ? Math.round((level.width * 9) / 16) : 0);
              if (h && !seen.has(h)) {
                seen.add(h);
                levels.push({
                  id: `ql-${i}`,
                  height: h,
                  label: h >= 1080 ? `${h}p FHD` : h >= 720 ? `${h}p HD` : `${h}p`,
                  bitrate: level.bitrate,
                });
              }
            }
            levels.sort((a, b) => b.height - a.height);
            if (levels.length > 0) {
              setQualityOptions(levels);
            }
          };

          ql.on("addqualitylevel", syncQualities);
          ql.on("change", syncQualities);
          syncQualities();
        }

        // Fallback quality levels if HLS manifest levels aren't exposed yet
        setTimeout(() => {
          setQualityOptions((prev) => {
            if (prev.length > 0) return prev;
            return [
              { id: "1080", height: 1080, label: "1080p FHD" },
              { id: "720", height: 720, label: "720p HD" },
              { id: "480", height: 480, label: "480p SD" },
            ];
          });
        }, 1200);

        // ── 2. Setup Audio Tracks ──
        if (typeof player.audioTracks === "function") {
          const atList = player.audioTracks() as any;
          const syncAudio = () => {
            const tracks: AudioOption[] = [];
            for (let i = 0; i < atList.length; i++) {
              const t = atList[i];
              if (!t) continue;
              tracks.push({
                index: i,
                label: t.label || t.language || `Audio ${i + 1}`,
                language: t.language || "",
              });
              if (t.enabled) {
                setSelectedAudioIndex(i);
              }
            }
            if (tracks.length > 0) {
              setAudioOptions(tracks);
            }
          };

          atList.on("addtrack", syncAudio);
          atList.on("removetrack", syncAudio);
          atList.on("change", syncAudio);
          syncAudio();
        }

        // Fallback audio from availableAudio prop
        if (availableAudio) {
          const langs = Array.isArray(availableAudio) ? availableAudio : [availableAudio];
          const langNames: Record<string, string> = {
            en: "English",
            hi: "Hindi",
            es: "Spanish",
            fr: "French",
            ja: "Japanese",
            ko: "Korean",
            de: "German",
          };
          setAudioOptions((prev) => {
            if (prev.length > 0) return prev;
            return langs.map((l, i) => ({
              index: i,
              label: langNames[l.toLowerCase()] || l.toUpperCase(),
              language: l,
            }));
          });
        }

        // ── 3. Add Remote Subtitles ──
        const subs = subtitlesRef.current;
        if (subs && subs.length > 0) {
          const collectedSubs: SubtitleOption[] = [];
          subs.forEach((sub, idx) => {
            if (!sub.url) return;
            const subId = `sub-${idx}-${sub.lang || "en"}`;
            const subLabel = sub.label || sub.lang?.toUpperCase() || `Subtitle ${idx + 1}`;
            collectedSubs.push({
              id: subId,
              label: subLabel,
              language: sub.lang || "en",
            });

            try {
              player.addRemoteTextTrack(
                {
                  id: subId,
                  kind: "subtitles",
                  src: sub.url,
                  srclang: sub.lang || "en",
                  label: subLabel,
                  default: false,
                },
                false
              );
            } catch (err) {
              console.warn("[VideoJS] addRemoteTextTrack error:", err);
            }
          });
          setSubtitleOptions(collectedSubs);
        }

        // Sync native in-manifest text tracks
        const syncTextTracks = () => {
          const tList = player.textTracks() as any;
          const items: SubtitleOption[] = [];
          for (let i = 0; i < tList.length; i++) {
            const tr = tList[i];
            if (!tr) continue;
            if (tr.kind === "subtitles" || tr.kind === "captions") {
              const id = tr.id || tr.language || `text-track-${i}`;
              items.push({
                id,
                label: tr.label || tr.language || `Subtitle ${i + 1}`,
                language: tr.language || "",
              });
              if (tr.mode === "showing") {
                setSelectedSubtitle(id);
              }
            }
          }
          if (items.length > 0) {
            setSubtitleOptions((prev) => {
              const combined = [...prev];
              for (const it of items) {
                if (!combined.some((c) => c.id === it.id || c.label === it.label)) {
                  combined.push(it);
                }
              }
              return combined;
            });
          }
        };

        const tList = player.textTracks() as any;
        if (tList && typeof tList.on === "function") {
          tList.on("addtrack", syncTextTracks);
          tList.on("removetrack", syncTextTracks);
          syncTextTracks();
        }
      }
    ));

    player.on("timeupdate", () => {
      const key = storageKeyRef.current;
      if (!key) return;
      const ct = player.currentTime();
      const dur = player.duration();
      if (ct && ct > 5 && dur && dur - ct > 15) {
        try {
          localStorage.setItem(`aethoflix_resume_${key}`, String(Math.floor(ct)));
        } catch {}
      }
    });

    player.on("ended", () => {
      const key = storageKeyRef.current;
      if (key) {
        try {
          localStorage.removeItem(`aethoflix_resume_${key}`);
        } catch {}
      }
    });

    player.on("error", () => {
      if (isDisposed) return;
      const err = player.error();
      console.warn("[CleanStream Error]", err);
      onErrorRef.current?.(err);
    });

    return () => {
      isDisposed = true;
      if (vjsPlayerRef.current && !vjsPlayerRef.current.isDisposed()) {
        try {
          vjsPlayerRef.current.dispose();
        } catch {}
        vjsPlayerRef.current = null;
      }
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [src, isHls, controls, poster, availableAudio]);

  // Active display label for Quick Settings badge
  const activeQualityLabel = useMemo(() => {
    if (selectedQuality === "auto") return "Auto";
    return `${selectedQuality}p`;
  }, [selectedQuality]);

  const activeAudioLabel = useMemo(() => {
    if (audioOptions.length === 0) return "Default";
    return audioOptions[selectedAudioIndex]?.label || "Audio";
  }, [audioOptions, selectedAudioIndex]);

  const activeSubtitleLabel = useMemo(() => {
    if (selectedSubtitle === "off") return "Off";
    const found = subtitleOptions.find((s) => s.id === selectedSubtitle);
    return found?.label || "On";
  }, [selectedSubtitle, subtitleOptions]);

  return (
    <div
      data-vjs-player
      className={`group relative w-full h-full overflow-hidden bg-black select-none ${className}`}
    >
      {/* Auto-Resume Timestamp Toast */}
      {resumedNotice && (
        <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 rounded-lg bg-black/85 px-3 py-1.5 text-xs text-emerald-400 backdrop-blur-md border border-emerald-500/30 shadow-lg pointer-events-none">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{resumedNotice}</span>
        </div>
      )}

      {/* ── Netflix-Style Quick Settings Menu Button (Top Right Floating Badge) ── */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsSettingsOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium backdrop-blur-xl transition-all duration-200 cursor-pointer shadow-2xl ${
            isSettingsOpen
              ? "bg-[#e50914] text-white ring-2 ring-red-500/50"
              : "bg-black/75 text-white/90 border border-white/15 hover:bg-black/90 hover:text-white hover:border-white/30"
          }`}
          title="Playback Settings (Quality, Audio, Subtitles, Speed)"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-semibold tracking-wide">Settings</span>
          <div className="hidden sm:flex items-center gap-1.5 border-l border-white/20 pl-2">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-cyan-300">
              {activeQualityLabel}
            </span>
            {selectedSubtitle !== "off" && (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-red-300">
                CC: {activeSubtitleLabel.slice(0, 8)}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* ── Netflix-Style Quick Settings Popover Menu ── */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-200">
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#0e1015]/95 border border-white/15 shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold tracking-wide">Playback Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-black/30 p-1.5 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("quality")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all cursor-pointer ${
                  activeTab === "quality"
                    ? "bg-[#e50914] text-white shadow-md"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Quality</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audio")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all cursor-pointer ${
                  activeTab === "audio"
                    ? "bg-[#e50914] text-white shadow-md"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Audio</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("subtitles")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all cursor-pointer ${
                  activeTab === "subtitles"
                    ? "bg-[#e50914] text-white shadow-md"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Subtitles className="h-3.5 w-3.5" />
                <span>Subtitles</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("speed")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all cursor-pointer ${
                  activeTab === "speed"
                    ? "bg-[#e50914] text-white shadow-md"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Gauge className="h-3.5 w-3.5" />
                <span>Speed</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-1.5">
              {/* 1. Quality Tab */}
              {activeTab === "quality" && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSelectQuality("auto")}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                      selectedQuality === "auto"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "hover:bg-white/5 text-neutral-300"
                    }`}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">Auto (Recommended)</span>
                      <span className="text-[10px] text-neutral-400">Dynamically adapts to your network</span>
                    </div>
                    {selectedQuality === "auto" && <Check className="h-4 w-4 text-cyan-400" />}
                  </button>

                  {qualityOptions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleSelectQuality(q.height)}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                        selectedQuality === q.height
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "hover:bg-white/5 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono tabular-nums">{q.label}</span>
                        {q.height >= 1080 && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                            FHD
                          </span>
                        )}
                        {q.height === 720 && (
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                            HD
                          </span>
                        )}
                      </div>
                      {selectedQuality === q.height && <Check className="h-4 w-4 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}

              {/* 2. Audio Tab */}
              {activeTab === "audio" && (
                <div className="space-y-1">
                  {audioOptions.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-400">
                      Single audio track (Default / Original Audio)
                    </div>
                  ) : (
                    audioOptions.map((a) => (
                      <button
                        key={`audio-${a.index}`}
                        type="button"
                        onClick={() => handleSelectAudio(a.index)}
                        className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                          selectedAudioIndex === a.index
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "hover:bg-white/5 text-neutral-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{a.label}</span>
                          {a.language && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 uppercase">
                              {a.language}
                            </span>
                          )}
                        </div>
                        {selectedAudioIndex === a.index && <Check className="h-4 w-4 text-cyan-400" />}
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
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                      selectedSubtitle === "off"
                        ? "bg-red-500/20 text-red-300 border border-red-500/40"
                        : "hover:bg-white/5 text-neutral-300"
                    }`}
                  >
                    <span>Subtitles Off</span>
                    {selectedSubtitle === "off" && <Check className="h-4 w-4 text-red-400" />}
                  </button>

                  {subtitleOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSubtitle(s.id)}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                        selectedSubtitle === s.id
                          ? "bg-red-500/20 text-red-300 border border-red-500/40"
                          : "hover:bg-white/5 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Subtitles className="h-3.5 w-3.5 text-neutral-400" />
                        <span>{s.label}</span>
                        {s.language && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 uppercase">
                            {s.language}
                          </span>
                        )}
                      </div>
                      {selectedSubtitle === s.id && <Check className="h-4 w-4 text-red-400" />}
                    </button>
                  ))}
                </div>
              )}

              {/* 4. Speed Tab */}
              {activeTab === "speed" && (
                <div className="space-y-1">
                  {speedOptions.map((sp) => (
                    <button
                      key={`speed-${sp}`}
                      type="button"
                      onClick={() => handleSelectSpeed(sp)}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-medium transition-all cursor-pointer ${
                        selectedSpeed === sp
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "hover:bg-white/5 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span>{sp === 1 ? "1.0x (Normal)" : `${sp}x`}</span>
                      </div>
                      {selectedSpeed === sp && <Check className="h-4 w-4 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 bg-black/40 px-5 py-2.5 text-center text-[11px] text-neutral-400">
              High-Bitrate Direct CDN Engine · Press Esc to close
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default VideoJSPlayer;
