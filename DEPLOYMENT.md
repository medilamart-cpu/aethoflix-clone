# Deployment Guide

Three deployment paths, ranked by difficulty:

1. **Vercel (easiest, riskiest)** — free, instant, but will suspend your account on first DMCA
2. **Cloudflare Pages (middle)** — free, Cloudflare is more permissive but will still comply with US court orders
3. **Self-hosted VPS (hardest, safest)** — full control, no platform ToS exposure

For a Path B operation, you eventually want path 3. But Vercel/CF Pages are fine for development / initial setup.

## Path 1 — Vercel (development only)

```bash
# From inside the aethoflix-clone directory:
npm install
npx vercel   # follow prompts; select your project

# In Vercel dashboard → Settings → Environment Variables:
#   NEXT_PUBLIC_TMDB_API_KEY = <your key>
#   WATCH_GATE_SECRET = <random 12+ char string>
#   WATCH_GATE_ENABLED = false  (during development)
#   AD_PARTNER_URL_1 = ""  (leave empty during development)
#   NEXT_PUBLIC_SITE_NAME = MyFlix

vercel --prod   # deploy to production
```

**When this gets DMCA'd** (and it will, in 1-7 days once it gets any
traffic): Vercel will forward the complaint, give you 24-48 hours to
respond, then suspend. Your domain stays yours but the Vercel hosting is
gone.

## Path 2 — Cloudflare Pages

```bash
npm install
npm run build   # produces .next/ — Cloudflare Pages will run this for you

# Cloudflare Pages dashboard → Create project → Connect to GitHub repo
# Build command: npm run build
# Output directory: .next
# Environment variables: same list as Vercel above
```

Cloudflare is more DMCA-tolerant than Vercel but still complies with US
court orders. They also have a separate "abuse" team that monitors for
"streaming" keywords — your project may get flagged even without a
complaint.

## Path 3 — Self-hosted VPS (production)

This is what AethoFlix actually does. Recommended for any real deployment.

### Step 1 — Pick a VPS provider

| Provider | Country | DMCA posture | Price | Notes |
|----------|---------|-------------|-------|-------|
| **Hetzner** | Germany, Finland | Will forward EU DMCAs; slower to act | €4-10/mo | Cheap, fast, EU-based. AethoFlix-style sites use this commonly. |
| **Vultr** | Many | Will forward US DMCAs | $5-10/mo | Comparable to Hetzner; Singapore/Japan locations available. |
| **DigitalOcean** | US, EU | Will forward US DMCAs quickly | $5-10/mo | Not recommended — too quick to comply. |
| **ColoCrossing** (what AethoFlix uses) | US | US-based, complies but slowly | $5-20/mo | AethoFlix uses this — risky but works. |
| **CloudCores.in** (what Island/Cinema use) | India | DMCA posture unclear | $5-15/mo | Used by AethoFlix sister sites. |
| **OrangeWebsite** | Iceland | Strong DMCA protection (Iceland has no DMCA treaty) | €20-50/mo | Best legal posture, expensive. |
| **Njalla** | Sweden | Anonymous registration, Sweden-based | €25-50/mo | Best for hiding the operator's identity. |
| **Shinjuro** | Russia | Russia ignores DMCA | $10-30/mo | Only option for truly ignoring US DMCAs, but Russian infra is unstable. |

**Recommendation**: Hetzner for cost/performance trade-off. Njalla if you want to hide identity. OrangeWebsite if you want strong legal posture.

### Step 2 — Provision the VPS

```bash
# Get a Linux Ubuntu 24.04 VPS, 2 vCPU, 4 GB RAM minimum
# SSH in:
ssh root@your.vps.ip

# Update + install deps
apt update && apt upgrade -y
apt install -y curl git build-essential

# Install Node 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Caddy (HTTP/3, auto-HTTPS, easy config)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Install PM2 (process manager)
npm install -g pm2
```

### Step 3 — Deploy the app

```bash
# As root (or a non-root user)
mkdir -p /var/www/myflix
cd /var/www/myflix
git clone <your-private-repo> .   # or scp the ZIP and unzip
npm install --omit=dev

# Build
npm run build

# Start with PM2
pm2 start "npm run start" --name myflix
pm2 startup   # follow the printed instructions to enable on boot
pm2 save
```

### Step 4 — Configure Caddy

Edit `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:3000

    # Cache TMDb image requests aggressively
    @images path /_next/image*
    handle @images {
        header Cache-Control "public, max-age=86400"
        reverse_proxy localhost:3000
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
    }

    # Block common scraper user-agents (optional)
    @bad_ua header_regexp User-Agent "(?:scrapy|python-requests|curl|wget)"
    handle @bad_ua {
        respond 403
    }
}
```

Reload Caddy:

```bash
systemctl reload caddy
```

Caddy will auto-provision a Let's Encrypt cert and serve HTTPS on ports 80/443 with HTTP/3.

### Step 5 — Configure environment

Create `/var/www/myflix/.env.local` (NOT in git, NOT world-readable):

```bash
NEXT_PUBLIC_TMDB_API_KEY=your_key
WATCH_GATE_SECRET=$(openssl rand -hex 12)
WATCH_GATE_ENABLED=true
AD_PARTNER_URL_1=https://your-ad-partner.com/path
AD_PARTNER_URL_2=https://backup-ad-partner.com/path
NEXT_PUBLIC_SITE_NAME=MyFlix
```

Rebuild + restart:

```bash
cd /var/www/myflix
npm run build && pm2 restart myflix
```

