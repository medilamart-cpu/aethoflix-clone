"use client";

import React, { useState, useEffect } from "react";
import { Zap, ShieldCheck, Film, Radio, Disc3 } from "lucide-react";

interface DirectStreamLoaderProps {
  poster?: string;
  title?: string;
  serverName?: string;
  isBuffering?: boolean;
}

const NARRATIVE_STATES = [
  {
    status: "Connecting Direct CDN Master",
    subtext: "Establishing private zero-ad stream connection",
    tag: "High-Speed Shard",
  },
  {
    status: "Synchronizing 1080p Video Stream",
    subtext: "Demuxing raw high-bitrate video segments",
    tag: "Master 1080p",
  },
  {
    status: "Buffering Multi-Channel Audio",
    subtext: "Aligning stereo & surround studio tracks",
    tag: "Studio Sound",
  },
  {
    status: "Hardware Acceleration Engaged",
    subtext: "Warming MSE video decoder for smooth playback",
    tag: "Direct HLS",
  },
];

export function DirectStreamLoader({
  poster,
  title,
  serverName = "Server 1 (Direct CDN)",
  isBuffering = false,
}: DirectStreamLoaderProps) {
  const [stateIdx, setStateIdx] = useState(0);

  useEffect(() => {
    // Continuous narrative progression without any stalling numbers
    const interval = setInterval(() => {
      setStateIdx((prev) => (prev + 1) % NARRATIVE_STATES.length);
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  // Clean the server name to ensure no raw backend providers (vidsrc, vidsync, theog) are exposed
  const cleanServerLabel = serverName
    .replace(/vidsync/gi, "Direct CDN")
    .replace(/theogpiratebot/gi, "Direct CDN")
    .replace(/recloud/gi, "Direct CDN")
    .replace(/vidsrc/gi, "Direct CDN")
    .trim();

  const currentState = isBuffering ? NARRATIVE_STATES[3] : NARRATIVE_STATES[stateIdx];

  return (
    <div className="direct-loader-root absolute inset-0 z-20 flex flex-col justify-between overflow-hidden bg-black select-none pointer-events-none">
      {/* ── 1. Full-Bleed Movie Artwork with Cinematic Ken Burns Drift ── */}
      {poster ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="direct-loader-hero-backdrop absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${poster})` }}
          />
          {/* Cinema gradient overlay so the artwork remains vivid while UI text stays high-contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-black/70" />
          <div className="absolute inset-0 bg-radial-cinema pointer-events-none" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[#080a0f] pointer-events-none" />
      )}

      {/* ── 2. Top Bar: Clean Brand Specs without Scraper Names ── */}
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-6 w-full">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-md shadow-lg">
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-75" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-white/95">
            {cleanServerLabel}
          </span>
          <span className="text-white/20">|</span>
          <span className="text-[11px] font-medium text-emerald-400">Zero Ads</span>
        </div>

        {/* Live Audio / Video Standard Tags */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-[11px] font-mono text-neutral-300">
          <span className="text-cyan-400 font-semibold tracking-wide">1080P MASTER</span>
          <span className="text-white/20">·</span>
          <span>MULTI-AUDIO</span>
          <span className="text-white/20">·</span>
          <span className="text-neutral-400">UNCOMPRESSED</span>
        </div>
      </div>

      {/* ── 3. Center Cinematic Focal Stage: Active Studio Equalizer & Movie Title ── */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto my-auto w-full">
        {/* Dynamic Studio Soundwave Bars with Continuous Organic Wave Physics */}
        <div className="flex items-end justify-center gap-1.5 h-12 mb-4" aria-hidden="true">
          <div className="w-1.5 rounded-full bg-red-600 eq-bar eq-bar-1" />
          <div className="w-1.5 rounded-full bg-red-500 eq-bar eq-bar-2" />
          <div className="w-1.5 rounded-full bg-red-500 eq-bar eq-bar-3" />
          <div className="w-1.5 rounded-full bg-cyan-400 eq-bar eq-bar-4" />
          <div className="w-1.5 rounded-full bg-white eq-bar eq-bar-5 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          <div className="w-1.5 rounded-full bg-cyan-400 eq-bar eq-bar-6" />
          <div className="w-1.5 rounded-full bg-red-500 eq-bar eq-bar-7" />
          <div className="w-1.5 rounded-full bg-red-500 eq-bar eq-bar-8" />
          <div className="w-1.5 rounded-full bg-red-600 eq-bar eq-bar-9" />
        </div>

        {/* Movie Title Presentation */}
        {title && (
          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-1 mb-2.5">
            {title}
          </h2>
        )}

        {/* Continuous Narrative State (Seamlessly Loops without Stalling) */}
        <div key={currentState.status} className="direct-narrative-anim flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-neutral-100">
            <Zap className="w-4 h-4 text-red-500 fill-red-500" />
            <span>{currentState.status}</span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md">
            {currentState.subtext}
          </p>
        </div>
      </div>

      {/* ── 4. Bottom Continuous Optical Radar Scanner (NO Frozen Percentage) ── */}
      <div className="relative z-10 w-full p-4 sm:p-6 pb-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-2.5">
          {/* Status Indicators Row */}
          <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
            <div className="flex items-center gap-2 text-neutral-300">
              <Disc3 className="w-3.5 h-3.5 text-red-500 animate-spin" />
              <span className="font-sans text-[11px] font-semibold tracking-wide uppercase text-neutral-300">
                Direct HLS Stream
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-medium font-sans">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{currentState.tag}</span>
            </div>
          </div>

          {/* Continuous Indeterminate Optical Sweep Bar (Always Moving) */}
          <div className="relative w-full h-1.5 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm">
            {/* Smooth back-and-forth indeterminate laser sweep */}
            <div className="direct-radar-glide absolute top-0 bottom-0 w-1/3 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-cyan-400 shadow-[0_0_14px_rgba(229,9,20,0.95)]" />
          </div>

          {/* Stream Quality Features */}
          <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1">
            <span>Hardware Video Decoder Active</span>
            <span className="text-emerald-400/90 font-medium">100% Ad-Free Master Stream</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .direct-loader-hero-backdrop {
          opacity: 0.58;
          transform: scale(1.05);
          animation: kenBurnsDrift 20s cubic-bezier(0.25, 1, 0.5, 1) infinite alternate;
        }

        .bg-radial-cinema {
          background: radial-gradient(
            circle at center,
            rgba(0, 0, 0, 0.1) 0%,
            rgba(5, 5, 5, 0.6) 65%,
            #050505 100%
          );
        }

        /* Continuous Dynamic Soundwave Equalizer Bars */
        .eq-bar {
          animation: eqDance 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
          transform-origin: bottom;
        }
        .eq-bar-1 { height: 35%; animation-delay: 0.12s; }
        .eq-bar-2 { height: 60%; animation-delay: 0.32s; }
        .eq-bar-3 { height: 85%; animation-delay: 0.08s; }
        .eq-bar-4 { height: 100%; animation-delay: 0.24s; }
        .eq-bar-5 { height: 100%; animation-delay: 0.4s; }
        .eq-bar-6 { height: 100%; animation-delay: 0.16s; }
        .eq-bar-7 { height: 85%; animation-delay: 0.28s; }
        .eq-bar-8 { height: 60%; animation-delay: 0.04s; }
        .eq-bar-9 { height: 35%; animation-delay: 0.36s; }

        @keyframes eqDance {
          0% {
            transform: scaleY(0.2);
            opacity: 0.45;
          }
          100% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        /* Seamless narrative text crossfade */
        .direct-narrative-anim {
          animation: narrativeFade 0.28s cubic-bezier(0.23, 1, 0.32, 1) both;
        }

        @keyframes narrativeFade {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Indeterminate continuous optical radar glide */
        .direct-radar-glide {
          animation: radarGlide 2.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite alternate;
        }

        @keyframes radarGlide {
          0% {
            left: 0%;
            transform: translateX(0%);
          }
          100% {
            left: 100%;
            transform: translateX(-100%);
          }
        }

        /* Gentle Ken Burns camera drift */
        @keyframes kenBurnsDrift {
          0% {
            transform: scale(1.03) translate(0, 0);
          }
          100% {
            transform: scale(1.1) translate(-1.5%, -1%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .direct-loader-hero-backdrop,
          .eq-bar,
          .direct-radar-glide {
            animation: none;
          }
          .eq-bar {
            transform: scaleY(0.65);
            opacity: 0.85;
          }
          .direct-radar-glide {
            left: 33%;
          }
          .direct-narrative-anim {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default DirectStreamLoader;
