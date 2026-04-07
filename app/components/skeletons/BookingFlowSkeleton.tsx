export default function BookingFlowSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-1 mb-10">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center flex-1">
            <div className="w-8 h-8 rounded-full skeleton" />
            <div className="h-2 flex-1 mx-2 skeleton rounded" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="h-6 w-32 skeleton mb-4" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl skeleton" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-6 w-40 skeleton mb-4" />
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 w-full skeleton rounded-xl mb-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
