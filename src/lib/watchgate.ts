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

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Hex(str: string): string {
  const words: number[] = [];
  const asciiBitLength = str.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const compositeArray: number[] = [];
  for (let i = 0; i < str.length; i++) compositeArray.push(str.charCodeAt(i));
  const wordsLen = (((compositeArray.length + 8) >> 6) + 1) << 4;
  for (let i = 0; i < wordsLen; i++) words[i] = 0;
  for (let i = 0; i < compositeArray.length; i++) {
    words[i >> 2] |= (compositeArray[i] & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[compositeArray.length >> 2] |= 0x80 << ((3 - (compositeArray.length % 4)) * 8);
  words[wordsLen - 1] = asciiBitLength;

  for (let j = 0; j < wordsLen; j += 16) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) w[i] = words[j + i];
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = "";
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (8 * j)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }
  return result;
}

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
  const digest = sha256Hex(raw).slice(0, 16);
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
