"use client";

import { useState, useEffect } from "react";
import { Play, RefreshCw, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { MirrorPicker } from "./MirrorPicker";
import { WatchGate } from "./WatchGate";
import { isWatchGateEnabled } from "@/lib/watchgate";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  routingKey: string; // "movie:1400940"
  routingTitle: string;
  mirrors: Record<string, string>;
  adPartnerUrl1?: string;
  adPartnerUrl2?: string;
}

export function VideoPlayer({ routingKey, routingTitle, mirrors, adPartnerUrl1, adPartnerUrl2 }: VideoPlayerProps) {
  const [gateOpen, setGateOpen] = useState(isWatchGateEnabled());
  const [gateVerified, setGateVerified] = useState(!isWatchGateEnabled());
  const mirrorKeys = Object.keys(mirrors);
  const [selectedMirror, setSelectedMirror] = useState<string | null>(mirrorKeys[0] || null);
  const [iframeError, setIframeError] = useState(false);
  const [adShield, setAdShield] = useState(true);

  useEffect(() => {
    const keys = Object.keys(mirrors);
    if (keys.length > 0 && (!selectedMirror || !mirrors[selectedMirror])) {
      setSelectedMirror(keys[0]);
    }
    setIframeError(false);
  }, [routingKey, mirrors]);

  // Global popup defuser: intercepts unwanted window.open / popunder traps
  useEffect(() => {
    if (!adShield) return;
    const originalOpen = window.open;
    window.open = function (...args) {
      console.warn("[Ad-Shield] Blocked popup / redirect attempt:", ...args);
      return null;
    };
    return () => {
      window.open = originalOpen;
    };
  }, [adShield]);

  if (gateOpen) {
    return (
      <WatchGate
        routingKey={routingKey}
        routingTitle={routingTitle}
        adPartnerUrl1={adPartnerUrl1}
        adPartnerUrl2={adPartnerUrl2}
        onVerified={() => {
          setGateVerified(true);
          setGateOpen(false);
        }}
        onClose={() => setGateOpen(false)}
      />
    );
  }

  const url = selectedMirror ? mirrors[selectedMirror] : (mirrorKeys[0] ? mirrors[mirrorKeys[0]] : null);

  return (
    <div className="flex flex-col gap-3">
      {/* Video Viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
        {!url && (
          <div className="flex h-full w-full items-center justify-center text-center">
            <div>
              <Play className="mx-auto h-10 w-10 text-white/30" />
              <p className="mt-3 text-sm text-neutral-400">
                Select a server below to start streaming
              </p>
            </div>
          </div>
        )}
        {url && iframeError && (
          <div className="flex h-full w-full items-center justify-center bg-black">
            <div className="text-center px-6">
              <p className="text-sm text-red-400">
                This server couldn&apos;t load or is blocked in your area.
              </p>
              <button
                onClick={() => {
                  const nextIdx = (mirrorKeys.indexOf(selectedMirror || "") + 1) % mirrorKeys.length;
                  setSelectedMirror(mirrorKeys[nextIdx]);
                  setIframeError(false);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Try next server
              </button>
            </div>
          </div>
        )}
        {url && !iframeError && (
          <iframe
            key={`${routingKey}-${selectedMirror}-${url}-${adShield}`}
            src={url}
            title={`${routingTitle} — ${selectedMirror}`}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            // AdBlock Shield: blocks window.open, tab-unders, and top-level redirect hijacks
            sandbox={
              adShield
                ? "allow-scripts allow-same-origin allow-forms allow-presentation"
                : undefined
            }
            onError={() => setIframeError(true)}
          />
        )}
      </div>

      {/* Control bar: Servers + AdBlocker Shield Switch */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MirrorPicker
            mirrors={mirrors}
            selected={selectedMirror}
            onSelect={(label) => {
              setSelectedMirror(label);
              setIframeError(false);
            }}
          />

          {/* AdBlock Shield Toggle */}
          <button
            type="button"
            onClick={() => setAdShield((prev) => !prev)}
            title={adShield ? "Ad-Shield is active: blocking popups and redirects" : "Ad-Shield is paused: click to re-enable"}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer shadow-sm",
              adShield
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-500/60"
                : "border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 hover:border-amber-500/60"
            )}
          >
            {adShield ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Ad-Shield Active</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span>Ad-Shield Paused</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Loader2 className="h-3 w-3" />
          <span>
            {adShield
              ? "Ad-Shield is active (popups & redirect tabs are automatically blocked). If any player doesn't start, click next Server or toggle Ad-Shield."
              : "Ad-Shield is paused. Popups are permitted by browser."}
          </span>
        </div>
      </div>
    </div>
  );
}
