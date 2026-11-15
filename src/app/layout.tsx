import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Aethoplex";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — stories, thoughtfully found`,
    template: `%s — ${SITE_NAME}`,
  },
    description: `${SITE_NAME} — a calm home for films, series, anime and live television from around the world.`,
  openGraph: {
    siteName: SITE_NAME,
    title: `${SITE_NAME} — stories, thoughtfully found`,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%23090e16'/%3E%3Cpath d='M25 17v30l25-15z' fill='%23d9ebfb'/%3E%3C/svg%3E"
        />
        <script src="https://live.aethoflix.world/v1/live.js" async />
        {/* iOS AVPlayer & Native Fullscreen Bridge (CleanStream Native Player Engine) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof HTMLVideoElement !== 'undefined') {
                  if (!HTMLVideoElement.prototype.webkitSetPresentationMode) {
                    HTMLVideoElement.prototype.webkitSetPresentationMode = function(mode) {
                      if (mode === 'fullscreen' && typeof this.webkitEnterFullscreen === 'function') {
                        this.webkitEnterFullscreen();
                      } else if (mode === 'inline' && typeof this.webkitExitFullscreen === 'function') {
                        this.webkitExitFullscreen();
                      }
                    };
                  }
                }
              })();
            `,
          }}
        />
        {/* Video.js 10 Stylesheet & Custom Elements for CleanStream Direct CDN */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/video.css"
        />
        <script
          type="module"
          src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/video.js"
        />
        <script
          type="module"
          src="https://cdn.jsdelivr.net/npm/@videojs/cdn@10.2.0/media/hlsjs-video.js"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
