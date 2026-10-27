"use client";

import { useState } from "react";
import { Copy, Check, Download, ExternalLink, X, CheckCircle2 } from "lucide-react";

interface VlcButtonProps {
  streamUrl?: string | null;
  title: string;
  className?: string;
  compact?: boolean;
}

export function VlcButton({ streamUrl, title, className = "", compact = false }: VlcButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!streamUrl) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy
      const textarea = document.createElement("textarea");
      textarea.value = streamUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleLaunchVlc = () => {
    // Check if on Android
    const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Android Intent for VLC
      const intentUrl = `intent:${streamUrl}#Intent;package=org.videolan.vlc;type=video/*;scheme=https;end`;
      window.location.href = intentUrl;
      setTimeout(() => {
        window.location.href = `vlc://${streamUrl}`;
      }, 500);
    } else {
      // Standard VLC custom protocol
      window.location.href = `vlc://${streamUrl}`;
    }
  };

  const handleDownloadM3U = () => {
    const safeTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || "stream";
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${title}\n${streamUrl}\n`;
    const blob = new Blob([m3uContent], { type: "application/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Stream directly in VLC Media Player, PotPlayer, or IINA"
        className={`inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-200 transition-all cursor-pointer shadow-sm shadow-amber-500/10 ${className}`}
      >
        {/* VLC Traffic Cone SVG */}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 fill-current text-amber-400 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 2L9.5 9h5L12 2zm-3.1 8l-1.4 4h9l-1.4-4h-6.2zm-2.1 6l-2 5.5A1.5 1.5 0 0 0 6.2 23.5h11.6a1.5 1.5 0 0 0 1.4-2l-2-5.5H6.8z" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>Stream in VLC</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-amber-500/20 bg-neutral-900/95 p-6 shadow-2xl shadow-amber-500/5 text-neutral-100 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                  <path d="M12 2L9.5 9h5L12 2zm-3.1 8l-1.4 4h9l-1.4-4h-6.2zm-2.1 6l-2 5.5A1.5 1.5 0 0 0 6.2 23.5h11.6a1.5 1.5 0 0 0 1.4-2l-2-5.5H6.8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  Stream in VLC &amp; External Players
                </h3>
                <p className="text-xs text-neutral-400 line-clamp-1">
                  {title}
                </p>
              </div>
            </div>

            {/* Stream URL Box */}
            <div className="mt-5 rounded-xl border border-white/10 bg-black/60 p-3">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5 font-medium">
                <span>Direct HLS / MP4 Stream Link:</span>
                {copied && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Copied to clipboard!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={streamUrl}
                  className="w-full bg-transparent text-xs text-neutral-300 font-mono focus:outline-none select-all truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleLaunchVlc}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold px-4 py-2.5 text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Launch VLC Player</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadM3U}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium px-4 py-2.5 text-xs transition-all cursor-pointer"
              >
                <Download className="h-4 w-4 text-amber-400" />
                <span>Download .M3U Playlist</span>
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] text-neutral-400">
              <p className="font-semibold text-neutral-300">How to play in VLC or external apps:</p>
              <ul className="list-disc list-inside space-y-1 leading-relaxed">
                <li>
                  <strong className="text-neutral-300">Fastest:</strong> Click <span className="text-amber-300">Download .M3U</span> and double-click the downloaded file — it opens directly in VLC!
                </li>
                <li>
                  <strong className="text-neutral-300">In VLC Desktop:</strong> Press <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white">Ctrl + N</kbd> (or <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] text-white">Cmd + N</kbd> on Mac), paste the stream link, and press Play.
                </li>
                <li>
                  <strong className="text-neutral-300">Mobile (Android / iOS):</strong> Tap <span className="text-amber-300">Launch VLC</span> or open VLC app &rarr; <em>Streams</em> &rarr; paste the link.
                </li>
                <li>
                  Compatible with <strong>PotPlayer, IINA, MPV, MX Player</strong>, and Kodi.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
