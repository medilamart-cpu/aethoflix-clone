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

  if (isLoading) {
    return (
      <div className="mirror-picker-panel">
        <div className="mirror-picker-heading">
          <span className="section-overline">
            <Server className="h-3 w-3" /> STREAMING SERVERS
          </span>
          <h2>Choose a server</h2>
          <p>Switch between servers if a stream does not start.</p>
        </div>
        <div className="mirror-picker-list" aria-label="Available streaming servers">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="server-option mirror-option mirror-option-loading">
              <span className="server-number">{String(item + 1).padStart(2, "0")}</span>
              <span className="server-name">
                <span>{`Server ${item + 1}`}</span>
                <small>Checking availability</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Live site preference: exactly 4 top streaming servers (1 Direct CDN + 3 top backups, or 4 top servers)
  const entries = Object.entries(mirrors).slice(0, 4);

  return (
    <div className="mirror-picker-panel">
      <div className="mirror-picker-heading">
        <span className="section-overline">
          <Server className="h-3 w-3" /> STREAMING SERVERS
        </span>
        <h2>Choose a server</h2>
        <p>Switch between servers if a stream does not start.</p>
      </div>
      <div className="mirror-picker-list" aria-label="Available streaming servers">
        {entries.map(([label, url], index) => {
          const isSelected = selected === label;
          const isDirect =
            url.endsWith(".m3u8") ||
            url.endsWith(".mp4") ||
            url.includes(".m3u8?") ||
            url.includes(".mp4?") ||
            url.startsWith("direct:");
          const isFastest = fastestLabel === label;
          const latency = latencies[label];

          const originalName = getProviderOriginalName(url) || getProviderOriginalName(label);

          const displayName = isDirect
            ? (isLocal ? "Direct CDN (VidSync)" : "Direct CDN")
            : isLocal && originalName
            ? `Server ${index + 1} (${originalName})`
            : `Server ${index + 1}`;

          const subtitle = isSelected
            ? "Now streaming"
            : isFastest
            ? `Fastest · ${latency ?? "Ready"}ms`
            : latency
            ? `Ready · ${latency}ms`
            : "Tap to play";

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(label, url)}
              className={cn(
                "server-option mirror-option transition-all duration-150",
                isSelected && "server-active",
                isFastest && !isSelected && "mirror-option-fastest"
              )}
              aria-pressed={isSelected}
            >
              <span className="server-number">
                {isDirect ? (
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span className="server-name">
                <span className={cn(isSelected && "text-white font-medium")}>
                  {displayName}
                </span>
                <small>{subtitle}</small>
              </span>
              {isSelected ? (
                <Check className="h-4 w-4 text-cyan-400" />
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
