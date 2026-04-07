export default function TourCardSkeleton() {
  return (
    <div className="w-[285px] h-[429px] mx-auto mb-4">
      <div className="w-[285px] h-[429px] overflow-hidden bg-white shadow-sm rounded-2xl">
        <div className="w-full h-[65%] skeleton" />
        <div className="px-5 pt-4 pb-5">
          <div className="h-7 w-3/4 skeleton mb-3" />
          <div className="h-4 w-1/2 skeleton mb-5" />
          <div className="h-9 w-28 mx-auto skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
}
