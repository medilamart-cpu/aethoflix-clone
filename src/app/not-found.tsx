import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-extrabold">404</h1>
      <p className="text-sm text-neutral-400">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link href="/" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200">
        Back home
      </Link>
    </div>
  );
}
