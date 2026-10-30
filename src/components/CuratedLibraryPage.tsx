import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { BrowseFilters } from "@/components/BrowseFilters";
import { MediaRow } from "@/components/MediaRow";
import { ThemedCollectionFeed } from "@/components/ThemedCollectionFeed";
import { discoverTV, kdrama, moviesFromIndia, moviesNowPlaying, moviesPopular, moviesTopRated, trending, tvAiringToday, tvPopular, tvTopRated, type MovieListItem, type TVListItem, type TrendingMedia } from "@/lib/tmdb";

type LibraryType = "movie" | "tv" | "anime";
type Shelf = { title:string; description:string; items:(TrendingMedia|MovieListItem|TVListItem)[] };
const titleOf = (item:{title?:string;name?:string}) => item.title || item.name || "Untitled";
const hrefOf = (item:TrendingMedia|MovieListItem|TVListItem) => `/watch/${("media_type" in item && item.media_type === "movie") || "title" in item ? "movie" : "tv"}/${item.id}`;

export async function CuratedLibraryPage({ type, focus }: { type:LibraryType; focus?:"kdrama" }) {
  const animeQuery = { with_genres:"16", with_original_language:"ja", sort_by:"popularity.desc" };
  const [trend, now, movies, movieTop, shows, showTop, airing, korean, anime, animeNew, animeTop, india] = await Promise.all([
    trending(type === "movie" ? "movie" : "tv", "week"), moviesNowPlaying(), moviesPopular(), moviesTopRated(),
    tvPopular(), tvTopRated(), tvAiringToday(), kdrama(), discoverTV(animeQuery),
    discoverTV({ ...animeQuery, sort_by:"first_air_date.desc" }), discoverTV({ ...animeQuery, sort_by:"vote_average.desc", vote_count_gte:100 }), moviesFromIndia(),
  ]);
  const heroItems = trend.slice(0, 6);
  const shelves:Shelf[] = focus === "kdrama" ? [
    { title:"Trending this week", description:"Series finding an audience right now", items:trend },
    { title:"K-dramas to get lost in", description:"Heart, suspense and stories worth staying up for", items:korean },
    { title:"K-drama romance", description:"Heartbeats, secrets and second chances", items:korean },
    { title:"Korean thrillers", description:"Tension from the first scene", items:korean },
    { title:"New series", description:"Fresh stories, just beginning", items:shows },
  ] : type === "movie" ? [
    { title:"Trending this week", description:"What film fans are watching right now", items:trend },
    { title:"Films for tonight", description:"Stories made for the big screen", items:movies },
    { title:"Stories from India", description:"A home for every kind of cinema", items:india },
    { title:"The all-time greats", description:"Voted into the collection", items:movieTop },
  ] : type === "anime" ? [
    { title:"Trending anime", description:"What anime fans are watching right now", items:anime },
  ] : [
    { title:"Trending this week", description:"Series finding an audience right now", items:trend },
    { title:"Series worth your time", description:"Stories made to stay with you", items:showTop },
    { title:"K-dramas to get lost in", description:"Heart, suspense and stories worth staying up for", items:korean },
    { title:"On air this week", description:"New episodes landing now", items:airing },
    { title:"New series", description:"Fresh stories, just beginning", items:shows },
  ];
  const hero = heroItems[0] ?? (type === "movie" ? movies[0] : shows[0]);
  return <div className="min-h-screen"><Navbar />{hero&&<Hero item={hero} items={heroItems.length?heroItems:[hero]} />}<main className="mx-auto max-w-7xl pb-12"><BrowseFilters initialType={focus ? "tv" : type} />{shelves.map(shelf=><MediaRow key={shelf.title} {...shelf} hrefForItem={hrefOf} titleForItem={titleOf} />)}<ThemedCollectionFeed type={focus ? "tv" : type} /></main><Footer /></div>;
}
