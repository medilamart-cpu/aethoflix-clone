"use client";

import { useState, useEffect } from "react";

/**
 * Returns true if the app is currently running on localhost / local development,
 * false if running on a live production domain (Vercel, custom domain, etc.).
 */
export function isLocalhost(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("192.168.") ||
      host.endsWith(".local") ||
      process.env.NODE_ENV !== "production"
    );
  }
  return process.env.NODE_ENV !== "production";
}

export function useIsLocalhost(): boolean {
  const [isLocal, setIsLocal] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host.startsWith("192.168.") ||
        host.endsWith(".local") ||
        process.env.NODE_ENV !== "production"
      );
    }
    return process.env.NODE_ENV !== "production";
  });

  useEffect(() => {
    setIsLocal(isLocalhost());
  }, []);

  return isLocal;
}