### Step 6 — Set up sister sites (optional, recommended)

The "operator portfolio" pattern: register 3-5 brand variants on different subdomains. When your main domain gets seized, the others keep working.

AethoFlix uses:
- `aethoflix.world` (main)
- `almostott.aethoflix.world` (sister)
- `theatre.aethoflix.world` (sister)
- `island.aethoflix.world` (sister)
- `cinema.aethoflix.world` (sister)

You can either:
- Run them all on one VPS (single Caddyfile with multiple site blocks)
- Run them on different VPS providers (one seized doesn't take down the others)

For the multi-VPS approach, use the same Caddyfile + deploy recipe on each.

### Step 7 — Set up a Telegram channel

Telegram is the only major chat platform that won't suspend "streaming"
channels. Create a channel for domain announcements:

1. Install Telegram on your phone
2. Create a new channel → "Public" → pick a username like `@myflixsupport`
3. Add a bot via @BotFather → get the bot token
4. Add the bot as admin to your channel
5. Add the channel link to your site's footer (see `src/components/Footer.tsx`)

When your main domain gets seized, post the new domain to the channel.
Users following the channel see it immediately.

### Step 8 — Set up monitoring

You need to know within hours when:
- One of your 9 embed providers goes down (DMCA'd)
- Your own domain gets seized (DNS lookup fails)
- Your VPS gets suspended

Simple approach — a cron job that pings each provider with a known TMDb
ID once per hour and emails you on failure:

```bash
# /usr/local/bin/check-providers.sh
#!/bin/bash
# A simple provider availability checker
PROVIDERS=(
  "https://vidstuck.cc/embed/movie/27205"      # Inception (known good ID)
  "https://vidfast.vc/movie/27205"
  "https://nxsha.space/embed/movie/27205"
  "https://bingr.one/watch/movie/27205"
  "https://zxcstream.cc/player/movie/27205"
  "https://tgvid.lovable.app/embed/movie/27205"
)
for url in "${PROVIDERS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -A "Mozilla/5.0" "$url")
  if [ "$status" != "200" ]; then
    echo "ALERT: $url returned $status" | mail -s "Provider down" you@email.com
  fi
done
```

Add to crontab:
```
0 * * * * /usr/local/bin/check-providers.sh
```

For more sophisticated monitoring, see `MAINTAINER_PLAYBOOK.md`.

## Domain registration (DMCA posture by registrar)

| Registrar | DMCA posture | Notes |
|-----------|--------------|-------|
| **Namecheap** | US-based, will suspend on first DMCA | Avoid for Path B. |
| **GoDaddy** | Same as Namecheap but worse | Avoid. |
| **Porkbun** | Better than Namecheap but still US-based | Risky. |
| **Cloudflare Registrar** | Will forward DMCAs but slow | Decent middle option. |
| **Gandi** | French, follows EU law | Better than US-based. |
| **INWX** | German, follows EU law | Good for EU operators. |
| **Njalla** | Anonymous, Swedish | Best for hiding identity. |
| **OrangeWebsite** | Icelandic, no DMCA treaty | Best legal posture. |
| **Reg.ru** | Russian | Will ignore DMCA entirely, but Russian domains get sanctioned. |

**Recommendation**: Njalla for the domain registration (anonymous, no
WHOIS exposure), OrangeWebsite for hosting. Or use Hetzner + Njalla for a
cost-effective setup.

## Watch-gate setup (Path B anti-bot)

The watch-gate is in `src/lib/watchgate.ts`. It's disabled by default
(`WATCH_GATE_ENABLED=false`). To enable:

1. Generate a deployment secret:
   ```bash
   openssl rand -hex 12
   # Output like: a3f5c8b2e9d1f4a7c8b2e9d1
   ```

2. Set it as `WATCH_GATE_SECRET` in `.env.local` (and on your VPS).

3. Set `WATCH_GATE_ENABLED=true`.

4. Set `AD_PARTNER_URL_1` and `AD_PARTNER_URL_2` to your ad-partner URLs.

5. To generate test codes during development:
   ```bash
   node scripts/generate-code.js movie:1400940
   ```

6. Rebuild + restart. The "Confirm to watch" interstitial will now appear
   on every watch page.

**Important**: The watch-gate is NOT a security feature. The secret is
shipped in the JS bundle, just like AethoFlix. Anyone can extract it and
generate codes. The point is to add friction for scrapers and force
users to view ads. Don't expect it to stop a determined bot operator.

## TLS / HTTPS

Caddy handles this automatically via Let's Encrypt. No setup needed beyond
the Caddyfile above. If you're using Vercel or Cloudflare Pages, TLS is
also automatic.

If you're behind Cloudflare (e.g., Cloudflare DNS proxy), Cloudflare
will issue its own cert between user and CF; Caddy's cert is between CF
and your origin. Both work simultaneously.

## Backups

The only state you actually need to back up is `.env.local` (especially
`WATCH_GATE_SECRET`). Everything else is in git.

```bash
# Once a day:
tar czf /backup/myflix-$(date +%F).tar.gz /var/www/myflix/.env.local
```

## Updating providers

When an embed provider goes down (DMCA'd, domain seized, etc.):

1. Edit `src/lib/providers.ts` — remove or update the offending entry
2. Commit + push
3. SSH into VPS, `git pull && npm run build && pm2 restart myflix`
4. Post the change to your Telegram channel

Takes ~5 minutes from detection to fixed deployment. See
`MAINTAINER_PLAYBOOK.md` for the full operational playbook.
