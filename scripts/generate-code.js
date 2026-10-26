#!/usr/bin/env node
/**
 * Generate a watch-gate code for testing.
 *
 * Usage:
 *   node scripts/generate-code.js <routing-key> [timestamp]
 *
 * Examples:
 *   node scripts/generate-code.js movie:1400940
 *   node scripts/generate-code.js tv:220542 1730000000
 *   node scripts/generate-code.js anime:123542 1730000000
 *
 * The script reads WATCH_GATE_SECRET from the environment. Make sure
 * the secret matches what's in your .env.local — otherwise the SPA's
 * verification won't accept the code you generate.
 *
 * You'll need a Node version that supports `--env-file` (Node 20+), or
 * set the env var manually:
 *
 *   WATCH_GATE_SECRET=your_secret node scripts/generate-code.js movie:1400940
 *
 * Or use dotenv:
 *   npm install -D dotenv
 *   node -r dotenv/config scripts/generate-code.js movie:1400940
 */

const crypto = require("node:crypto");

const secret = process.env.WATCH_GATE_SECRET;
if (!secret) {
  console.error("Error: WATCH_GATE_SECRET is not set.");
  console.error("Add it to your .env.local or pass it inline, e.g.:");
  console.error("  WATCH_GATE_SECRET=your_secret node scripts/generate-code.js movie:1400940");
  process.exit(1);
}

const routingKey = process.argv[2];
if (!routingKey) {
  console.error("Usage: node scripts/generate-code.js <routing-key> [timestamp]");
  console.error('  e.g., node scripts/generate-code.js "movie:1400940"');
  process.exit(1);
}

const ts = process.argv[3] ? parseInt(process.argv[3], 10) : Math.floor(Date.now() / 1000);
if (!Number.isFinite(ts)) {
  console.error("Invalid timestamp. Use a Unix timestamp in seconds (integer).");
  process.exit(1);
}

const raw = `${routingKey}|${ts}|${secret}`;
const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
const code = `AETHO${digest.slice(0, 8).toUpperCase()}`;

console.log("─".repeat(64));
console.log("Watch-gate code");
console.log("─".repeat(64));
console.log(`Routing key:   ${routingKey}`);
console.log(`Timestamp:     ${ts} (Unix seconds)`);
console.log(`Secret:        ${secret.slice(0, 4)}…${secret.slice(-2)}`);
console.log(`Code:          ${code}`);
console.log("");
console.log("Type this code into the watch-gate input field.");
console.log("─".repeat(64));
