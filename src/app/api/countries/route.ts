import { NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

export const runtime = "edge";
type Country = { iso_3166_1:string; english_name:string };
export async function GET() {
  try {
    const countries = await tmdbFetch<Country[]>("/configuration/countries");
    return NextResponse.json({countries:countries.map(item=>[item.iso_3166_1,item.english_name] as const).sort((a,b)=>a[1].localeCompare(b[1]))});
  } catch { return NextResponse.json({countries:[]},{status:502}); }
}
