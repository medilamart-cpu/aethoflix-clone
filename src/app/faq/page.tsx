import { InfoPage } from "@/components/InfoPage";
export const metadata = { title:"Help centre" };
export default function FAQPage() { return <InfoPage eyebrow="AETHOPLEX HELP CENTRE" title="A few things worth knowing." intro="Quick answers for a more thoughtful night of watching." sections={[
  {heading:"How do I find something to watch?",body:"Use Discover to explore popular films and series, browse by genre, or narrow the collection by country. Search finds matching films, series and anime."},
  {heading:"What is My list?",body:"Use the bookmark on a title card to save a film or series. Your list is stored privately in this browser, so it stays with this device."},
  {heading:"How do I change a TV episode?",body:"Open a series and select the season and episode on its watch page. Anime episodes also include audio and server choices where available."},
  {heading:"How does Live TV work?",body:"Choose India channels or the 24 / 7 mix, then search or filter the channel guide. Available channels depend on the public guide."},
  {heading:"Why is a title or stream unavailable?",body:"Catalog details, channel listings and streams are supplied by external services. Availability can vary by region and may change over time."},
]} />; }
