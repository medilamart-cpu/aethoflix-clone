"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { useMedia } from "@videojs/react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { RotateCcw, Volume2, AudioLines, Check } from "lucide-react";

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
  onAudioChange?: (audio: any) => void;
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
  availableAudio,
  onAudioChange,
}: {
  storageKey?: string;
  onFirstFrame?: () => void;
  onError?: (err: any) => void;
  availableAudio?: AudioItem[] | string[] | any;
  onAudioChange?: (audio: any) => void;
}) {
  const store = usePlayer();
  const media = useMedia() as any;
  const currentTime = usePlayer((s: any) => s?.currentTime ?? 0);
  const duration = usePlayer((s: any) => s?.duration ?? 0);
  const paused = usePlayer((s: any) => s?.paused ?? true);
  const error = usePlayer((s: any) => s?.error);

  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const hasResumedRef = useRef(false);
  const hasNotifiedFirstFrameRef = useRef(false);
  const populatingAudioRef = useRef(false);

  const userSelectedAudioRef = useRef(false);
  const hasAutoSelectedRef = useRef(false);

  // Normalize audio candidate list with numeric-compatible IDs
  const normalizedAudios = useMemo(() => {
    const list: Array<{ id: string; label: string; language: string; url?: string }> = [];

    if (Array.isArray(availableAudio) && availableAudio.length > 0) {
      availableAudio.forEach((item: any, idx: number) => {
        if (typeof item === "string") {
          const lang = item.trim();
          if (lang) {
            list.push({
              id: String(idx),
              label: lang.charAt(0).toUpperCase() + lang.slice(1),
              language: lang.toLowerCase(),
            });
          }
        } else if (item && typeof item === "object") {
          const lang = (item.language || item.lang || "en").toLowerCase();
          const label = item.label || item.language || `Track ${idx + 1}`;
          list.push({
            id: String(idx),
            label,
            language: lang,
            url: item.url,
          });
        }
      });
    } else if (typeof availableAudio === "string" && availableAudio.trim()) {
      const parts = availableAudio.split(",");
      parts.forEach((p: string, idx: number) => {
        const lang = p.trim();
        if (lang) {
          list.push({
            id: String(idx),
            label: lang.charAt(0).toUpperCase() + lang.slice(1),
            language: lang.toLowerCase(),
          });
        }
      });
    }

    // Always ensure at least 2 tracks so AudioTrackMenu is never hidden by AudioTrackRadioGroupCore
    if (list.length <= 1) {
      const primary = list[0]?.label || "English (Original)";
      list.length = 0;
      list.push(
        { id: "0", label: primary, language: "en" },
        { id: "1", label: "Multi-Audio / Stereo", language: "mul" }
      );
    }

    return list;
  }, [availableAudio]);

  // Sync and manage audio tracks with native engine and Video.js
  useEffect(() => {
    if (!media) return;

    // Helper to auto-select English if default track is foreign (e.g. Hindi track 0)
    // Runs AT MOST ONCE on initial stream launch and NEVER overrides user selection
    const maybeAutoSelectEnglish = () => {
      if (userSelectedAudioRef.current || hasAutoSelectedRef.current) return;
      const engine = media.engine;
      if (engine && Array.isArray(engine.audioTracks) && engine.audioTracks.length > 1) {
        const engIdx = engine.audioTracks.findIndex((t: any) => {
          const l = (t.lang || "").toLowerCase();
          const n = (t.name || "").toLowerCase();
          return l === "en" || l === "eng" || n.includes("english");
        });
        if (engIdx !== -1) {
          hasAutoSelectedRef.current = true;
          if (engine.audioTrack !== engIdx) {
            console.log(`[VideoJS] Auto-selecting initial English audio track at index ${engIdx}`);
            engine.audioTrack = engIdx;
          }
        }
      }
    };

    const populateAudioTracks = () => {
      if (populatingAudioRef.current) return;
      if (!media.audioTracks) return;

      // If tracks already present from hls.js or native demuxer, do NOT delete them!
      if (media.audioTracks.length > 0) {
        maybeAutoSelectEnglish();
        return;
      }

      populatingAudioRef.current = true;
      try {
        normalizedAudios.forEach((item, idx) => {
          if (typeof media.addAudioTrack === "function") {
            const track = media.addAudioTrack(idx === 0 ? "main" : "alternative", item.label, item.language);
            if (track) {
              track.id = item.id;
              if (idx === 0) track.enabled = true;
            }
          }
        });
      } catch { }

      setTimeout(() => {
        populatingAudioRef.current = false;
        maybeAutoSelectEnglish();
      }, 80);
    };

    populateAudioTracks();

    // Listen for media readiness & track list changes to maintain tracks
    const onMediaReady = () => populateAudioTracks();
    media.addEventListener?.("loadedmetadata", onMediaReady);
    media.addEventListener?.("canplay", onMediaReady);

    // Listen for user audio track switch in native Video.js menu
    const onTrackChange = () => {
      if (populatingAudioRef.current || !media.audioTracks) return;
      try {
        const tracks = [...media.audioTracks];
        const selected = tracks.find((t: any) => t.enabled);
        if (selected) {
          userSelectedAudioRef.current = true;
          hasAutoSelectedRef.current = true;

          const selectedLang = (selected.language || "").toLowerCase();
          const selectedLabel = (selected.label || "").toLowerCase();
          const selectedIdNum = Number(selected.id);

          // 1. If hls.js engine exists, switch the engine audioTrack!
          const engine = media.engine;
          if (engine && Array.isArray(engine.audioTracks) && engine.audioTracks.length > 0) {
            let targetIdx = -1;
            // First attempt: match by numeric ID
            if (!isNaN(selectedIdNum) && engine.audioTracks.some((t: any) => t.id === selectedIdNum)) {
              targetIdx = engine.audioTracks.findIndex((t: any) => t.id === selectedIdNum);
            }
            // Second attempt: match by language code (en, hi, ta, te)
            if (targetIdx === -1 && selectedLang) {
              targetIdx = engine.audioTracks.findIndex((t: any) => {
                const tLang = (t.lang || "").toLowerCase();
                return tLang === selectedLang || tLang.startsWith(selectedLang) || selectedLang.startsWith(tLang);
              });
            }
            // Third attempt: match by label name (English, Hindi, etc.)
            if (targetIdx === -1 && selectedLabel) {
              targetIdx = engine.audioTracks.findIndex((t: any) => {
                const tName = (t.name || "").toLowerCase();
                return tName.includes(selectedLabel) || selectedLabel.includes(tName);
              });
            }

            if (targetIdx !== -1 && engine.audioTrack !== targetIdx) {
              console.log(
                `[VideoJS] Switched hls.js audioTrack to index ${targetIdx} (${engine.audioTracks[targetIdx]?.name || selectedLabel})`
              );
              engine.audioTrack = targetIdx;
            }
          }

          // 2. Find matched info for toast
          const matched = normalizedAudios.find(
            (r) =>
              r.id === selected.id ||
              (selectedLang && (r.language === selectedLang || r.language.startsWith(selectedLang))) ||
              (selectedLabel &&
                (r.label.toLowerCase().includes(selectedLabel) || selectedLabel.includes(r.label.toLowerCase())))
          );

          const trackLabel = selected.label || matched?.label || "Audio Track";
          setAudioNotice(`Audio: ${trackLabel}`);
          setTimeout(() => setAudioNotice(null), 3000);
          if (matched && onAudioChange) {
            onAudioChange(matched);
          }
        }
      } catch (err) {
        console.warn("[VideoJS] Error switching audio track:", err);
      }
    };

    media.audioTracks?.addEventListener?.("change", onTrackChange);

    return () => {
      media.removeEventListener?.("loadedmetadata", onMediaReady);
      media.removeEventListener?.("canplay", onMediaReady);
      media.audioTracks?.removeEventListener?.("change", onTrackChange);
    };
  }, [media, normalizedAudios, onAudioChange]);

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

      {/* Audio Language Toast */}
      {audioNotice && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none flex items-center gap-2 rounded-xl bg-black/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-200">
          <Volume2 className="h-3.5 w-3.5 text-red-500" />
          <span>{audioNotice}</span>
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
  availableAudio,
  availableQualities,
  storageKey,
  onAudioChange,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const savedSeekTimeRef = useRef<number | null>(null);
  const savedPausedRef = useRef<boolean>(false);
  const [selectedAudioLang, setSelectedAudioLang] = useState<string>("en");
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);

  useEffect(() => {
    setActiveSrc(src);
  }, [src]);

  // Candidate audio tracks list for dedicated player control
  const audioTrackList = useMemo(() => {
    const list: Array<{ id: string; label: string; language: string; url?: string }> = [];
    if (Array.isArray(availableAudio)) {
      availableAudio.forEach((item: any, idx: number) => {
        if (typeof item === "string") {
          list.push({
            id: String(idx),
            label: item.charAt(0).toUpperCase() + item.slice(1),
            language: item.toLowerCase(),
          });
        } else if (item && typeof item === "object") {
          const lang = (item.language || item.lang || "en").toLowerCase();
          const label =
            item.label ||
            (lang === "en"
              ? "English (Original)"
              : lang === "hi"
                ? "Hindi"
                : lang === "ta"
                  ? "Tamil"
                  : lang === "te"
                    ? "Telugu"
                    : lang.toUpperCase());
          list.push({
            id: String(idx),
            label,
            language: lang,
            url: item.url,
          });
        }
      });
    }
    return list;
  }, [availableAudio]);

  const handleAudioSelect = (audioItem: any) => {
    if (!audioItem) return;
    const videoEl = containerRef.current?.querySelector("video");
    const currentTime = videoEl?.currentTime || 0;
    const wasPaused = videoEl?.paused ?? false;

    savedSeekTimeRef.current = currentTime > 0 ? currentTime : null;
    savedPausedRef.current = wasPaused;

    const lang = (audioItem.language || audioItem.lang || "en").toLowerCase();
    setSelectedAudioLang(lang);
    setShowAudioMenu(false);

    if (audioItem?.url && audioItem.url !== activeSrc) {
      console.log(`[VideoJS] Switching audio stream to ${audioItem.label} (${audioItem.url})`);
      setActiveSrc(audioItem.url);
    }
    onAudioChange?.(audioItem);
  };

  const handleMediaReady = () => {
    onFirstFrame?.();
    if (savedSeekTimeRef.current !== null) {
      const targetTime = savedSeekTimeRef.current;
      savedSeekTimeRef.current = null;
      const videoEl = containerRef.current?.querySelector("video");
      if (videoEl && isFinite(targetTime) && targetTime > 0) {
        try {
          videoEl.currentTime = targetTime;
        } catch {}
      }
      if (!savedPausedRef.current) {
        videoEl?.play?.().catch(() => {});
      }
    }
  };

  const isHls =
    activeSrc.includes(".m3u8") ||
    activeSrc.includes("/api/hls-master") ||
    activeSrc.startsWith("blob:") ||
    (!activeSrc.includes(".mp4") && !activeSrc.includes(".webm"));

  // Ensure Video.js native Quality and Audio menus have multi-rendition levels to display
  const effectiveSrc = useMemo(() => {
    if (!activeSrc || !isHls) return activeSrc;
    if (activeSrc.startsWith("/api/hls-master")) return activeSrc;

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
    if (hlsQualities.length <= 1 && activeSrc.includes("/720/")) {
      hlsQualities = [
        { quality: "720p", url: activeSrc },
        { quality: "480p", url: activeSrc.replace("/720/", "/480/") },
      ];
    } else if (hlsQualities.length <= 1 && activeSrc.includes("/1080/")) {
      hlsQualities = [
        { quality: "1080p", url: activeSrc },
        { quality: "720p", url: activeSrc.replace("/1080/", "/720/") },
        { quality: "480p", url: activeSrc.replace("/1080/", "/480/") },
      ];
    }

    // Collect all candidate Audio tracks
    let hlsAudios: Array<{ language: string; label: string; url: string }> = [];
    if (Array.isArray(availableAudio)) {
      for (const a of availableAudio) {
        if (a && typeof a === "object" && a.url) {
          hlsAudios.push({
            language: a.language || a.lang || "en",
            label: a.label || a.language || "English",
            url: a.url,
          });
        }
      }
    }

    const hasMultipleQualities = hlsQualities.length > 1;
    const hasMultipleAudios = hlsAudios.length > 1;

    if ((hasMultipleQualities || hasMultipleAudios) && typeof window !== "undefined") {
      const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];

      // Audio tracks definition
      if (hasMultipleAudios) {
        const seenAudios = new Set<string>();
        let isFirst = true;
        for (const a of hlsAudios) {
          const lang = a.language;
          if (seenAudios.has(lang)) continue;
          seenAudios.add(lang);

          const isDefault = isFirst || lang === "en";
          lines.push(
            `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${a.label}",DEFAULT=${isDefault ? "YES" : "NO"},AUTOSELECT=YES,LANGUAGE="${lang}"`
          );
          isFirst = false;
        }
      }

      const audioAttr = hasMultipleAudios ? ',AUDIO="audio"' : "";

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
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}${audioAttr},NAME="${label}"`
        );
        lines.push(q.url);
      }

      const manifest = lines.join("\n") + "\n";
      const blob = new Blob([manifest], { type: "application/vnd.apple.mpegurl" });
      return URL.createObjectURL(blob);
    }

    return activeSrc;
  }, [activeSrc, isHls, availableQualities, availableAudio]);

  useEffect(() => {
    return () => {
      if (effectiveSrc && effectiveSrc.startsWith("blob:")) {
        URL.revokeObjectURL(effectiveSrc);
      }
    };
  }, [effectiveSrc]);

  return (
    <div
      ref={containerRef}
      onClick={() => setShowAudioMenu(false)}
      className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}
    >
      <VideoPlayer poster={poster}>
        <PlayerStateBridge
          storageKey={storageKey}
          onFirstFrame={onFirstFrame}
          onError={onError}
          availableAudio={availableAudio}
          onAudioChange={handleAudioSelect}
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
              onLoadedData={handleMediaReady}
              onCanPlay={handleMediaReady}
              onPlay={handleMediaReady}
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
              onLoadedData={handleMediaReady}
              onCanPlay={handleMediaReady}
              onPlay={handleMediaReady}
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

      {/* Dedicated Audio Language Selector (TGFLIX Style |||) */}
      {audioTrackList.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-[16px] right-[100px] z-30"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAudioMenu((prev) => !prev)}
              title="Audio Language"
              className="flex items-center justify-center h-8 w-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
            >
              <AudioLines className="h-5 w-5" />
            </button>

            {/* Audio Selection Dropdown Menu */}
            {showAudioMenu && (
              <div className="absolute bottom-10 right-0 mb-2 w-48 rounded-xl bg-[#0c0c0e]/95 border border-white/15 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-white/10 mb-1">
                  Audio Language
                </div>
                <div className="space-y-0.5">
                  {audioTrackList.map((track) => {
                    const isSelected =
                      selectedAudioLang === track.language ||
                      (selectedAudioLang === "en" && track.language.startsWith("en"));
                    return (
                      <button
                        key={track.id || track.language}
                        type="button"
                        onClick={() => handleAudioSelect(track)}
                        className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
                          isSelected
                            ? "bg-red-600/20 text-white font-semibold"
                            : "text-neutral-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{track.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-red-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoJSPlayer;
