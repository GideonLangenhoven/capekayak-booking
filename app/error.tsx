"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="app-container page-wrap flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-[color:var(--text)] mb-2">Something went wrong</h1>
      <p className="text-sm text-[color:var(--textMuted)] mb-6 max-w-sm">
        We ran into an unexpected issue. Please try again, or contact us if the problem persists.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[color:var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
        <a
          href="/"
          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--surface2)] transition-colors"
        >
          Back to Tours
        </a>
      </div>
    </div>
  );
}
