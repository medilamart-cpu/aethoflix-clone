# MyFlix — Path B Streaming Aggregator Starter Kit

A complete, deployable clone of the architecture used by sites like
AethoFlix. Built with Next.js 16 + TypeScript + Tailwind 4.



## What's in the box

```
aethoflix-clone/
├── package.json                          # Next.js 16 + React 19 + Tailwind 4
├── next.config.ts                        # image domains + experimental flags
├── tsconfig.json
├── postcss.config.mjs                    # Tailwind 4 PostCSS plugin
├── .env.example                          # all environment vars documented
├── .gitignore
├── .eslintrc.json
│
├── README.md                             # this file
├── DEPLOYMENT.md                         # full deployment guide (offshore / domain / hosting)
├── MAINTAINER_PLAYBOOK.md                # provider maintenance, DMCA response, domain rotation
├── LEGAL.md                              # honest legal risk assessment
│
├── src/
│   ├── app/                              # Next.js App Router routes
│   │   ├── layout.tsx                    # root layout, dark theme, navbar
│   │   ├── globals.css                   # Tailwind 4 + theme tokens
│   │   ├── page.tsx                      # / — homepage with hero + trending rows
│   │   ├── movies/page.tsx               # /movies — Now playing / Popular / Top rated
│   │   ├── series/page.tsx               # /series — Airing today / Popular / Top rated
│   │   ├── kdrama/page.tsx               # /kdrama — TMDb discover with Korean-language filter
│   │   ├── anime/page.tsx                # /anime — AniList trending + seasonal
│   │   ├── anime/[id]/page.tsx           # /anime/{anilist_id} — anime detail + player
│   │   ├── live/page.tsx                 # /live — LiveTVGT channel grid
│   │   ├── search/page.tsx               # /search — TMDb multi-search + AniList search
│   │   ├── search/SearchClient.tsx
│   │   ├── watch/movie/[id]/page.tsx     # /watch/movie/{tmdb_id}
│   │   ├── watch/tv/[id]/page.tsx        # /watch/tv/{tmdb_id}
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── Navbar.tsx                    # sticky nav with mobile menu
│   │   ├── Footer.tsx                    # copyright + contact links
│   │   ├── Hero.tsx                      # homepage hero with trailer iframe
│   │   ├── MediaCard.tsx                 # one movie/TV card
│   │   ├── MediaRow.tsx                  # horizontal scroll row of cards
│   │   ├── DetailPage.tsx               # movie + TV detail pages with player
│   │   ├── VideoPlayer.tsx              # the iframe + mirror picker + watch-gate
│   │   ├── MirrorPicker.tsx              # dropdown to cycle through embed providers
│   │   └── WatchGate.tsx                 # AETHO-XXXX-XXXX code verification modal
│   │
│   └── lib/
│       ├── tmdb.ts                       # TMDb v3 client (trending, popular, discover, detail, videos)
│       ├── anilist.ts                    # AniList GraphQL client
│       ├── livetv.ts                     # LiveTVGT channel guide client
│       ├── providers.ts                  # ⭐ the 9 streaming provider URL builders
│       ├── watchgate.ts                  # AETHO code generation/verification
│       └── utils.ts                      # tiny helpers (cn, formatDate)
│
├── scripts/
│   └── generate-code.js                  # CLI to generate test watch-gate codes
│
└── public/
    └── placeholder.svg
```

## Quick start (local dev)

```bash
# 1. Install dependencies
npm install   # or: pnpm install / yarn / bun install

# 2. Configure environment
cp .env.example .env.local

# 3. Edit .env.local — at minimum, set these two:
#    NEXT_PUBLIC_TMDB_API_KEY=<your-free-tmdb-key>
#    WATCH_GATE_SECRET=<random 12+ char string — see .env.example>

# 4. Run dev server
npm run dev
# → http://localhost:3000
```

## Get a TMDb API key (5 minutes, free)

1. Create a free account at https://www.themoviedb.org/signup
2. Go to **Settings → API → Request API Key** (Developer tier)
3. Fill in the form (any app name, any URL — instant approval)
4. Copy the **API Key (v3 auth)** value
5. Paste it into `.env.local` as `NEXT_PUBLIC_TMDB_API_KEY`

That's it. TMDb keys are public — AethoFlix ships its key in the JS
bundle, fully visible to anyone. No security risk.

## What each streaming provider does

