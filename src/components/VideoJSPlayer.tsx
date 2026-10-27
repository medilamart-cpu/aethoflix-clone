"use client";

import React, { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

export type VideoJsPlayer = any;

export interface VideoJSPlayerProps {
  src: string;
  type?: string; // "application/x-mpegURL" or "video/mp4"
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  onReady?: (player: VideoJsPlayer) => void;
  onError?: (error: any) => void;
}

export function VideoJSPlayer({
  src,
  type,
  poster,
  autoplay = false,
  controls = true,
  className = "",
  onReady,
  onError,
}: VideoJSPlayerProps) {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);

  // Auto-detect MIME type if not specified
  const detectedType =
    type ||
    (src.includes(".m3u8")
      ? "application/x-mpegURL"
      : src.includes(".mp4")
      ? "video/mp4"
      : src.includes(".webm")
      ? "video/webm"
      : "application/x-mpegURL");

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add("vjs-big-play-centered", "vjs-fluid");
      videoRef.current.appendChild(videoElement);

      const player: any = videojs(
        videoElement,
        {
          autoplay,
          controls,
          responsive: true,
          fluid: true,
          poster,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          controlBar: {
            skipButtons: {
              forward: 10,
              backward: 10,
            },
          },
          sources: [
            {
              src,
              type: detectedType,
            },
          ],
        },
        () => {
          if (onReady) {
            onReady(player);
          }
        }
      );

      playerRef.current = player;

      player.on("error", () => {
        const err = player.error();
        console.error("[Video.js Error]", err);
        if (onError) onError(err);
      });
    } else if (playerRef.current) {
      // Update existing player source
      const player = playerRef.current;
      player.src({ src, type: detectedType });
      if (poster) player.poster(poster);
    }
  }, [src, detectedType, poster, autoplay, controls, onReady, onError]);

  // Dispose player on unmount
  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className={`w-full h-full relative overflow-hidden rounded-xl ${className}`}>
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
}

export default VideoJSPlayer;
