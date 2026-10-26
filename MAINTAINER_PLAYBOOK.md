# Maintainer Playbook

The technical build is the easy 20%. The other 80% is keeping it
running once studios start paying attention. This is the operational
checklist.

## Daily / weekly tasks

### 1. Monitor provider availability (daily)

Each of the 9 embed providers can disappear without warning. Set up a
monitor that pings each provider once per hour and alerts you on
failure.

**Cheap approach**: cron + curl + email (see `DEPLOYMENT.md` step 8).

**Better approach**: Uptime Kuma (self-hosted, free, has webhooks for
Discord/Telegram/Slack):

```bash
docker run -d --name uptime-kuma -p 3001:3001 -v uptime-kuma:/app/data --restart unless-stopped louislam/uptime-kuma:1
```

Add a monitor per provider URL (use a known-good TMDb ID like 27205
for Inception). Set 5-minute intervals. Get alerts on Discord/Telegram.

**Enterprise approach**: a custom script that pings each provider with
5-10 known TMDb IDs, checks for `<video` or `m3u8` or `<iframe` in the
response, and reports provider "health" as a percentage. Triggers an
alert when health drops below 50%.

### 2. Rotate the WATCH_GATE_SECRET (weekly)

The deployment secret isn't actually secret — it ships in your JS
bundle. But rotating it forces anyone who's been generating codes
without visiting your ad partner to re-extract the new secret.

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 12)

# Update on the server
sed -i "s/^WATCH_GATE_SECRET=.*/WATCH_GATE_SECRET=$NEW_SECRET/" /var/www/myflix/.env.local

# Rebuild + restart
cd /var/www/myflix && npm run build && pm2 restart myflix
```

Frequency: weekly minimum. More often if your traffic spikes.

### 3. Check analytics beacon (weekly)

If you've set up a custom analytics endpoint (or just use Plausible),
check that traffic looks reasonable. A sudden 10x traffic spike can
mean:
- A Reddit/forum post went viral (good — make sure your VPS can handle it)
- A bot operator is scraping you (bad — enable rate limiting)
- A DMCA bot is cataloging your site (bad — they're preparing a complaint)

## Monthly tasks

### 1. Audit your ad network (monthly)

If you're using ad networks to monetize the watch-gate (Path B), they
will eventually try to scam you. Common scams:

- **Reporting less traffic than actually occurred** — keep your own
  analytics and compare.
- **Paying lower CPMs than agreed** — check the contract terms monthly.
- **Banning your account for "fraud" right before payout** — keep
  screenshots of your dashboard; threaten chargebacks via your bank.
- **Switching to a different domain without telling you** — your
  existing integrations break.

The honest reality: grey ad networks are mostly scams. The few that
aren't (PropellerAds, Monetag, HilltopAds, Adsterra) pay 1/10th to
1/100th of what AdSense pays, AND they ban accounts constantly.

Expect $0.10-0.50 per 1000 ad views. AethoFlix with 100K visits/day
probably makes $10-50/day from the watch-gate ads. Not life-changing
money.

### 2. Check your domain's WHOIS privacy (monthly)

Most offshore registrars include WHOIS privacy by default. But:
- Some registrars expose the registrant email after a complaint
- Some WHOIS privacy services ("WhoisGuard", "Njalla Privacy") lapse
  annually and reveal your info during the renewal window
- ICANN requires periodic email verification — make sure that email
  goes to an anonymous mailbox, not your real one

Use a separate email for the registrar — a ProtonMail address is fine.
Never use Gmail.

### 3. Back up your code (monthly)

The repo is small. Push it to 2-3 private GitHub/GitLab repos. If your
main account gets banned (GitHub will ban "streaming" repos on
complaint), you have backups.

```bash
# Add multiple remotes
git remote add origin git@github.com:you/myflix.git
git remote add gitlab git@gitlab.com:you/myflix.git
git remote add bitbucket git@bitbucket.org:you/myflix.git

