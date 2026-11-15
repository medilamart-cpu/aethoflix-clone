"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { VolumeX, RotateCcw } from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export type VideoJsPlayer = Player;

export interface VideoJSPlayerProps {
  src: string;
  type?: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  storageKey?: string;
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
}

/**
 * CleanStream Native Device Player Fullscreen Engine
 * (Direct port from E:\MY PROJECTS\xilust\scripts\patch_cleanstream_native_player.py & cleanstream_web_player_server.py)
 */
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
  onReady,
  onError,
}: VideoJSPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vjsPlayerRef = useRef<Player | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [resumedNotice, setResumedNotice] = useState<string | null>(null);
  const [isMutedAutoplay, setIsMutedAutoplay] = useState(false);
  const [useNativeCleanStream, setUseNativeCleanStream] = useState<boolean>(true);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isHls =
    src.includes(".m3u8") ||
    type === "application/x-mpegURL" ||
    (!src.includes(".mp4") && !src.includes(".webm"));

  // Native Fullscreen Engine - Supports iOS AVPlayer & Android Hardware Video
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

    // 1. iOS: Native AVPlayer Fullscreen Experience
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
            if (!video.paused) {
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

    // 2. Android: Native Video Fullscreen Experience
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

    // 3. Fallback: Standard fullscreen on video or container
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

  // Listen for CleanStream native fullscreen messages from UI or parent frames
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

  // CleanStream Player Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !src) return;

    let isDisposed = false;
    const { isIOS } = detectPlatform();

    // Check whether Video.js 10 custom element tags are available in the DOM
    const hasV10Elements =
      typeof customElements !== "undefined" &&
      typeof customElements.get === "function" &&
      !!customElements.get("video-player");

    if (hasV10Elements) {
      // ── CleanStream Video.js 10 Custom Elements Mode ──
      setUseNativeCleanStream(true);
      container.innerHTML = `
        <div id="playerContainer" class="cleanstream-player-container">
          <video-player id="cleanPlayer" style="width: 100%; height: 100%;">
            <video-skin id="cleanSkin" style="display: block; width: 100%; height: 100%;">
              ${
                !isIOS && isHls
                  ? `<hlsjs-video id="cleanVideoPlayer" src="${src}" playsinline webkit-playsinline ${
                      autoplay ? "autoplay" : ""
                    } controls style="width: 100%; height: 100%; object-fit: contain; background: #000;"></hlsjs-video>`
                  : `<video id="cleanVideoPlayer" src="${src}" playsinline webkit-playsinline ${
                      autoplay ? "autoplay" : ""
                    } controls style="width: 100%; height: 100%; object-fit: contain; background: #000;"></video>`
              }
            </video-skin>
          </video-player>
        </div>
      `;

      const mediaEl = container.querySelector("#cleanVideoPlayer") as HTMLVideoElement;
      nativeVideoRef.current = mediaEl;

      if (mediaEl) {
        // Auto-resume from saved position
        if (storageKey) {
          try {
            const saved = localStorage.getItem(`aethoflix_resume_${storageKey}`);
            if (saved) {
              const time = parseFloat(saved);
              if (time > 5) {
                const onLoadedMeta = () => {
                  mediaEl.currentTime = time;
                  setResumedNotice(`Resumed at ${formatTime(time)}`);
                  setTimeout(() => setResumedNotice(null), 3500);
                  mediaEl.removeEventListener("loadedmetadata", onLoadedMeta);
                };
                mediaEl.addEventListener("loadedmetadata", onLoadedMeta);
              }
            }
          } catch {}
        }

        // Timeupdate persistence
        const onTimeUpdate = () => {
          if (!storageKey) return;
          const ct = mediaEl.currentTime;
          const dur = mediaEl.duration;
          if (ct && ct > 5 && dur && dur - ct > 15) {
            try {
              localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(ct)));
            } catch {}
          }
        };
        mediaEl.addEventListener("timeupdate", onTimeUpdate);

        const onEnded = () => {
          if (storageKey) {
            try {
              localStorage.removeItem(`aethoflix_resume_${storageKey}`);
            } catch {}
          }
        };
        mediaEl.addEventListener("ended", onEnded);

        // Muted Autoplay Handling
        if (autoplay) {
          mediaEl.play().catch((err) => {
            console.info("[CleanStream] Autoplay policy prevented unmuted playback, falling back to muted:", err);
            mediaEl.muted = true;
            mediaEl.play().then(() => setIsMutedAutoplay(true)).catch(() => {});
          });
        }

        mediaEl.addEventListener("volumechange", () => {
          if (!mediaEl.muted) setIsMutedAutoplay(false);
        });

        // Error detection
        mediaEl.addEventListener("error", (e) => {
          if (isDisposed) return;
          console.warn("[CleanStream Error] Media element error:", e);
          onError?.(e);
        });

        onReady?.(mediaEl);
      }
    } else {
      // ── CleanStream Video.js (v8 Fluid Engine Fallback) ──
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
          autoplay: autoplay ? "any" : false,
          controls,
          responsive: true,
          fluid: true,
          poster,
          preload: "auto",
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          controlBar: {
            skipButtons: { forward: 10, backward: 10 },
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
          onReady?.(player);

          if (storageKey) {
            try {
              const saved = localStorage.getItem(`aethoflix_resume_${storageKey}`);
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

          if (player.muted()) setIsMutedAutoplay(true);
        }
      ));

      player.on("timeupdate", () => {
        if (!storageKey) return;
        const ct = player.currentTime();
        const dur = player.duration();
        if (ct && ct > 5 && dur && dur - ct > 15) {
          try {
            localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(ct)));
          } catch {}
        }
      });

      player.on("ended", () => {
        if (storageKey) {
          try {
            localStorage.removeItem(`aethoflix_resume_${storageKey}`);
          } catch {}
        }
      });

      player.on("volumechange", () => {
        if (!player.muted()) setIsMutedAutoplay(false);
      });

      player.on("error", () => {
        if (isDisposed) return;
        const err = player.error();
        console.warn("[CleanStream Error]", err);
        onError?.(err);
      });
    }

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
  }, [src, isHls, autoplay, controls, poster, storageKey, onReady, onError]);

  return (
    <div
      data-vjs-player
      className={`relative w-full h-full overflow-hidden bg-black select-none ${className}`}
    >
      {/* Autoplay Muted Notice */}
      {isMutedAutoplay && (
        <button
          type="button"
          onClick={() => {
            if (nativeVideoRef.current) {
              nativeVideoRef.current.muted = false;
              nativeVideoRef.current.play().catch(() => {});
            } else if (vjsPlayerRef.current) {
              vjsPlayerRef.current.muted(false);
            }
            setIsMutedAutoplay(false);
          }}
          className="absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full bg-red-600/90 hover:bg-red-500 px-3.5 py-1.5 text-xs text-white backdrop-blur-md shadow-xl border border-red-400/40 cursor-pointer transition-all"
        >
          <VolumeX className="h-3.5 w-3.5 text-red-200" />
          <span>Autoplay muted — Tap to Unmute</span>
        </button>
      )}

      {/* Auto-Resume Timestamp Toast */}
      {resumedNotice && (
        <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5 rounded-lg bg-black/85 px-3 py-1.5 text-xs text-emerald-400 backdrop-blur-md border border-emerald-500/30 shadow-lg pointer-events-none">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{resumedNotice}</span>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default VideoJSPlayer;
