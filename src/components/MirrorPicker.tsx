"use client";

import { Server, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProviderOriginalName } from "@/lib/providers";
import { useIsLocalhost } from "@/lib/useIsLocalhost";

interface MirrorPickerProps {
  mirrors: Record<string, string>;
  selected: string | null;
  latencies?: Record<string, number>;
  fastestLabel?: string | null;
  isLoading?: boolean;
  onSelect: (label: string, url: string) => void;
}

export function MirrorPicker({
  mirrors,
  selected,
  latencies = {},
  fastestLabel = null,
  isLoading = false,
  onSelect,
}: MirrorPickerProps) {
  const isLocal = useIsLocalhost();

  // Live site preference: exactly 4 top streaming servers (1-2 Direct CDN + top backups, or 4 top servers)
  const entries = Object.entries(mirrors).slice(0, 4);

  return (
    <div className="mirror-picker-panel transition-all duration-200">
      <div className="mirror-picker-heading flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="section-overline">
            <Server className="h-3 w-3 text-red-500" /> STREAMING SERVERS
          </span>
          <h2>Choose a server</h2>
          <p>Switch between servers if a stream does not start.</p>
        </div>

        {isLoading ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/30 border border-red-500/20 px-2.5 py-0.5 text-[10px] text-red-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Optimizing...</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Ready</span>
          </span>
        )}
      </div>

      <div className="mirror-picker-list" aria-label="Available streaming servers">
        {entries.map(([label, url], index) => {
          const isSelected = selected === label;
          const isDirect =
            url.endsWith(".m3u8") ||
            url.endsWith(".mp4") ||
            url.includes(".m3u8?") ||
            url.includes(".mp4?") ||
            url.includes("/api/v1/stream") ||
            url.includes("/p?t=") ||
            url.startsWith("direct:") ||
            url.startsWith("pending:") ||
            label.toLowerCase().includes("direct");
          const isFastest = fastestLabel === label;
          const latency = latencies[label];

          const originalName = getProviderOriginalName(url) || getProviderOriginalName(label);

          const isTheOG = label.toLowerCase().includes("theog") || url.includes("theogpiratebot");
          const isReCloud = label.toLowerCase().includes("recloud") || url.includes("4animo");
          const isMultiHD =
            label.toLowerCase().includes("multi") ||
            label.toLowerCase().includes("embedwave") ||
            url.includes("nxsha") ||
            url.includes("embedwave.cc");
          const isVidSync = label.toLowerCase().includes("vidsync") || url.includes("hscow") || url.includes("fcxmb") || url.startsWith("direct:pending:vidsync");

          let displayName: string;
          let subtitle: string;

          if (isVidSync) {
            displayName = "Server 1 (Direct CDN)";
            subtitle = isSelected ? "Now streaming" : "4K/1080p · Zero Ads";
          } else if (isTheOG) {
            displayName = "Server 2 (Direct CDN)";
            subtitle = isSelected ? "Now streaming" : "1080p · Fast Backup";
          } else if (isMultiHD) {
            displayName = "Server 3 (Multi HD)";
            subtitle = isSelected ? "Now streaming" : "Multi-Lang Audio · 1080p";
          } else if (isReCloud) {
            displayName = "Server 1 (Direct CDN)";
            subtitle = isSelected ? "Now streaming" : "1080p · Zero Ads";
          } else {
            displayName = originalName
              ? `Server ${index + 1} (${originalName})`
              : `Server ${index + 1}`;
            subtitle = isSelected
              ? "Now streaming"
              : isFastest
              ? `Fastest · ${latency ?? "Ready"}ms`
              : latency
              ? `Ready · ${latency}ms`
              : "Tap to play";
          }

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(label, url)}
              className={cn(
                "server-option mirror-option transition-all duration-150 active:scale-[0.98] select-none",
                isSelected && "server-active ring-1 ring-red-500/50 shadow-md shadow-red-950/20",
                isFastest && !isSelected && "mirror-option-fastest"
              )}
              aria-pressed={isSelected}
            >
              <span className="server-number">
                {isDirect ? (
                  <Zap className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span className="server-name">
                <span className={cn(isSelected ? "text-white font-semibold" : "text-zinc-200")}>
                  {displayName}
                </span>
                <small className={isSelected ? "text-red-400 font-medium" : "text-zinc-400"}>
                  {subtitle}
                </small>
              </span>
              {isSelected ? (
                <Check className="h-4 w-4 text-red-500 ml-auto flex-shrink-0" />
              ) : (
                <span className="mirror-option-arrow text-neutral-500">↗</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlayerLoading() {
  return null;
}
