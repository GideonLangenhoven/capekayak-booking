export default function VoucherSkeleton() {
  return (
    <div className="app-container page-wrap max-w-lg">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full skeleton" />
        <div className="h-7 w-48 mx-auto skeleton mb-3" />
        <div className="h-4 w-64 mx-auto skeleton" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-full p-5 rounded-xl skeleton h-20" />
        ))}
      </div>
    </div>
  );
}