| Provider | What it serves | Notes |
|----------|----------------|-------|
| **TG Vid** (`tgvid.lovable.app`) | Movie/TV iframe player | Built on Lovable (Supabase-backed). Free tier — works for low traffic. |
| **VidStuck** (`vidstuck.cc`) | Movie/TV iframe player | Next.js app on Cloudflare. Independent operator. |
| **ZXCStream** (`zxcstream.cc`) | Movie/TV iframe player | Next.js app on Cloudflare. Has Google Analytics. |
| **VidFast** (`vidfast.vc`) | Movie/TV iframe player | Independent operator. |
| **Nxsha** (`nxsha.space`) | Movie/TV iframe player | Independent operator. |
| **Bingr** (`bingr.one`) | Movie/TV iframe player | Independent operator. |
| **MegaPlay** (`megaplay.buzz`) | Anime iframe player | AniList-ID based. |
| **ReCloud** (`cdn.4animo.xyz` → `novuscloud.buzz`) | Anime iframe player | Redirects to NovusCloud. |
| **Zokoanime** (`zokoanime.video`) | Anime iframe player | Switches between AniList and MAL IDs. |

The user's browser loads each iframe directly — your server never proxies
the content. This is the legal-defensibility hook ("we just embed, we don't
host")

## Customisation quick reference

| What | Where to change |
|------|-----------------|
| Site name in navbar/footer | `.env.local` → `NEXT_PUBLIC_SITE_NAME` |
| TMDb API key | `.env.local` → `NEXT_PUBLIC_TMDB_API_KEY` |
| Watch-gate on/off | `.env.local` → `WATCH_GATE_ENABLED` (`true` / `false`) |
| Watch-gate secret | `.env.local` → `WATCH_GATE_SECRET` (random string) |
| Ad partner URLs | `.env.local` → `AD_PARTNER_URL_1` / `AD_PARTNER_URL_2` |
| Add/remove a streaming provider | `src/lib/providers.ts` → `STREAMING_PROVIDERS` or `ANIME_STREAMING_PROVIDERS` |
| Live TV backend | `.env.local` → `NEXT_PUBLIC_LIVETV_ENDPOINT` (or rewrite `src/lib/livetv.ts`) |
| Color theme | `src/app/globals.css` → `@theme { --color-* }` |
| Routes / pages | `src/app/` directory — each folder is a route |

## Architecture at a glance

```
┌────────────────────────────────────────────────────────────┐
│  Your Next.js app (this repo)                                │
│  • Server components fetch TMDb / AniList / LiveTVGT         │
│  • Client components render the video player + mirror picker│
│  • Watch-gate hash is computed server-side, verified         │
│    client-side (the secret ships in the JS bundle — that's  │
│    how AethoFlix does it too; not a security feature, just   │
│    friction against scrapers)                               │
└────────────────────────────────────────────────────────────┘
              │                │                │
              ▼                ▼                ▼
        ┌─────────┐      ┌──────────┐     ┌────────────┐
        │  TMDb   │      │ AniList  │     │ LiveTVGT   │
        │ catalog │      │ GraphQL  │     │ live TV    │
        └─────────┘      └──────────┘     └────────────┘

              │ (user clicks Watch)
              ▼
┌────────────────────────────────────────────────────────────┐
│  iframe loaded by user's browser                             │
│  → https://vidstuck.cc/embed/movie/{tmdb_id}                  │
│  → https://vidfast.vc/tv/{tmdb_id}/{season}/{episode}         │
│  → https://zokoanime.video/stream/anilist/{id}/{s}/{e}       │
│  (one of 9 providers; user cycles via Mirror picker)         │
└────────────────────────────────────────────────────────────┘
```

## Read these next

1. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — full deployment guide
   (Vercel, Cloudflare Pages, offshore VPS with Caddy, domain setup,
   watch-gate configuration, sister-site strategy)
2. **[MAINTAINER_PLAYBOOK.md](./MAINTAINER_PLAYBOOK.md)** — operational
   tasks (provider monitoring, DMCA response, ad network setup,
   Telegram support channel)

## What's intentionally NOT in this kit

| What | Why |
|------|-----|
| Ad-network integration code | Every grey ad network has its own SDK; I can't ship one without picking one. See MAINTAINER_PLAYBOOK for the categories and your options. |
| Telegram bot for domain updates | AethoFlix uses Telegram to announce new domains. You'll need this once your primary domain gets seized. Implement with `telegraf` after you have a Telegram bot token. |
| User accounts | AethoFlix deliberately skips these. localStorage-only "My List" is enough for an aggregator; you don't want to collect PII you'd have to protect. |
| Analytics beacon | AethoFlix has `live.aethoflix.world/v1/hit`. You can build your own (a 5-line Hono server) or skip it. Plausible Analytics is the easiest self-hostable option. |
| Path A (legit) integration | This kit is Path B only. If you want to also offer Netflix / Prime deep links via TMDb's `/watch/providers`, add a new file `src/lib/legit-providers.ts` modeled after `providers.ts` but calling the TMDb endpoint. |

## License

MIT. The 9 streaming providers' embed URLs are publicly visible in any
streaming aggregator's source code and can be considered public
information; reproducing them in code does not constitute circumvention
of any access control.

You're responsible for any use of this code.