# Push to all
git push all --all
```

## Event-driven tasks

### When a provider goes down

1. Confirm it's down (check 5-10 known IDs, not just one)
2. Check if it's a domain seizure (DNS lookup fails) or just a 500/timeout
3. If domain seizure: search for the new domain (usually announced on
   Reddit /r/fmovies, /r/2embedstyle subreddits; or on Telegram channels
   that monitor provider changes)
4. If just a 500: wait 24 hours, check again
5. Update `src/lib/providers.ts` with the new domain or remove the entry
6. Commit + push + redeploy
7. Post to your Telegram channel: "Server N updated — try again"

### When your domain gets seized

1. Your domain registrar will email you a DMCA notice. Don't respond
   immediately — you have 24-48 hours typically.
2. Move your DNS to a new domain (one of your pre-registered sister
   domains). Update Cloudflare DNS to point the new domain at your VPS.
3. Push a new deploy with the new domain in `NEXT_PUBLIC_SITE_NAME`
   and footer links.
4. Update the Telegram channel: "We've moved to newdomain.com —
   bookmark this channel for future moves."
5. After 24-48 hours, file a DMCA counter-notice if you want to fight
   the seizure (most operators don't — it's cheaper to just move).

### When you receive a DMCA complaint

You will receive DMCAs. Here's the realistic response:

1. **Don't ignore them** — ignoring = automatic suspension.
2. **Don't take down the linked content** — you can't, you don't host it.
3. **Respond with "we are an aggregator, not a host" template**:
   ```
   We have received your DMCA notice dated [date]. The page you
   referenced links to a third-party embed provider, not to content
   hosted by us. We have disabled the link in question and forwarded
   your complaint to the operator of [provider domain].
   ```
4. Then remove the offending provider from your mirror list and
   redeploy.
5. If the complaint targets your domain itself (not a specific link),
   you have 24-48 hours to file a counter-notice or your domain will
   be suspended.

In practice, most Path B operators just move domains. The DMCA
counter-notice process is rarely worth the legal cost.

### When you receive a takedown from your VPS provider

This is more serious — your VPS provider can suspend you immediately.

1. Move to a different VPS immediately.
2. Restore from git on the new VPS.
3. Update DNS to point at the new IP.
4. The old VPS will get shut down — your data on it is gone (but you
   have everything in git).

Avoid this entirely by using a VPS provider that doesn't forward
DMCAs (Njalla, OrangeWebsite, or any Russian provider).

### When your ad network bans you

1. Switch to a backup ad network (you should have 2-3 integrated at
   all times for exactly this reason).
2. Submit a chargeback via your bank for any unpaid balance (most
   grey ad networks process via high-risk processors; chargebacks work).
3. Don't expect to recover the money. Treat it as a sunk cost.

## Long-term strategy: don't put all your eggs in one basket

The AethoFlix operator's actual strategy:

1. **4 sister sites** (`aethoflix.world`, `almostott`, `theatre`,
   `island`, `cinema`) — when one is seized, the others keep working
2. **Multiple Lovable projects** (`tgvid`, `livetgtv`, `tgdl`) — when
   one is suspended, the others keep working
3. **Multiple VPS providers** (ColoCrossing + CloudCores) — when one
   suspends, the others keep working
4. **Telegram channel** for domain announcements
5. **Multiple domain names** registered through different registrars

For your clone:
- Start with one domain + one VPS for MVP
- Add 2 sister domains when you get any traction (sub-$100/month
  revenue)
- Move to multi-VPS when revenue justifies it ($500+/month)
- Hire a lawyer when revenue exceeds $5K/month — at that point you're
  a real target

## Realistic revenue projections (Path B)

| Stage | Traffic | Monthly revenue | Notes |
|-------|---------|-----------------|-------|
| Launch | 0-100 visits/day | $0-5 | Ads pay almost nothing at low traffic |
| Initial growth | 1-10K visits/day | $50-500 | Mostly from grey ad networks; high churn |
| Significant | 10-100K visits/day | $500-5K | This is AethoFlix's range |
| Major | 100K-1M visits/day | $5K-50K | This is FMovies / 123movies territory |
| Top tier | 1M+ visits/day | $50K+ | Very few operators reach this; constant legal pressure |

Realistic expectation for a new site: $50-500/month in the first 6
months. After that, either you grow (and your legal exposure grows) or
you stagnate.

## What you can't automate (and shouldn't try)

| Task | Why you can't automate |
|------|----------------------|
| Detecting provider seizures before users complain | Providers don't announce seizures; you only know when users start failing |
| Negotiating with ad networks | Networks don't deal with bots; you have to do this yourself |
| Responding to legal complaints | Counter-notices require a physical signature (or e-signed legal affidavit) |
| Picking new domain names | Has to be memorable, unreg'd, and not too similar to known brands |

## Final honest note

You will spend roughly 30% of your time on operations (provider
updates, DMCA responses, ad network issues, domain rotations) and 70%
on code/features. This ratio is why most Path B operators eventually
give up — it's exhausting, the money isn't great, and the legal risk
never goes away.

If you want to make money in this space, **strongly consider Path A**
instead. Same codebase, swap the iframe URL builders for TMDb's
`/watch/providers` deep links, add affiliate partnerships with
Netflix/Prime. Lower per-user revenue but you can sleep at night.
