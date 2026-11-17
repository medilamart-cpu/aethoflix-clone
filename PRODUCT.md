# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Public streaming community seeking a clean, fast, and premium movie, TV series, and anime watching experience without invasive ad popups, deceptive redirects, or clunky low-bitrate players.

## Product Purpose
AethoFlix provides instant, ad-free, high-definition entertainment streaming with an interface that matches the visual polish and fluidity of top commercial platforms (Netflix, Apple TV). It replaces messy aggregator hubs with a reliable, elegant, multi-server streaming experience.

## Positioning
Direct CDN Master Streams: unlike standard aggregator sites that simply dump viewers into ad-riddled, sandboxed iframes, AethoFlix resolves and streams direct unencrypted HLS master playlists (VidSync, TheOGPirateBot, ReCloud) natively inside a custom Video.js player with zero ads, hardware acceleration, and automatic mirror failover.

## Operating Context
- Environments: Desktop browsers, mobile browsers (iOS Safari, Android Chrome), tablets, casting, and smart TV browsers.
- Interaction scenes: Lean-back living room viewing, on-the-go mobile playback, rapid server switching during ISP throttle, episodic binge-watching with auto-resume timestamp persistence.

## Capabilities and Constraints
- Direct CDN Playback: Direct HLS m3u8 streaming with custom native device player controls, auto-resume timestamp persistence, and multi-track audio.
- Multi-Server Redundancy: Dynamic server racing and sequential server mapping:
  - Server 1: VidSync (Direct CDN 4K/1080p, Zero Ads)
  - Server 2: TheOGPirateBot (Direct CDN 1080p)
  - Server 3: Multi HD / EmbedWave (Multi-language audio: Hindi + English on unblocked nxsha.space)
  - Server 4+: Clean third-party embed backups (VidLink, VidFast, VidNest)
- Cloudflare Pages Edge Deployment: Strict compatibility with Cloudflare Edge runtime (`export const runtime = 'edge'`).
- Technical Constraints: No client-side ad injection; all direct streams must start unmuted without forced mute overlays; sub-resources must avoid ISP-blocked domains.

## Brand Commitments
- Dark cinematic visual world (#050505, #080a0f, #e50914 crimson red accents, #22d3ee cyan accents, glassmorphic cards).
- Zero emojis anywhere in the codebase, labels, or UI chrome.
- Mobile-first touch layout with fluid responsiveness and native fullscreen AVPlayer / Android video support.

## Evidence on Hand
- Next.js 16 App Router codebase deployed on Cloudflare Pages (`https://aethoflix-clone.pages.dev`).
- Active APIs: `/api/resolve-tg`, `/api/resolve-theog`, `/api/resolve-recloud`, `/api/check-servers`.
- TMDb metadata pipeline for posters, backdrops, episode lists, and runtime info.

## Product Principles
1. Playback Over Chrome: The video stream and viewing experience take absolute priority over secondary UI.
2. Zero Ads on Direct CDN: Primary streams must never inflict popups, deceptive redirects, or intrusive overlays on the viewer.
3. Instant Failover: If a stream shard drops or is blocked, the user is seamlessly routed to the next fastest working mirror with zero friction.
4. Native Craft: Interfaces, gestures, fullscreens, and loaders must feel like an installed native app rather than a fragile web wrapper.
