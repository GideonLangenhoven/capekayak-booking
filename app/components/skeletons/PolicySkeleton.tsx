export default function PolicySkeleton() {
  return (
    <div className="app-container page-wrap">
      <div className="h-8 w-56 skeleton mb-8" />
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-4 skeleton" style={{ width: `${90 - i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}
