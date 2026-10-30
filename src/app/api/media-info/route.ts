import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
export const runtime = "edge";
type Info = { id:number; title?:string; name?:string; overview:string; runtime?:number|null; episode_run_time?:number[]; genres?:{id:number;name:string}[]; release_date?:string; first_air_date?:string; vote_average:number; credits?:{crew?:{job:string;name:string}[]}; created_by?:{name:string}[]; seasons?:{season_number:number;name:string;episode_count:number;air_date:string|null}[]; videos?:{results?:{key:string;name:string;site:string;type:string;official:boolean}[]} };
export async function GET(request:NextRequest) {
  const params=request.nextUrl.searchParams; const id=params.get("id"); const type=params.get("type");
  if(!id || !/^\d+$/.test(id) || (type!=="movie" && type!=="tv")) return NextResponse.json({error:"Invalid title."},{status:400});
  try {
    const data=await tmdbFetch<Info>(`/${type}/${id}`,{append_to_response:"credits,videos"});
    const trailer=data.videos?.results?.find((video)=>video.site==="YouTube" && video.type==="Trailer" && video.official) || data.videos?.results?.find((video)=>video.site==="YouTube" && video.type==="Trailer");
    return NextResponse.json({title:data.title || data.name,overview:data.overview,year:(data.release_date || data.first_air_date || "").slice(0,4),runtime:data.runtime || data.episode_run_time?.[0] || null,genres:data.genres?.map((genre)=>genre.name) || [],credit:type==="movie" ? data.credits?.crew?.find((person)=>person.job==="Director")?.name : data.created_by?.map((person)=>person.name).join(", "),trailer:trailer?.key || null,seasons:data.seasons?.filter(season=>season.season_number>0)||[]});
  } catch { return NextResponse.json({error:"Title information is unavailable."},{status:502}); }
}
