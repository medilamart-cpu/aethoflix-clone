/**
 * Watch-gate — the AETHO-XXXX-XXXX verification code mechanism.
 *
 * The watch-gate is an interstitial that asks users to visit an ad partner
 * before showing the video iframe. It's not a security mechanism — it's
 * a friction mechanism to slow down scrapers and convert visits to ad
 * revenue for the operator.
 *
 * How it works:
 *   1. User clicks "Watch" on a detail page
 *   2. SPA shows a "Confirm to watch" interstitial with two buttons:
 *      - "Open ads page" (visits an ad partner URL)
 *      - An input box for an AETHO-XXXX-XXXX code
 *   3. The ad partner page (after the user views ads) shows a code
 *      like AETHO-ABCD1234
 *   4. User enters the code; SPA verifies it by recomputing the same
 *      hash and comparing
 *   5. On success, SPA sets ?pass=...&ts=... on the URL and shows the iframe
 *
 * The verification:
 *   fs(to, ts) = sha256(`${to}|${ts}|${DEPLOYMENT_SECRET}`).slice(0, 16)
 *   expected_code = `AETHO${fs(to, ts).slice(0, 8).toUpperCase()}`
 *
 * Where:
 *   to = routing key like "movie:1400940" or "tv:220542"
 *   ts = Unix timestamp (seconds)
 *   DEPLOYMENT_SECRET = per-deployment random string in env var
 *
 * ── Bypass modes ─────────────────────────────────────────────────────────
 *
 *  • Set WATCH_GATE_ENABLED=false in .env to disable entirely (Path A)
 *  • Set WATCH_GATE_ENABLED=true and AD_PARTNER_URL_1="" to require
 *    the code but not show the "Open ads page" button (testing mode)
 *  • Set both AD_PARTNER_URLs and WATCH_GATE_ENABLED=true for the
 *    full Path B experience
 *
 * ── Generating codes for testing ──────────────────────────────────────────
 *
 *  Run `node scripts/generate-code.js <routing-key> <timestamp>` (you can
 *  also just paste this code's `generateCode` into a script). The code
 *  is 13 chars total: AETHO-XXXX-XXXX (we don't include the dashes —
 *  the SPA normalizes by stripping non-alphanumerics).
 */

import { createHash } from "node:crypto";

const DEPLOYMENT_SECRET = process.env.WATCH_GATE_SECRET ?? "changeme_to_random_12_chars";
const WATCH_GATE_ENABLED = process.env.WATCH_GATE_ENABLED === "true";

export function isWatchGateEnabled(): boolean {
  return WATCH_GATE_ENABLED;
}

/**
 * Compute the AETHO-XXXX-XXXX code for a given routing key and timestamp.
 *
 * @param to   Routing key, e.g., "movie:1400940" or "tv:220542"
 * @param ts   Unix timestamp (seconds)
 * @returns    13-character code, e.g., "AETHOABCD1234"
 */
export function generateCode(to: string, ts: number): string {
  const raw = `${to}|${ts}|${DEPLOYMENT_SECRET}`;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `AETHO${digest.slice(0, 8).toUpperCase()}`;
}

/**
 * Verify a user-supplied code against the expected value.
 *
 * @param input  The user's input (case-insensitive, may have dashes/spaces)
 * @param to    The routing key (must match what was used to generate)
 * @param ts    The timestamp (must be within the time window — see below)
 * @param windowSeconds  Allowed clock skew in seconds (default: ±5 min)
 */
export function verifyCode(
  input: string,
  to: string,
  ts: number,
  windowSeconds: number = 300,
): boolean {
  const normalized = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Check the code against multiple timestamps in the window to allow
  // for clock skew between user and server
  const now = Math.floor(Date.now() / 1000);
  for (let t = ts - windowSeconds; t <= ts + windowSeconds; t += 30) {
    const expected = generateCode(to, t);
    if (normalized === expected) return true;
    // Also check now() and ts (in case the caller's clock is off)
  }
  // Check the literal ts first (exact match)
  if (normalized === generateCode(to, ts)) return true;
  // Check now()
  if (Math.abs(now - ts) <= windowSeconds && normalized === generateCode(to, now)) return true;
  return false;
}

/**
 * Build the URL params that grant access after a successful code entry.
 * The SPA appends these to the current URL so the gate can be re-verified
 * on reload without requiring the user to re-enter the code.
 */
export function buildPassParams(to: string, ts: number, code: string): string {
  return new URLSearchParams({ pass: code, ts: String(ts), to }).toString();
}

/**
 * Check if the current URL already has ?pass=...&ts=... that verify
 * for the given routing key. Used on page load to skip the gate.
 */
export function hasValidPassInUrl(to: string, searchParams: URLSearchParams): boolean {
  const pass = searchParams.get("pass");
  const ts = searchParams.get("ts");
  if (!pass || !ts) return false;
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) return false;
  return verifyCode(pass, to, tsNum);
}
