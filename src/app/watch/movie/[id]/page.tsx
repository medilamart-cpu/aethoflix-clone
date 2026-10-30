import { notFound } from "next/navigation";
import { MovieDetailPage } from "@/components/DetailPage";
import { Footer } from "@/components/Footer";
import { movieDetail } from "@/lib/tmdb";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;

export default async function WatchMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) notFound();

  let movie;
  try {
    movie = await movieDetail(tmdbId);
  } catch {
    notFound();
  }

  return (
    <><MovieDetailPage movie={movie} /><Footer /></>
  );
}
