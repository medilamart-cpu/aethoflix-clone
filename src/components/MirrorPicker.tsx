"use client";

import { useState } from "react";
import { Server, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MirrorPickerProps {
  mirrors: Record<string, string>;
  selected: string | null;
  onSelect: (label: string, url: string) => void;
}

export function MirrorPicker({ mirrors, selected, onSelect }: MirrorPickerProps) {
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
          const host = url.split("//")[1]?.split("/")[0]?.replace("www.", "") || "";
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(label, url)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                isSelected
                  ? "border-indigo-500 bg-indigo-600/30 text-white shadow-md shadow-indigo-500/20"
                  : "border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/25 hover:bg-white/10 hover:text-white"
              )}
            >
              {isSelected && <Check className="h-3 w-3 text-indigo-400" />}
              <span>{label}</span>
              <span className="text-[10px] text-neutral-400 opacity-75">({host})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PlayerLoadingProps {
  url: string;
}

export function PlayerLoading({ url }: PlayerLoadingProps) {
  return null;
}
