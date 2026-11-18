# Direct CDN Player & VidSync Architecture Specification

> **CRITICAL ARCHITECTURAL REFERENCE & REGRESSION SAFEGUARD**
> This document defines the permanent invariants, layout specifications, and backend routing rules for the Aethoflix Direct CDN Video Player and VidSync upstream resolution pipeline. 
> Whenever changes are made to streaming, players, or resolvers, this document serves as the ground truth to prevent breakages, missing menus, and wrong movie/show mismatches.

---

## 1. Core Invariants & Golden Rules

1. **Pure Native Video.js 10 Architecture**:
   - The player must use official `@videojs/react/video` components (`VideoPlayer`, `VideoSkin`, `HlsJsVideo`, `Video`, `usePlayer`, `useMedia`).
   - **ZERO floating buttons in corners**: Do NOT place custom floating "Settings", "Fullscreen", or "Quality" buttons in the top-right, top-left, or any corner overlay. All controls MUST live within Video.js's native bottom control bar.
   - **Native Video.js Settings Gear Popup**: Quality (`QualityMenu`), Audio Language (`AudioTrackMenu`), Speed (`PlaybackRateSubmenu`), and Captions (`CaptionsSubmenu`) must all be presented through Video.js's native gear menu popup.

2. **Native Audio Language Control & Multi-Audio Invariant**:
   - Video.js's native `AudioTrackRadioGroupCore` checks `availability = media.audioTrackList.length > 1 ? "available" : "unavailable"`.
   - If a stream only reports 0 or 1 audio track, Video.js sets `hidden: true` and completely hides the Audio row from the settings menu.
   - To guarantee the **Audio / Language control row is always visible and functional** alongside Quality and Speed:
     - The player bridge uses `useMedia()` to access the underlying player adapter (`MediaTracksMixin`).
     - Available audio languages (from `availableAudio`, VidSync multi-lang streams, or default language options) are dynamically synchronized via `media.addAudioTrack(kind, label, language)`.
     - When the user selects a language in the native Audio slide-in menu, the player listens to `media.audioTracks` `"change"` events and seamlessly switches stream playback (or seeks to timestamp if different stream URLs exist).

3. **Streaming Mirror Server Order**:
   - **Server 1**: `Direct CDN` (`VidSync` for Movies/TV, `ReCloud` for Anime) - Instant playback, ad-free, 4K/1080p.
   - **Server 2**: `Multi HD` (`EmbedWave` / `nxsha.space` AwsPly multi-lang embed) - Multi-Language Audio & 1080p.
   - **Server 3**: `VidLink` (`vidlink.pro`) - Fast, resilient 1080p stream.
   - **Server 4**: `VidStuck` (`vidstuck.cc`) - High reliability fallback.
   - *Note*: `TheOGPirateBot` has been permanently removed due to connection timeouts and upstream handshake failures.

4. **The Multi-Rendition HLS Master Playlist Invariant**:
   - Video.js's native `QualityRadioGroupCore` checks `availability = media.videoRenditionList.length > 1 ? "available" : "unavailable"`.
   - If a stream playlist only contains 1 level (e.g. single 720p `.m3u8`), Video.js sets `hidden: true` and **completely hides the Quality row from the settings menu**, leaving only "Speed".
   - **To guarantee the Quality row is always visible**, the player and resolver MUST supply a multi-rendition HLS Master Playlist (`#EXT-X-STREAM-INF`) combining all available levels (1080p, 720p, 480p) via `/api/hls-master` and client-side blob synthesis.

5. **VidSync TMDb Numeric ID Strict Requirement**:
   - VidSync's upstream worker cluster routes media through FNV-1a sharded hashing strictly using **numeric TMDb IDs**.
   - **NEVER** pass IMDb IDs (`tt...`) into VidSync's `id` parameter. String IDs produce hash collisions that serve completely unrelated films or series (e.g. returning a random Hindi film or foreign drama instead of the requested title).

