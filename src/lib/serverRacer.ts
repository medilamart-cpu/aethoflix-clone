/**
 * Server Latency & Availability Racer
 * Concurrently races streaming mirrors to find the fastest, lowest-latency
 * server for the user's specific location and network.
 */

export interface ServerPingResult {
  label: string;
  url: string;
  latency: number;
  healthy: boolean;
}

const LATENCY_STORAGE_KEY = "aethoflix_server_latencies_v1";

/**
 * Reads historically fastest servers from localStorage
 */
export function getStoredLatencies(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LATENCY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves measured server latencies to localStorage
 */
export function saveStoredLatencies(latencies: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredLatencies();
    const updated = { ...existing, ...latencies };
    localStorage.setItem(LATENCY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Gets the historically fastest server among the provided mirror keys
 */
export function getHistoricallyFastest(mirrors: Record<string, string>): string | null {
  const stored = getStoredLatencies();
  const directKey = Object.keys(mirrors).find(
    (k) => k.includes("Direct") || mirrors[k].includes(".m3u8") || mirrors[k].includes(".mp4")
  );

  // Direct CDN always gets highest priority if available
  if (directKey) return directKey;

  let bestLabel: string | null = null;
  let lowestLatency = Infinity;

  for (const label of Object.keys(mirrors)) {
    const host = getHostFromUrl(mirrors[label]);
    if (host && stored[host] && stored[host] < lowestLatency) {
      lowestLatency = stored[host];
      bestLabel = label;
    }
  }

  return bestLabel;
}

/**
 * Extracts the clean hostname from a URL
 */
export function getHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[2]?.replace(/^www\./, "") || url;
  }
}

/**
 * Probes a server URL's latency using an abortable no-cors request.
 * Resolves as soon as the HTTP headers/connection are established.
 */
export async function probeServer(
  label: string,
  url: string,
  timeoutMs = 3500
): Promise<ServerPingResult> {
  const isDirect =
    url.endsWith(".m3u8") ||
    url.endsWith(".mp4") ||
    url.includes(".m3u8?") ||
    url.includes("/api/out?");

  // For direct HLS/MP4, probe the actual media endpoint with a light HEAD/GET
  const targetUrl = isDirect ? url : `https://${getHostFromUrl(url)}`;
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    await fetch(targetUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latency = Math.round(performance.now() - start);
    return { label, url, latency, healthy: true };
  } catch {
    // If probing fails or times out
    return { label, url, latency: timeoutMs + 1000, healthy: false };
  }
}

/**
 * Concurrently races candidate mirrors.
 * Calls `onFirstWinner` immediately when the first healthy server responds,
 * and calls `onAllComplete` when the full latency profile is measured.
 */
export function raceCandidateMirrors(
  mirrors: Record<string, string>,
  callbacks?: {
    onFirstWinner?: (label: string, latency: number) => void;
    onUpdate?: (latencies: Record<string, number>, fastestLabel: string | null) => void;
    onComplete?: (results: Record<string, ServerPingResult>) => void;
  }
): () => void {
  const entries = Object.entries(mirrors);
  if (entries.length === 0) return () => {};

  let isCancelled = false;
  let firstWinnerFound = false;
  const currentLatencies: Record<string, number> = {};
  const fullResults: Record<string, ServerPingResult> = {};
  let currentFastestLabel: string | null = null;
  let lowestLatency = Infinity;

  // Run probes concurrently
  const promises = entries.map(async ([label, url]) => {
    const result = await probeServer(label, url);
    if (isCancelled) return;

    fullResults[label] = result;
    if (result.healthy) {
      currentLatencies[label] = result.latency;
      const host = getHostFromUrl(url);
      if (host) {
        saveStoredLatencies({ [host]: result.latency });
      }

      if (result.latency < lowestLatency) {
        lowestLatency = result.latency;
        currentFastestLabel = label;
      }

      // Trigger first winner callback
      if (!firstWinnerFound) {
        firstWinnerFound = true;
        callbacks?.onFirstWinner?.(label, result.latency);
      }

      callbacks?.onUpdate?.(currentLatencies, currentFastestLabel);
    }
  });

  Promise.all(promises).then(() => {
    if (!isCancelled) {
      callbacks?.onComplete?.(fullResults);
    }
  });

  // Return cancel function
  return () => {
    isCancelled = true;
  };
}
