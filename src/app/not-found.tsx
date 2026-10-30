import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return <div className="min-h-screen"><Navbar /><main className="not-found-page"><span className="section-kicker">AETHOPLEX</span><h1>Lost in the story?</h1><p>The page you&apos;re looking for isn&apos;t here. There are plenty more worlds to discover.</p><Link href="/" className="empty-list-button">Back to Discover</Link></main><Footer /></div>;
}
