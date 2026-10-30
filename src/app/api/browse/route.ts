import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch, type TrendingMedia } from "@/lib/tmdb";

export const runtime = "edge";
type Row = { id:number; title?:string; name?:string; overview:string; poster_path:string|null; backdrop_path:string|null; vote_average:number; popularity:number; release_date?:string|null; first_air_date?:string|null; media_type?:"movie"|"tv" };

async function fetchType(type:"movie"|"tv", genre:string, country:string, page:number) {
  const path = type === "movie" ? "/discover/movie" : "/discover/tv";
  const params:Record<string,string|number> = { sort_by:"popularity.desc", page };
  if (genre) params.with_genres = genre;
  if (country) params.with_origin_country = country;
  if (type === "tv" && country) params.with_origin_country = country;
  const data = await tmdbFetch<{results:Row[]}>(path,params);
  return (data.results ?? []).map((row) => ({...row, title:row.title || row.name || "Untitled", media_type:type})) as TrendingMedia[];
}

export async function GET(request:NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type") || "all";
  const genre = params.get("genre") || "";
  const country = params.get("country") || "";
  const page = Math.max(1,Number(params.get("page") || 1));
  try {
    let results:TrendingMedia[];
    if (type === "movie") results = await fetchType("movie",genre,country,page);
    else if (type === "tv" || type === "anime") results = await fetchType("tv",type === "anime" ? ["16",genre].filter(Boolean).join(",") : genre,type === "anime" ? (country || "JP") : country,page);
    else { const [movies,series] = await Promise.all([fetchType("movie",genre,country,page),fetchType("tv",genre,country,page)]); results = [...movies,...series].sort((a,b) => b.popularity - a.popularity); }
    return NextResponse.json({results});
  } catch { return NextResponse.json({results:[],error:"The collection could not be loaded."},{status:502}); }
}