6. **Mandatory Upstream Title Validation Guard**:
   - Upstream shards frequently return candidate objects containing unrelated titles.
   - Always sanitize and compare `source.title` against the requested media title using string normalization and similarity matching.
   - Reject any candidate whose title does not match (e.g. requesting "Castle Rock" but receiving "Castle").

7. **Cross-Type (`movie <-> tv`) Fallback**:
   - Some entries (e.g. miniseries, TV movies, or catalog anomalies like TMDb `60948` *On the Comet*) exist in upstream shards as `tv` instead of `movie` (or vice-versa).
   - If querying with the primary type yields 0 valid streams, automatically execute a fallback query with the alternate type.

8. **Dedicated Upstream Subtitle Catalog**:
   - Query `${shard}/api/subtitles?id=${tmdbId}&type=${type}` in parallel with streams to pull the full 60+ language WebVTT catalog (matching `vidsync.pro/demo`).

---

## 2. Video Player Layout & Component Specification

### Visual Design
- **Theme**: Obsidian dark glass with Netflix crimson accents.
  ```css
  --media-accent-color: #e50914;
  --media-accent-text-color: #ffffff;
  --media-border-color: transparent;
  --media-border-radius: 0.75rem;
  --media-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  ```
- **Controls Layer**:
  - Play/Pause toggle
  - Volume slider and popover
  - Current time, seek slider, remaining time (tabular figures)
  - Native Captions toggle button
  - Native Settings gear button (displays Quality and Speed submenus)
  - Cast, AirPlay, Picture-in-Picture, and Fullscreen buttons

### Master Playlist Synthesis in `VideoJSPlayer.tsx`
When HLS streams come as discrete single-level playlists from the CDN, `VideoJSPlayer.tsx` synthesizes a Master HLS Playlist in-memory:
```typescript
const effectiveSrc = useMemo(() => {
  if (!src || !isHls) return src;
  if (src.startsWith("/api/hls-master")) return src;

  let hlsQualities: Array<{ quality: string; url: string }> = [];

  if (Array.isArray(availableQualities)) {
    for (const q of availableQualities) {
      if (q && typeof q === "object" && q.url && q.url.includes(".m3u8")) {
        hlsQualities.push({ quality: q.quality || "720p", url: q.url });
      }
    }
  }

  // Auto-detect paired resolutions for Castle HLS streams (e.g. 720p <-> 480p)
  if (hlsQualities.length <= 1 && src.includes("/720/")) {
    hlsQualities = [
      { quality: "720p", url: src },
      { quality: "480p", url: src.replace("/720/", "/480/") },
    ];
  } else if (hlsQualities.length <= 1 && src.includes("/1080/")) {
    hlsQualities = [
      { quality: "1080p", url: src },
      { quality: "720p", url: src.replace("/1080/", "/720/") },
      { quality: "480p", url: src.replace("/1080/", "/480/") },
    ];
  }

  if (hlsQualities.length > 1 && typeof window !== "undefined") {
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    const sorted = [...hlsQualities].sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

    const seen = new Set<string>();
    for (const q of sorted) {
      const label = q.quality || "720p";
      if (seen.has(label)) continue;
      seen.add(label);

      const height = parseInt(label) || 720;
      let width = 1280;
      let bandwidth = 2500000;
      if (height >= 1080) { width = 1920; bandwidth = 5000000; }
      else if (height >= 720) { width = 1280; bandwidth = 2500000; }
      else if (height >= 480) { width = 854; bandwidth = 1200000; }
      else { width = 640; bandwidth = 800000; }

      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${label}"`);
      lines.push(q.url);
    }

    const blob = new Blob([lines.join("\n") + "\n"], { type: "application/vnd.apple.mpegurl" });
    return URL.createObjectURL(blob);
  }

  return src;
}, [src, isHls, availableQualities]);
```

### Full Backup: `src/components/VideoJSPlayer.tsx`
```tsx
"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import "@videojs/react/video/skin.css";
import { VideoPlayer, VideoSkin, Video, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    if (!storageKey || hasResumedRef.current || !store) return;
    try {
      const saved = localStorage.getItem(`aethoflix_resume_${storageKey}`);
      if (saved) {
        const t = parseFloat(saved);
        if (t > 5 && isFinite(t)) {
          hasResumedRef.current = true;
          if (typeof store.seek === "function") store.seek(t);
          setResumedNotice(`Resumed at ${formatTime(t)}`);
          setTimeout(() => setResumedNotice(null), 3500);
        }
      }
    } catch { }
  }, [storageKey, store]);

  useEffect(() => {
    const notifyReady = () => {
      if (!hasNotifiedFirstFrameRef.current) {
        hasNotifiedFirstFrameRef.current = true;
        onFirstFrame?.();
      }
    };

    if (currentTime > 0.05 || duration > 0 || !paused) notifyReady();
    const safetyTimer = setTimeout(notifyReady, 2000);
    return () => clearTimeout(safetyTimer);
  }, [currentTime, duration, paused, onFirstFrame]);

  useEffect(() => {
    if (!storageKey || !currentTime || !duration) return;
    if (currentTime > 5 && duration - currentTime > 15) {
      try {
        localStorage.setItem(`aethoflix_resume_${storageKey}`, String(Math.floor(currentTime)));
      } catch { }
    }
  }, [currentTime, duration, storageKey]);

  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  return (
    <>
      {resumedNotice && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none flex items-center gap-2 rounded-xl bg-black/85 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl border border-white/15 backdrop-blur-md animate-in fade-in duration-200">
          <RotateCcw className="h-3.5 w-3.5 text-red-500" />
          <span>{resumedNotice}</span>
        </div>
      )}
    </>
  );
}

