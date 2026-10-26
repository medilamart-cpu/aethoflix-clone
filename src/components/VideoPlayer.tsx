"use client";

import { useState, useEffect } from "react";
import { Play, RefreshCw, Loader2 } from "lucide-react";
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

  useEffect(() => {
    const keys = Object.keys(mirrors);
    if (keys.length > 0 && (!selectedMirror || !mirrors[selectedMirror])) {
      setSelectedMirror(keys[0]);
    }
    setIframeError(false);
  }, [routingKey, mirrors]);

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
            key={`${routingKey}-${selectedMirror}-${url}`}
            src={url}
            title={`${routingTitle} — ${selectedMirror}`}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onError={() => setIframeError(true)}
          />
        )}
      </div>

      {/* Server selector and helper info */}
      <div className="flex flex-col gap-2">
        <MirrorPicker
          mirrors={mirrors}
          selected={selectedMirror}
          onSelect={(label) => {
            setSelectedMirror(label);
            setIframeError(false);
          }}
        />
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Loader2 className="h-3 w-3" />
          If video does not start immediately, click any other Server button above. Different servers use different fast CDN streams.
        </div>
      </div>
    </div>
  );
}
