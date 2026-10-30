import { InfoPage } from "@/components/InfoPage";
export const metadata = { title:"About Aethoplex" };
export default function AboutPage() { return <InfoPage eyebrow="AETHOPLEX" title="Stories, thoughtfully found." intro="A calm home for films, series, anime and live television from around the world." sections={[
  {heading:"One place to explore",body:"Aethoplex brings together browsable entertainment collections with useful details, search and a private list for titles you want to return to."},
  {heading:"A wider world of stories",body:"Discover films and series from different countries and genres, alongside anime and live television."},
  {heading:"Credits",body:"Movie and television metadata is provided by TMDB. Anime information is provided by AniList. Live channel listings are provided by LiveTVGT."},
]} />; }
