import { InfoPage } from "@/components/InfoPage";
export const metadata = { title:"DMCA & removal" };
export default function DMCAPage() { return <InfoPage eyebrow="CONTENT & ATTRIBUTION" title="DMCA & removal." intro="Aethoplex is a discovery interface. Catalog information and playback links may be supplied by independent third-party services." sections={[
  {heading:"Report a concern",body:"If you believe content or a link should be reviewed, email Aethoflix@gmail.com with the title, the page address, and a short description of your concern."},
  {heading:"Metadata and credits",body:"Movie and television metadata is supplied by TMDB and is not endorsed or certified by TMDB. Anime data is supplied by AniList."},
  {heading:"Third-party availability",body:"Aethoplex does not control third-party catalogs, channels or streaming services. Please contact the relevant provider directly about material hosted on its service."},
]} />; }
