import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

type InfoSection = { heading:string; body:string };
export function InfoPage({ eyebrow,title,intro,sections }: { eyebrow:string; title:string; intro:string; sections:InfoSection[] }) {
  return <div className="min-h-screen"><Navbar /><main className="info-page"><Link href="/" className="info-back"><ArrowLeft size={14}/> Discover</Link><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p className="info-intro">{intro}</p><div className="info-sections">{sections.map((section)=><section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}</div><a href="mailto:Aethoflix@gmail.com" className="info-contact"><Mail size={15}/> Contact the Aethoplex team</a></main><Footer /></div>;
}
