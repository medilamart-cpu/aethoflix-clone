"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { useMedia } from "@videojs/react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { RotateCcw, Volume2 } from "lucide-react";

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
  selectedAudioId = "0",
  onAudioChange,
}: {
  storageKey?: string;
  onFirstFrame?: () => void;
  onError?: (err: any) => void;
  availableAudio?: AudioItem[] | string[] | any;
  selectedAudioId?: string;
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
  const selectedAudioIdRef = useRef(selectedAudioId);
  selectedAudioIdRef.current = selectedAudioId;

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
      if (userSelectedAudioRef.current || hasAutoSelectedRef.current || selectedAudioIdRef.current !== "0") return;
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
      if (!media) return;

      const currentTargetId = selectedAudioIdRef.current || "0";

      // If media already has an active audio track list with our custom tracks, just sync enabled state
      if (media.audioTracks && media.audioTracks.length > 0 && (media.audioTracks as any)._isCustom) {
        for (const t of media.audioTracks) {
          t._enabled = t.id === currentTargetId;
        }
        media.audioTracks.dispatchEvent(new Event("change"));
        return;
      }

      populatingAudioRef.current = true;
      try {
        const trackListTarget = new EventTarget();
        const tracks = normalizedAudios.map((item, idx) => {
          return {
            id: item.id,
            label: item.label,
            language: item.language,
            kind: idx === 0 ? "main" : "alternative",
            _enabled: item.id === currentTargetId,
            get enabled() {
              return this._enabled;
            },
            set enabled(val: boolean) {
              if (this._enabled !== val) {
                this._enabled = val;
                trackListTarget.dispatchEvent(new Event("change"));
              }
            },
          };
        });

        const customTrackList = Object.assign(trackListTarget, {
          _isCustom: true,
          length: tracks.length,
          [Symbol.iterator]: () => tracks[Symbol.iterator](),
          map: (fn: any) => tracks.map(fn),
          find: (fn: any) => tracks.find(fn),
          findIndex: (fn: any) => tracks.findIndex(fn),
          filter: (fn: any) => tracks.filter(fn),
          some: (fn: any) => tracks.some(fn),
          forEach: (fn: any) => tracks.forEach(fn),
        });
        tracks.forEach((t, i) => {
          (customTrackList as any)[i] = t;
        });

        Object.defineProperty(media, "audioTracks", {
          get: () => customTrackList,
          configurable: true,
        });

        customTrackList.dispatchEvent(new Event("change"));
      } catch (err) {
        console.warn("[VideoJS] Error populating audio tracks:", err);
      } finally {
        populatingAudioRef.current = false;
      }
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

          // If track matches current selection, ignore to prevent re-entrant loops
          if (selected.id === selectedAudioIdRef.current) {
            return;
          }

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
  }, [media, normalizedAudios, onAudioChange, selectedAudioId]);

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

  // Notify on fatal stream error before first frame
  useEffect(() => {
    if (error) {
      console.warn("[VideoJS] Player error event:", error);
      if (!hasNotifiedFirstFrameRef.current) {
        onError?.(error);
      }
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
  // Detect initial audio ID if src matches availableAudio or default to English (0)
  const initialAudioId = useMemo(() => {
    if (Array.isArray(availableAudio) && availableAudio.length > 0) {
      const idx = availableAudio.findIndex((a: any) => a?.url === src);
      if (idx !== -1) return String(idx);
      const enIdx = availableAudio.findIndex((a: any) => {
        const l = (a?.language || a?.lang || "").toLowerCase();
        return l === "en" || l.startsWith("en");
      });
      if (enIdx !== -1) return String(enIdx);
    }
    return "0";
  }, [availableAudio, src]);

  const [selectedAudioId, setSelectedAudioId] = useState<string>(initialAudioId);
  const [activeSrc, setActiveSrc] = useState(src);

  useEffect(() => {
    setActiveSrc(src);
    if (Array.isArray(availableAudio) && availableAudio.length > 0) {
      const idx = availableAudio.findIndex((a: any) => a?.url === src);
      if (idx !== -1) {
        setSelectedAudioId(String(idx));
      }
    }
  }, [src, availableAudio]);

  const handleAudioSelect = (audioItem: any) => {
    if (!audioItem) return;
    const videoEl = containerRef.current?.querySelector("video");
    const currentTime = videoEl?.currentTime || 0;
    const wasPaused = videoEl?.paused ?? false;

    savedSeekTimeRef.current = currentTime > 0 ? currentTime : null;
    savedPausedRef.current = wasPaused;

    if (audioItem.id !== undefined && audioItem.id !== null) {
      setSelectedAudioId(String(audioItem.id));
    }

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
        } catch { }
      }
      if (!savedPausedRef.current) {
        videoEl?.play?.().catch(() => { });
      }
    }
  };

  const isHls =
    activeSrc.includes(".m3u8") ||
    activeSrc.includes("/api/hls-master") ||
    activeSrc.startsWith("blob:") ||
    (!activeSrc.includes(".mp4") && !activeSrc.includes(".webm"));

  // Ensure Video.js native Quality menu has multi-rendition levels to display
  const effectiveSrc = useMemo(() => {
    if (!activeSrc || !isHls) return activeSrc;

    // Collect all candidate HLS stream renditions
    let hlsQualities: Array<{ quality: string; url: string }> = [];

    // Derive multi-quality URLs from activeSrc (which contains current audio track proxy)
    const has720 = activeSrc.includes("/720/") || activeSrc.includes("%2F720%2F");
    const has1080 = activeSrc.includes("/1080/") || activeSrc.includes("%2F1080%2F");

    if (has720) {
      hlsQualities = [
        {
          quality: "1080p",
          url: activeSrc.replaceAll("%2F720%2F", "%2F1080%2F").replaceAll("/720/", "/1080/"),
        },
        { quality: "720p", url: activeSrc },
        {
          quality: "480p",
          url: activeSrc.replaceAll("%2F720%2F", "%2F480%2F").replaceAll("/720/", "/480/"),
        },
      ];
    } else if (has1080) {
      hlsQualities = [
        { quality: "1080p", url: activeSrc },
        {
          quality: "720p",
          url: activeSrc.replaceAll("%2F1080%2F", "%2F720%2F").replaceAll("/1080/", "/720/"),
        },
        {
          quality: "480p",
          url: activeSrc.replaceAll("%2F1080%2F", "%2F480%2F").replaceAll("/1080/", "/480/"),
        },
      ];
    } else if (Array.isArray(availableQualities)) {
      for (const q of availableQualities) {
        if (q && typeof q === "object" && q.url && q.url.includes(".m3u8")) {
          hlsQualities.push({ quality: q.quality || "720p", url: q.url });
        }
      }
    }

    if (hlsQualities.length > 1 && typeof window !== "undefined") {
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

    return activeSrc;
  }, [activeSrc, isHls, availableQualities]);

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
      className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}
    >
      <VideoPlayer poster={poster}>
        <PlayerStateBridge
          storageKey={storageKey}
          onFirstFrame={onFirstFrame}
          onError={onError}
          availableAudio={availableAudio}
          selectedAudioId={selectedAudioId}
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
    </div>
  );
}

export default VideoJSPlayer;
