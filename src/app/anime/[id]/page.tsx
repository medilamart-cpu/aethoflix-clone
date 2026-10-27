import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Star, Play } from "lucide-react";
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

  const title = animeDisplayName(anime);

  return (
    <div className="relative min-h-screen">
      {anime.bannerImage && (
        <Image
          src={anime.bannerImage}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30 blur-sm"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/55 to-background" />

      <div className="relative z-10">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <Link
            href="/anime"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-black/80 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>

          <div className="mt-6 flex flex-col gap-6 md:flex-row">
            <Image
              src={anime.coverImage.extraLarge || anime.coverImage.large}
              alt={title}
              width={200}
              height={300}
              className="rounded-xl border border-white/10 shadow-2xl"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-neutral-300">
                {anime.averageScore && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    {Math.round(anime.averageScore / 10).toFixed(1)}
                  </span>
                )}
                {anime.seasonYear && <span>{anime.seasonYear}</span>}
                {anime.episodes && <span>{anime.episodes} eps</span>}
                {anime.format && <span>{anime.format}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <span key={g} className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs">
                    {g}
                  </span>
                ))}
              </div>
              {anime.description && (
                <p
                  className="mt-4 text-sm leading-relaxed text-neutral-300"
                  dangerouslySetInnerHTML={{ __html: anime.description }}
                />
              )}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Play className="h-4 w-4" /> Watch
            </h2>
            <AnimePlayer anime={anime} />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
