# VidSync Direct CDN Integration Rules & Invariants

These rules document all architectural findings, breakages, and invariants discovered across VidSync upstream shards. They must be strictly adhered to across all future development.

---

### 1. Numeric TMDb ID Only (No IMDb `tt...` IDs)
- VidSync's upstream worker cluster (`/api/core/streams` and `/api/subtitles`) routes media through FNV-1a sharded workers strictly using numeric TMDb IDs.
- **NEVER** pass IMDb IDs (`tt...`) into VidSync's `id` parameter.
- Upstream shards interpret string IDs incorrectly, triggering hash collisions that return completely unrelated titles (e.g. returning a random Bollywood film or unrelated drama instead of the requested title).

---

### 2. Title Matching Validation Guard
- Every candidate stream from VidSync's providers (Castle, MovieBox, NetMirror) contains title metadata (either in `source.title`, `source.headerTitle`, or encoded in `source.fallbackProxyUrl`).
- **Always validate `source.title` against the requested media title.**
- Normalize both strings (lowercasing, trimming punctuation, stripping accents) and compute similarity.
- If the titles do not match (e.g. requested "Castle Rock" but returned "Castle"), the stream must be rejected immediately to prevent serving the wrong content to the user.

---

### 3. Subtitles via Dedicated Upstream Subtitle API
- VidSync does not embed all subtitles directly in the primary stream object. Instead, it provides the full multi-language catalog via its dedicated endpoint:
  ```
  ${shard}/api/subtitles?id=${tmdbId}&type=${type}
  ```
  *(For TV series, append `&season=${s}&episode=${e}`)*
- Always query `/api/subtitles` in parallel with `/api/core/streams`.
- Parse both `data.subtitles` and raw array responses. This supplies 60+ WebVTT subtitle tracks (English, Spanish, French, German, Arabic, Russian, Chinese, Hindi, etc.) matching `vidsync.pro/demo`.

---

### 4. Multi-Source Resilience & Server 2 Standby Extraction
- VidSync returns multiple distinct streaming providers:
  - **Primary**: Google Cloud CDN / Castle HLS stream
  - **Secondary**: High-bitrate MovieBox / NetMirror direct stream
- Always extract both the active primary stream and the standby provider (`source.standbyUrl` or secondary provider in the response).
- Register the secondary standby stream as **Direct CDN (Server 2)** in `VideoPlayer.tsx` / `MirrorPicker.tsx`. This guarantees that Server 2 is always functional even when external proxies (like TheOG) are down.

---

### 5. Resilient Cross-Type (`movie <-> tv`) Fallback
- Certain titles (e.g. miniseries, TV movies, catalog anomalies like TMDb `60948` *On the Comet*) may be indexed in upstream shards under `tv` instead of `movie` (or vice-versa).
- If querying with the primary type returns 0 valid streams, automatically execute a fallback query with the alternate type (`movie` -> `tv` or `tv` -> `movie`).
- Only report no sources if both primary and fallback types yield no valid matched streams.

---

### 6. Strict Prohibition on Hardcoded Title ID Exclusions
- **NEVER** hardcode exclusions or skips based on specific IDs (e.g. `if (id === "60948") skip...`).
- Hardcoded exclusions are brittle, cause silent regressions when catalog data updates, and break playback for users watching those titles.
- Resolve edge cases through generic algorithmic guards (title similarity matching, cross-type fallback, sanitization) rather than ID-specific blacklists.

---

### 7. Native Video.js Controls Integration
- Player controls (Quality selection, Audio track, Subtitles, Speed) must be integrated directly into the Video.js controls layer (`@videojs/react`).
- Do not place ad-hoc floating buttons or menus in the top corners of the player surface. All player interactivity should live within Video.js's controls bar and menus, maintaining responsive mobile-first accessibility and zero UI clutter.
