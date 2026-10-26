import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "MyFlix";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/5 bg-background/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} {SITE_NAME}. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            AniList data © AniList contributors. Live TV data © LiveTVGT.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="mailto:contact@example.com"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
          >
            <Mail className="h-4 w-4" /> Contact
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" /> Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
