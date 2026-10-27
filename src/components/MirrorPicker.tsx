"use client";

import { Server, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface MirrorPickerProps {
  mirrors: Record<string, string>;
  selected: string | null;
  latencies?: Record<string, number>;
  fastestLabel?: string | null;
  onSelect: (label: string, url: string) => void;
}

export function MirrorPicker({
  mirrors,
  selected,
  latencies = {},
  fastestLabel = null,
  onSelect,
}: MirrorPickerProps) {
  const entries = Object.entries(mirrors);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Quick Server Switch Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
          <Server className="h-3.5 w-3.5 text-indigo-400" /> Servers:
        </span>
        {entries.map(([label, url]) => {
          const isSelected = selected === label;
          const isDirect =
            url.endsWith(".m3u8") ||
            url.endsWith(".mp4") ||
            url.includes(".m3u8?") ||
            url.includes(".mp4?") ||
            url.startsWith("direct:");
          const host = isDirect
            ? "Direct CDN"
            : url.split("//")[1]?.split("/")[0]?.replace("www.", "") || "";

          const isFastest = fastestLabel === label;
          const latency = latencies[label];

          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(label, url)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                isSelected
                  ? isDirect
                    ? "border-emerald-500 bg-emerald-600/30 text-white shadow-md shadow-emerald-500/20"
                    : "border-indigo-500 bg-indigo-600/30 text-white shadow-md shadow-indigo-500/20"
                  : isDirect
                  ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/20"
                  : isFastest
                  ? "border-amber-500/40 bg-amber-500/[0.08] text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/20"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
              )}
            >
              {isSelected && <Check className="h-3 w-3 text-emerald-400" />}
              {isFastest && !isSelected && <Zap className="h-3 w-3 text-amber-400 animate-pulse" />}
              <span>{label}</span>
              <span className="text-[10px] text-neutral-400 opacity-75">
                {isDirect ? "⚡ Direct" : latency ? `${latency}ms` : `(${host})`}
              </span>
              {isFastest && (
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                  Fastest
                </span>
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
