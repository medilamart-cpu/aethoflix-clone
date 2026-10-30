import { CuratedLibraryPage } from "@/components/CuratedLibraryPage";
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 1800;
export default function MoviesPage() { return <CuratedLibraryPage type="movie" />; }
