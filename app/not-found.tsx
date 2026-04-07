import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="app-container page-wrap flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-[color:var(--surface2)] flex items-center justify-center mb-6">
        <span className="text-2xl font-bold text-[color:var(--textMuted)]">404</span>
      </div>
      <h1 className="text-xl font-bold text-[color:var(--text)] mb-2">Page not found</h1>
      <p className="text-sm text-[color:var(--textMuted)] mb-6 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[color:var(--accent)] text-white hover:opacity-90 transition-opacity"
      >
        Browse Tours
      </Link>
    </div>
  );
}
