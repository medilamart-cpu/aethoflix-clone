import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";
export const runtime = "edge";
export async function GET(request:NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  const type = params.get("type");
  if (!id || !/^\d+$/.test(id) || (type !== "movie" && type !== "tv")) return NextResponse.json({logo:null},{status:400});
  try {
    const data = await tmdbFetch<{logos?:{file_path:string;iso_639_1:string|null;vote_average:number}[]}>(`/${type}/${id}/images`,{include_image_language:"en,null"});
    const logos = data.logos || [];
    const logo = logos.find((image)=>image.iso_639_1 === "en") || logos.find((image)=>image.iso_639_1 === null) || logos[0];
    return NextResponse.json({logo:logo?.file_path || null});
  } catch { return NextResponse.json({logo:null}); }
}
