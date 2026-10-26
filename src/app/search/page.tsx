import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function SearchPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Search</h1>
        <p className="mt-1 text-sm text-neutral-400">Use the search bar to find movies, series, or anime.</p>
        <SearchForm />
      </main>
      <Footer />
    </div>
  );
}

import { Suspense } from "react";
import { SearchClient } from "./SearchClient";

function SearchForm() {
  return (
    <Suspense fallback={<div className="mt-6 text-sm text-neutral-500">Loading search…</div>}>
      <SearchClient />
    </Suspense>
  );
}
