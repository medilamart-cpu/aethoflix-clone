import Link from "next/link";
import { Mail } from "lucide-react";

const SITES = [
  ["Aethoflix", "https://aethoflix.world/"],
  ["Almost OTT", "https://almostott.aethoflix.world/"],
  ["Theatre", "https://theatre.aethoflix.world/"],
  ["Cinema", "https://cinema.aethoflix.world/"],
  ["Island", "https://island.aethoflix.world/"],
];

export function Footer() {
  return <footer className="site-footer">
    <div className="footer-grid">
      <div className="footer-about"><Link href="/" className="footer-logo">AETHO<span>PLEX</span></Link><p>Stories, thoughtfully found. A calm home for films, series, anime and live television from around the world.</p><a className="footer-contact" href="mailto:Aethoflix@gmail.com"><Mail size={14} /> Aethoflix@gmail.com</a><p className="footer-copyright">© {new Date().getFullYear()} Aethoplex. All rights reserved.</p></div>
      <div className="footer-column"><h2>EXPLORE</h2><Link href="/">Discover</Link><Link href="/live">Live television</Link><Link href="/my-list">My list</Link><Link href="/faq">Help centre</Link></div>
      <div className="footer-column"><h2>AETHOPLEX</h2><Link href="/about">About</Link><Link href="/faq">FAQ</Link><Link href="/dmca">DMCA &amp; removal</Link><a href="mailto:Aethoflix@gmail.com">Contact</a></div>
      <div className="footer-column"><h2>OUR SITES</h2>{SITES.map(([name,url])=><a key={name} href={url} target="_blank" rel="noreferrer">{name}</a>)}</div>
    </div>
    <div className="footer-credits"><span className="tmdb-mark">TMDB</span><span>CREDITS</span><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><small>AniList data © AniList contributors. Live TV data © LiveTVGT.</small></div>
  </footer>;
}
