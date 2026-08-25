/** Route-level skeleton for the discovery/detail segments (low-bandwidth, no layout shift). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-black/10" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-44 animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    </div>
  );
}
