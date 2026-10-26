import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "MyFlix";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Watch Movies, Series, K-Drama, Anime & Live TV`,
    template: `%s — ${SITE_NAME}`,
  },
  description: `${SITE_NAME} — a calm, fast streaming home for movies, series, K-Drama, anime and live TV. No account needed.`,
  openGraph: {
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Movies, Series, Anime & Live TV`,
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
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23050505'/%3E%3Ctext x='32' y='43' font-family='Arial, sans-serif' font-size='34' font-weight='800' fill='%23ffffff' text-anchor='middle'%3EM%3C/text%3E%3C/svg%3E"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
