"use client";

import React from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";

export type VideoJsPlayer = any;

export interface VideoJSPlayerProps {
  src: string;
  type?: string; // "application/x-mpegURL" or "video/mp4"
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
  onReady?: (player: any) => void;
  onError?: (error: any) => void;
}

export function VideoJSPlayer({
  src,
  type,
  poster,
  autoplay = false,
  className = "",
  onReady,
  onError,
}: VideoJSPlayerProps) {
  const isHls =
    type === "application/x-mpegURL" ||
    src.includes(".m3u8") ||
    (!src.includes(".mp4") && !src.includes(".webm"));

  return (
    <div
      data-vjs-player
      className={`w-full h-full relative overflow-hidden rounded-xl bg-black ${className}`}
    >
      <VideoPlayer poster={poster}>
        <VideoSkin style={{ width: "100%", height: "100%" }}>
          {isHls ? (
            <HlsJsVideo
              src={src}
              autoPlay={autoplay}
              playsInline
              onLoadedMetadata={() => onReady?.(null)}
              onError={(e) => onError?.(e)}
            />
          ) : (
            <Video
              src={src}
              autoPlay={autoplay}
              playsInline
              onLoadedMetadata={() => onReady?.(null)}
              onError={(e) => onError?.(e)}
            />
          )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
}

export default VideoJSPlayer;
