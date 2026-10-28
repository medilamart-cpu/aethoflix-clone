import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { animeDetail, animeDisplayName, type AnimeMedia } from "@/lib/anilist";
import { AnimePlayer } from "@/components/AnimePlayer";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export default async function AnimeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const anilistId = Number(id);
  if (!Number.isFinite(anilistId) || anilistId <= 0) notFound();

  let anime: AnimeMedia;
  try {
    anime = await animeDetail(anilistId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#080a0f]">
      <AnimePlayer anime={anime} />
      <Footer />
    </div>
  );
}
