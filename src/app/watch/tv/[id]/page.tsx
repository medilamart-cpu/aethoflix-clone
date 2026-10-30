import { notFound } from "next/navigation";
import { TVDetailPage } from "@/components/DetailPage";
import { Footer } from "@/components/Footer";
import { tvDetail } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export default async function WatchTVPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?:string; episode?:string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const initialSeason = Number(query.season);
  const initialEpisode = Number(query.episode);
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) notFound();

  let tv;
  try {
    tv = await tvDetail(tmdbId);
  } catch {
    notFound();
  }

  return (
    <><TVDetailPage tv={tv} initialSeason={Number.isInteger(initialSeason) && initialSeason > 0 ? initialSeason : undefined} initialEpisode={Number.isInteger(initialEpisode) && initialEpisode > 0 ? initialEpisode : undefined} /><Footer /></>
  );
}
