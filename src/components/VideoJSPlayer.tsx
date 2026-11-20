"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { useMedia } from "@videojs/react";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { RotateCcw, Volume2, Layers } from "lucide-react";

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
  onQualityChange?: (quality: any) => void;
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
  onFirstFrame?: () => void;
}

/**
 * Player State Bridge — runs inside <VideoPlayer> context
 * Handles resume timestamp, progress saving, first-frame callback, and native playback tracking
 */
function PlayerStateBridge({
  activeSrc,
  storageKey,
  onFirstFrame,
  onError,
  availableAudio,
  availableQualities,
  selectedAudioId = "0",
  onAudioChange,
  onQualityChange,
}: {
  activeSrc?: string;
  storageKey?: string;
  onFirstFrame?: () => void;
  onError?: (err: any) => void;
  availableAudio?: AudioItem[] | string[] | any;
  availableQualities?: QualityItem[] | string[] | any;
  selectedAudioId?: string;
  onAudioChange?: (audio: any) => void;
  onQualityChange?: (quality: any) => void;
}) {
  const store = usePlayer();
  const media = useMedia() as any;
  const currentTime = usePlayer((s: any) => s?.currentTime ?? 0);
  const duration = usePlayer((s: any) => s?.duration ?? 0);
  const paused = usePlayer((s: any) => s?.paused ?? true);
  const error = usePlayer((s: any) => s?.error);

  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [qualityNotice, setQualityNotice] = useState<string | null>(null);
  const hasResumedRef = useRef(false);
  const hasNotifiedFirstFrameRef = useRef(false);
  const populatingAudioRef = useRef(false);
  const populatingRenditionsRef = useRef(false);

  const userSelectedAudioRef = useRef(false);
  const hasAutoSelectedRef = useRef(false);
  const selectedAudioIdRef = useRef(selectedAudioId);
  selectedAudioIdRef.current = selectedAudioId;
  const selectedQualityHeightRef = useRef<number>(-1);

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

    // Deduplicate audio candidate list strictly by language code and label
    const seen = new Set<string>();
    const deduplicated: typeof list = [];
    for (const item of list) {
      const key = `${item.language.toLowerCase()}-${item.label.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push({ ...item, id: String(deduplicated.length) });
      }
    }

    // Show only those languages which are actually available! Never inject fake tracks.
    if (deduplicated.length === 0) {
      deduplicated.push({ id: "0", label: "English", language: "en" });
    }

    return deduplicated;
  }, [availableAudio]);

  // Sync and manage audio tracks & video renditions with Video.js Settings menu
  useEffect(() => {
    if (!media) return;

    // Attach Hls.js network and media error auto-recovery
    if (media.engine && typeof media.engine.on === "function") {
      const onHlsError = (_e: any, data: any) => {
        if (data?.fatal) {
          console.warn("[VideoJS] Recovering Hls.js fatal error:", data.type, data.details);
          if (data.type === "networkError") {
            media.engine.startLoad();
          } else if (data.type === "mediaError") {
            media.engine.recoverMediaError();
          }
        }
      };
      media.engine.on("hlsError", onHlsError);
    }

    const populateAudioTracks = () => {
      if (populatingAudioRef.current || !media) return;

      const currentTargetId = selectedAudioIdRef.current || "0";

      // If media already has custom tracks attached, simply update enabled flag
      if (media.audioTracks && (media.audioTracks as any)._isCustom) {
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
            url: item.url,
            kind: idx === 0 ? "main" : "alternative",
            _enabled: item.id === currentTargetId,
            get enabled() {
              return this._enabled;
            },
            set enabled(val: boolean) {
              if (this._enabled !== val) {
                this._enabled = val;
                if (val) {
                  // Disable sibling tracks when one track is enabled
                  tracks.forEach((other) => {
                    if (other !== this) other._enabled = false;
                  });
                }
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

    const populateVideoRenditions = () => {
      if (populatingRenditionsRef.current || !media) return;

      const currentTargetHeight = selectedQualityHeightRef.current;

      // If media already has native multi-level renditions from HLS manifest, let native HlsJsMediaTracks handle it!
      if (media.videoRenditions && !(media.videoRenditions as any)._isCustom && media.videoRenditions.length > 1) {
        return;
      }

      // If media already has custom renditions, update selected state in place
      if (media.videoRenditions && (media.videoRenditions as any)._isCustom) {
        const rends = [...media.videoRenditions];
        const matchIdx = currentTargetHeight > 0 ? rends.findIndex((r: any) => r.height === currentTargetHeight) : -1;
        if (media.videoRenditions.selectedIndex !== matchIdx) {
          media.videoRenditions.selectedIndex = matchIdx;
        } else {
          rends.forEach((r: any, i: number) => {
            r.selected = i === matchIdx;
            r.active = matchIdx === -1 ? i === 0 : i === matchIdx;
          });
          media.videoRenditions.dispatchEvent(new Event("change"));
        }
        return;
      }

      populatingRenditionsRef.current = true;
      try {
        const renditionListTarget = new EventTarget();
        const renditions: Array<{
          id: string;
          width: number;
          height: number;
          bitrate: number;
          selected: boolean;
          active: boolean;
          url?: string;
        }> = [];

        // Guarantee distinct standard multi-resolutions with exact 16:9 specs to prevent duplicate badge formatting
        const targetHeights = [1080, 720, 480];
        targetHeights.forEach((h) => {
          const w = h >= 1080 ? 1920 : h >= 720 ? 1280 : 854;
          const b = h >= 1080 ? 5000000 : h >= 720 ? 2500000 : 1200000;
          let qUrl = "";
          if (Array.isArray(availableQualities)) {
            const found = availableQualities.find((q: any) => {
              const str = typeof q === "string" ? q : q?.quality || "";
              return str.includes(String(h));
            });
            if (found && typeof found === "object" && found.url) qUrl = found.url;
          }
          if (!qUrl && activeSrc) {
            qUrl = activeSrc
              .replaceAll("%2F720%2F", `%2F${h}%2F`).replaceAll("/720/", `/${h}/`)
              .replaceAll("%2F1080%2F", `%2F${h}%2F`).replaceAll("/1080/", `/${h}/`)
              .replaceAll("%2F480%2F", `%2F${h}%2F`).replaceAll("/480/", `/${h}/`);
          }
          renditions.push({
            id: `${h}p`,
            width: w,
            height: h,
            bitrate: b,
            url: qUrl,
            selected: false,
            active: false,
          });
        });

        // Sort descending: 1080p, 720p, 480p
        renditions.sort((a, b) => b.height - a.height);

        let selectedIdx = currentTargetHeight > 0
          ? renditions.findIndex(r => r.height === currentTargetHeight)
          : -1;

        renditions.forEach((r, i) => {
          r.selected = i === selectedIdx;
          r.active = selectedIdx === -1 ? i === 0 : i === selectedIdx;
        });

        const customRenditions = Object.assign(renditionListTarget, {
          _isCustom: true,
          length: renditions.length,
          get selectedIndex() {
            return selectedIdx;
          },
          set selectedIndex(val: number) {
            selectedIdx = val;
            const chosen = val >= 0 ? renditions[val] : null;
            selectedQualityHeightRef.current = chosen ? chosen.height : -1;

            renditions.forEach((r, i) => {
              r.selected = i === val;
              r.active = val === -1 ? i === 0 : i === val;
            });

            if (media.engine && Array.isArray(media.engine.levels) && media.engine.levels.length > 1) {
              try {
                if (val === -1) {
                  media.engine.currentLevel = -1;
                } else if (chosen) {
                  const targetH = chosen.height;
                  const lvlIdx = media.engine.levels.findIndex(
                    (l: any) => l.height === targetH || Math.abs((l.height || 0) - targetH) <= 50
                  );
                  if (lvlIdx !== -1) {
                    media.engine.currentLevel = lvlIdx;
                  }
                }
              } catch {}
            }

            if (chosen) {
              setQualityNotice(`Quality: ${chosen.id}`);
              setTimeout(() => setQualityNotice(null), 3000);
            }

            if (onQualityChange) {
              onQualityChange(chosen);
            }

            renditionListTarget.dispatchEvent(new Event("change"));
          },
          [Symbol.iterator]: () => renditions[Symbol.iterator](),
          map: (fn: any) => renditions.map(fn),
          find: (fn: any) => renditions.find(fn),
          findIndex: (fn: any) => renditions.findIndex(fn),
          filter: (fn: any) => renditions.filter(fn),
          some: (fn: any) => renditions.some(fn),
          forEach: (fn: any) => renditions.forEach(fn),
        });

        renditions.forEach((r, i) => {
          (customRenditions as any)[i] = r;
        });

        Object.defineProperty(media, "videoRenditions", {
          get: () => customRenditions,
          configurable: true,
        });

        customRenditions.dispatchEvent(new Event("change"));
      } catch (err) {
        console.warn("[VideoJS] Error populating video renditions:", err);
      } finally {
        populatingRenditionsRef.current = false;
      }
    };

    populateAudioTracks();
    populateVideoRenditions();

    // Listen for media readiness to ensure menus are always populated
    const onMediaReady = () => {
      populateAudioTracks();
      populateVideoRenditions();
    };

    media.addEventListener?.("loadstart", onMediaReady);
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

          // If track matches current selection, ignore to prevent loops
          if (selected.id === selectedAudioIdRef.current) {
            return;
          }

          const selectedLang = (selected.language || "").toLowerCase();
          const selectedLabel = (selected.label || "").toLowerCase();
          const selectedIdNum = Number(selected.id);

          // 1. If hls.js engine exists, switch the engine audioTrack
          const engine = media.engine;
          if (engine && Array.isArray(engine.audioTracks) && engine.audioTracks.length > 0) {
            let targetIdx = -1;
            if (!isNaN(selectedIdNum) && engine.audioTracks.some((t: any) => t.id === selectedIdNum)) {
              targetIdx = engine.audioTracks.findIndex((t: any) => t.id === selectedIdNum);
            }
            if (targetIdx === -1 && selectedLang) {
              targetIdx = engine.audioTracks.findIndex((t: any) => {
                const tLang = (t.lang || "").toLowerCase();
                return tLang === selectedLang || tLang.startsWith(selectedLang) || selectedLang.startsWith(tLang);
              });
            }
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

          // 2. Find matched info for toast and stream switch
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
      media.removeEventListener?.("loadstart", onMediaReady);
      media.removeEventListener?.("loadedmetadata", onMediaReady);
      media.removeEventListener?.("canplay", onMediaReady);
      media.audioTracks?.removeEventListener?.("change", onTrackChange);
    };
  }, [media, normalizedAudios, availableQualities, onAudioChange, onQualityChange, selectedAudioId]);

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

      {/* Quality Toast */}
      {qualityNotice && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none flex items-center gap-2 rounded-xl bg-black/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-200">
          <Layers className="h-3.5 w-3.5 text-red-500" />
          <span>{qualityNotice}</span>
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
  onQualityChange,
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
  const userSelectedQualityRef = useRef<number>(-1);

  useEffect(() => {
    if (userSelectedQualityRef.current <= 0) {
      setActiveSrc(src);
    } else {
      const targetStr = String(userSelectedQualityRef.current);
      const currentResMatch = src.match(/(?:%2F|\/)(\d{3,4})(?:%2F|\/)/);
      const currentRes = currentResMatch ? currentResMatch[1] : null;
      let targetUrl = src;
      if (currentRes && currentRes !== targetStr) {
        targetUrl = src
          .replaceAll(`%2F${currentRes}%2F`, `%2F${targetStr}%2F`)
          .replaceAll(`/${currentRes}/`, `/${targetStr}/`);
      }
      setActiveSrc(targetUrl);
    }

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

    let targetAudioUrl = audioItem.url;
    if (audioItem?.url) {
      if (userSelectedQualityRef.current > 0) {
        const targetStr = String(userSelectedQualityRef.current);
        const currentResMatch = targetAudioUrl.match(/(?:%2F|\/)(\d{3,4})(?:%2F|\/)/);
        const currentRes = currentResMatch ? currentResMatch[1] : null;
        if (currentRes && currentRes !== targetStr) {
          targetAudioUrl = targetAudioUrl
            .replaceAll(`%2F${currentRes}%2F`, `%2F${targetStr}%2F`)
            .replaceAll(`/${currentRes}/`, `/${targetStr}/`);
        }
      }
      if (targetAudioUrl !== activeSrc) {
        console.log(`[VideoJS] Switching audio stream to ${audioItem.label} (${targetAudioUrl})`);
        setActiveSrc(targetAudioUrl);
      }
    }
    onAudioChange?.({ ...audioItem, url: targetAudioUrl || audioItem.url });
  };

  const handleQualitySelect = (qualityItem: any) => {
    const videoEl = containerRef.current?.querySelector("video");
    const currentTime = videoEl?.currentTime || 0;
    const wasPaused = videoEl?.paused ?? false;

    savedSeekTimeRef.current = currentTime > 0 ? currentTime : null;
    savedPausedRef.current = wasPaused;

    if (!qualityItem) {
      // Auto selected
      userSelectedQualityRef.current = -1;
      onQualityChange?.(null);
      return;
    }

    const targetHeight = qualityItem.height || parseInt(qualityItem.id) || 720;
    userSelectedQualityRef.current = targetHeight;
    const targetStr = String(targetHeight);

    // If stream is a multi-variant master HLS (/api/hls-master), Hls.js switches quality in-stream natively
    if (activeSrc.includes("/api/hls-master")) {
      onQualityChange?.(qualityItem);
      return;
    }

    let targetUrl = qualityItem.url || activeSrc;
    const currentResMatch = activeSrc.match(/(?:%2F|\/)(\d{3,4})(?:%2F|\/)/);
    const currentRes = currentResMatch ? currentResMatch[1] : null;
    if (currentRes && currentRes !== targetStr) {
      targetUrl = activeSrc
        .replaceAll(`%2F${currentRes}%2F`, `%2F${targetStr}%2F`)
        .replaceAll(`/${currentRes}/`, `/${targetStr}/`);
    }

    if (targetUrl && targetUrl !== activeSrc) {
      console.log(`[VideoJS] Switching quality stream to ${targetHeight}p (${targetUrl})`);
      setActiveSrc(targetUrl);
    }
    onQualityChange?.({ ...qualityItem, url: targetUrl });
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
    activeSrc.includes("/api/core/proxy") ||
    activeSrc.includes("/api/resolve") ||
    (!activeSrc.includes(".mp4") && !activeSrc.includes(".webm"));

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}
    >
      <style jsx global>{`
        .video-js .vjs-error-display,
        .vjs-error-display {
          display: none !important;
        }
      `}</style>
      <VideoPlayer poster={poster}>
        <PlayerStateBridge
          activeSrc={activeSrc}
          storageKey={storageKey}
          onFirstFrame={onFirstFrame}
          onError={onError}
          availableAudio={availableAudio}
          availableQualities={availableQualities}
          selectedAudioId={selectedAudioId}
          onAudioChange={handleAudioSelect}
          onQualityChange={handleQualitySelect}
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
