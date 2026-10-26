"use client";

import { useState } from "react";
import { ExternalLink, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import { generateCode, verifyCode, isWatchGateEnabled } from "@/lib/watchgate";

interface WatchGateProps {
  routingKey: string; // e.g., "movie:1400940" or "tv:220542"
  routingTitle: string;
  adPartnerUrl1?: string;
  adPartnerUrl2?: string;
  onVerified: () => void;
  onClose: () => void;
}

/**
 * The "Confirm to watch" interstitial.
 *
 * Shows two paths to verifying:
 *  1. "Open ads page" — links to an ad-partner URL that displays a code
 *     after the user views some ads
 *  2. Direct code entry — for users who already have a code (or for the
 *     operator testing the gate without the ad partner)
 *
 * The operator can also disable the gate entirely via WATCH_GATE_ENABLED=false.
 * In that case, the parent component shouldn't render this at all (it
 * should check `isWatchGateEnabled()` first), but if it does render,
 * we auto-verify immediately.
 */
export function WatchGate({ routingKey, routingTitle, adPartnerUrl1, adPartnerUrl2, onVerified, onClose }: WatchGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Bypass gate entirely if disabled at deploy time
  if (!isWatchGateEnabled()) {
    onVerified();
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    const ts = Math.floor(Date.now() / 1000);
    if (verifyCode(code, routingKey, ts)) {
      onVerified();
    } else {
      setError("Invalid or expired code. Please generate a new code from the ad partner.");
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
            <KeyRound className="h-5 w-5" />
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 text-xl font-semibold">Confirm to watch</h2>
        <p className="mt-2 text-sm text-neutral-400">
          One quick ad round keeps {routingTitle} streaming for everyone. Open the ads
          page, tap Continue when it&apos;s ready — or enter the code it shows.
        </p>

        {(adPartnerUrl1 || adPartnerUrl2) && (
          <div className="mt-6 space-y-2">
            {adPartnerUrl1 && (
              <a
                href={adPartnerUrl1}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
              >
                <ExternalLink className="h-4 w-4" /> Open ads page
              </a>
            )}
            {adPartnerUrl2 && (
              <a
                href={adPartnerUrl2}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" /> Backup ad page
              </a>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-neutral-600">
          <div className="h-px flex-1 bg-white/10" /> or enter the code{" "}
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="text"
            placeholder="AETHO-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Watch code"
            className="min-h-12 w-full rounded-full border border-white/15 bg-white/[0.05] px-4 text-center font-mono text-sm uppercase tracking-widest text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-neutral-600 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!code || verifying}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Verify
              </>
            )}
          </button>
          {error && (
            <p className="mt-3 text-center text-xs text-red-400">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
