import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MyList } from "@/components/MyList";

export const runtime = "edge";

export default function MyListPage() {
  return <div className="min-h-screen"><Navbar /><main className="my-list-page"><MyList /></main><Footer /></div>;
}
