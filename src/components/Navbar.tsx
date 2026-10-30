"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, X, Play, House, Radio, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Aethoplex";
const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/movies", label: "Films" },
  { href: "/series", label: "Series" },
  { href: "/anime", label: "Anime" },
  { href: "/live", label: "Live" },
  { href: "/my-list", label: "My list" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`); else router.push("/search"); };
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link href="/" className="brand-mark" aria-label={`${SITE_NAME} home`}>
          <span className="brand-icon"><Play size={15} fill="currentColor" strokeWidth={2.4} /></span>
          <span>{SITE_NAME}<small>STREAMING DISCOVERY</small></span>
        </Link>
        <ul className="desktop-nav">
          {NAV_LINKS.map((link) => <li key={link.href}><Link href={link.href} className={cn("nav-link", pathname === link.href && "nav-link-active")}>{link.label}{link.href === "/live" && <i className="nav-live-dot" />}</Link></li>)}
        </ul>
        <div className="nav-actions">
          <form className="nav-search-form" onSubmit={search} onClick={(event) => { if (window.innerWidth <= 760) event.currentTarget.querySelector("input")?.focus(); }}><Search size={16} /><input aria-label="Search movies and series" placeholder="Titles, genres, people" value={query} onChange={(e) => setQuery(e.target.value)} /></form>
          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="mobile-menu-button" aria-label={mobileOpen ? "Close menu" : "Open menu"}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </nav>
      {mobileOpen && <div className="mobile-nav-panel"><div className="mobile-nav-label">AETHOPLEX</div>{NAV_LINKS.map((link) => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={cn("mobile-nav-link", pathname === link.href && "mobile-nav-link-active")}>{link.label}{link.href === "/live" && <i className="nav-live-dot" />}</Link>)}<Link href="/search" onClick={() => setMobileOpen(false)} className="mobile-nav-search"><Search size={17} /> Search movies, shows & anime</Link></div>}
    </header>
  );
}

export function MobileDock() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home", Icon: House },
    { href: "/search", label: "Search", Icon: Search },
    { href: "/live", label: "Live", Icon: Radio },
    { href: "/my-list", label: "My list", Icon: Bookmark },
  ];
  return <nav className="mobile-dock" aria-label="Mobile navigation">
    {links.map(({ href, label, Icon }) => {
      const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? "mobile-dock-link dock-active" : "mobile-dock-link"} aria-current={active ? "page" : undefined}>
        <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
      </Link>;
    })}
  </nav>;
}