export function VideoJSPlayer({
  src,
  poster,
  autoplay = true,
  controls = true,
  className = "",
  subtitles = [],
  availableQualities,
  storageKey,
  onError,
  onFirstFrame,
}: VideoJSPlayerProps) {
  const isHls = src.includes(".m3u8") || (!src.includes(".mp4") && !src.includes(".webm"));

  const effectiveSrc = useMemo(() => {
    if (!src || !isHls) return src;
    if (src.startsWith("/api/hls-master")) return src;

    let hlsQualities: Array<{ quality: string; url: string }> = [];

    if (Array.isArray(availableQualities)) {
      for (const q of availableQualities) {
        if (q && typeof q === "object" && q.url && q.url.includes(".m3u8")) {
          hlsQualities.push({ quality: q.quality || "720p", url: q.url });
        }
      }
    }

    if (hlsQualities.length <= 1 && src.includes("/720/")) {
      hlsQualities = [
        { quality: "720p", url: src },
        { quality: "480p", url: src.replace("/720/", "/480/") },
      ];
    } else if (hlsQualities.length <= 1 && src.includes("/1080/")) {
      hlsQualities = [
        { quality: "1080p", url: src },
        { quality: "720p", url: src.replace("/1080/", "/720/") },
        { quality: "480p", url: src.replace("/1080/", "/480/") },
      ];
    }

    if (hlsQualities.length > 1 && typeof window !== "undefined") {
      const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
      const sorted = [...hlsQualities].sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

      const seen = new Set<string>();
      for (const q of sorted) {
        const label = q.quality || "720p";
        if (seen.has(label)) continue;
        seen.add(label);

        const height = parseInt(label) || 720;
        let width = 1280;
        let bandwidth = 2500000;

        if (height >= 1080) { width = 1920; bandwidth = 5000000; }
        else if (height >= 720) { width = 1280; bandwidth = 2500000; }
        else if (height >= 480) { width = 854; bandwidth = 1200000; }
        else { width = 640; bandwidth = 800000; }

        lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height},NAME="${label}"`);
        lines.push(q.url);
      }

      const manifest = lines.join("\n") + "\n";
      const blob = new Blob([manifest], { type: "application/vnd.apple.mpegurl" });
      return URL.createObjectURL(blob);
    }

    return src;
  }, [src, isHls, availableQualities]);

  useEffect(() => {
    return () => {
      if (effectiveSrc && effectiveSrc.startsWith("blob:")) {
        URL.revokeObjectURL(effectiveSrc);
      }
    };
  }, [effectiveSrc]);

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden select-none ${className}`}>
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
              src={effectiveSrc}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={onFirstFrame}
              onCanPlay={onFirstFrame}
              onPlay={onFirstFrame}
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
              src={src}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              autoPlay={autoplay}
              onLoadedData={onFirstFrame}
              onCanPlay={onFirstFrame}
              onPlay={onFirstFrame}
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
```

---

## 3. How VidSync Works & Why It Shows Different Movies

### The FNV-1a Upstream Sharding Pathology
VidSync runs across multiple distributed Cloudflare Worker shards (`vidsync-shard.vs-sharaparvin76.workers.dev`, `vidsync-worker...`, etc.).
1. When queried, workers hash the request parameters using a 32-bit FNV-1a algorithm to locate the stream metadata across upstream mirrors (Castle, MovieBox, NetMirror).
2. The shard algorithm strictly expects **numeric integer IDs from TMDb** (e.g. `693134`, `60948`, `550`).
3. **What breaks it**:
   - If code passes an IMDb ID (`tt0137523` or `tt0066121`) into `?id=`:
     - The upstream hash router parses non-numeric characters, calculates an erroneous bucket index, and collides with a completely unrelated title.
     - **Result**: The user requests a Hollywood blockbuster or indie film and VidSync returns a random foreign movie or completely unrelated television drama.
   - **Fix**: Strip all non-numeric characters or strictly use numeric TMDb ID for the `id` parameter. Pass IMDb ID only in `?imdb=`.

### Title Matching Guard
Even with numeric IDs, upstream mirrors occasionally return cached or misindexed titles (e.g., returning *Castle* instead of *Castle Rock*).
To eliminate this, `src/app/api/resolve-tg/route.ts` implements a title matching guard:
```typescript
function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function titlesMatch(a: string, b: string): boolean {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (!normA || !normB) return true;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  return false;
}
```
If a candidate source provides a title that fails `titlesMatch(expectedTitle, candidate.title)`, it is rejected immediately.

### Dedicated Subtitle Worker Endpoint
Subtitles are not embedded in the video chunks. VidSync provides them via:
```
${shard}/api/subtitles?id=${tmdbId}&type=${type}
```
*(For TV series: `&season=${s}&episode=${e}`)*.
This endpoint is queried in parallel with streams and returns 60+ WebVTT subtitles matching `vidsync.pro/demo`.

---

## 4. Verification & Testing Checklist

Before committing or deploying any player or resolver code, always run:
1. `npx tsc --noEmit` (Must output 0 errors).
2. `npm run build` (Turbopack production build must exit with code 0).
3. Test the following titles on `localhost:3000`:
   - `http://localhost:3000/watch/movie/693134` (*Dune: Part Two*):
     - Click the gear icon: Both **Quality** (`Auto (720p)`) and **Speed** (`1x`) must appear.
     - Subtitles: 14+ languages must be listed under captions.
   - `http://localhost:3000/watch/movie/60948` (*On the Comet*):
     - Must resolve via cross-type fallback without infinite loading or wrong title collisions.
     - Gear icon shows **Quality** with 1080p, 720p, 480p options.
   - `http://localhost:3000/watch/movie/550` (*Fight Club*):
     - Both Direct CDN Server 1 and Server 2 (MovieBox standby) must be playable.
