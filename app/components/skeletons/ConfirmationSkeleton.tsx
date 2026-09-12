export default function ConfirmationSkeleton() {
  return (
    <div className="app-container max-w-md page-wrap">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 w-20 h-20 rounded-full skeleton" />
        <div className="h-7 w-48 mx-auto skeleton mb-3" />
        <div className="h-4 w-56 mx-auto skeleton" />
      </div>
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
        <div className="h-20 skeleton mb-1" />
        <div className="p-5 space-y-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-20 skeleton" />
              <div className="h-4 w-32 skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
