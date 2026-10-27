import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TVDetailPage } from "@/components/DetailPage";
import { tvDetail } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export default async function WatchTVPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) notFound();

  let tv;
  try {
    tv = await tvDetail(tmdbId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <TVDetailPage tv={tv} />
      <Footer />
    </div>
  );
}
