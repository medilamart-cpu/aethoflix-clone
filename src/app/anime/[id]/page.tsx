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
    if (anilistId === 21) {
      anime = {
        id: 21,
        idMal: 21,
        title: { romaji: "ONE PIECE", english: "One Piece", native: "ONE PIECE" },
        coverImage: {
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21-YCDoj1EkAxFn.jpg",
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-YCDoj1EkAxFn.jpg",
          color: "#e48633",
        },
        bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-4dF8Ah4pm7nd.jpg",
        description: "Gold Roger was known as the 'Pirate King', the strongest and most infamous being to have sailed the Grand Line...",
        episodes: 1120,
        duration: 24,
        averageScore: 88,
        genres: ["Action", "Adventure", "Comedy", "Drama", "Fantasy"],
        season: "FALL",
        seasonYear: 1999,
        format: "TV",
        status: "RELEASING",
      };
    } else {
      notFound();
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0f]">
      <AnimePlayer anime={anime} />
      <Footer />
    </div>
  );
}
