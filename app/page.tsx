"use client";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useRouter } from "next/navigation";
import SectionHeader from "./components/ui/SectionHeader";
import Card from "./components/ui/Card";
import { useTheme } from "./components/ThemeProvider";

const TOUR_IMAGES: Record<string, string> = {
  "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop",
  "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=600&h=400&fit=crop",
  "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=600&h=400&fit=crop",
};

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Prevent aggressive browser caching of the previous 'hidden' state by appending a nocache query param
      const { data, error } = await supabase.from("tours").select("*").eq("active", true).order("base_price_per_person");
      console.log("Tours length:", data?.length, "Hidden:", data?.filter(t => t.hidden).length, "Visible:", data?.filter(t => !t.hidden).length);
      setTours((data || []).filter((t: any) => !t.hidden));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="app-loader"><div className="spinner" /></div>;

  return (
    <div className="app-container page-wrap">
      <SectionHeader
        centered
        eyebrow={theme.hero_eyebrow || "Cape Town Sea Kayaking"}
        title={theme.hero_title || "Find Your Perfect Paddle"}
        subtitle={theme.hero_subtitle || "Explore the Atlantic coastline by kayak with Cape Town's original guided team."}
        className="max-w-3xl"
      />

      {tours.length === 0 && !loading && (
        <div className="col-span-1 md:col-span-3 py-12 text-center text-[color:var(--textMuted)]">
          <p className="text-lg">No tours currently available.</p>
          <p className="mt-2 text-sm">Please make sure tours are un-hidden in your Dashboard.</p>
        </div>
      )}

      <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {tours.map((tour) => (
          <div key={tour.id} className="relative w-[228px] h-[343px] mx-auto group cursor-pointer mb-4"
            onClick={() => router.push("/book?tour=" + tour.id)}>
            <div className="absolute top-[7px] left-[7px] w-[228px] h-[343px] overflow-hidden bg-white shadow-sm rounded-2xl transition-all duration-300 group-hover:top-[3px] group-hover:left-[3px] group-hover:w-[234px] group-hover:h-[349px] group-hover:shadow-[0_13px_21px_-5px_rgba(0,0,0,0.3)]">

              {/* Image */}
              <div className="absolute top-0 left-0 w-full h-[65%]">
                <img src={tour.image_url || TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name}
                  className="w-full h-full object-cover" />
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-70"
                  style={{ backgroundColor: 'var(--hoverOverlay, #48cfad)' }} />
                <span className="card-cta-btn absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white text-white text-sm text-center uppercase font-bold px-5 py-2 opacity-0 transition-all duration-300 group-hover:opacity-100 z-10 whitespace-nowrap">
                  Book Tour
                </span>
              </div>

              {/* Stats (slides up on hover) */}
              <div className="absolute top-[65%] left-0 w-full h-[65%] bg-white px-5 pt-4 pb-5 transition-all duration-300 group-hover:top-[35%] text-left">
                <div className="text-[30px] text-[#393c45] font-semibold tracking-tight leading-tight line-clamp-2">
                  {tour.name}
                </div>

                <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 mt-2">
                  <div className="font-semibold text-[18px]" style={{ color: 'var(--hoverOverlay, #48cfad)' }}>
                    R{tour.base_price_per_person}<span className="text-[12px] font-normal text-[#b1b1b3] ml-0.5">/pp</span>
                  </div>
                  <p className="text-xs text-[#b1b1b3] mt-0.5 mb-2">
                    {tour.duration_minutes} min
                  </p>
                  <div className="text-xs text-[#969699] line-clamp-3 leading-relaxed">
                    {tour.description || "An incredible kayaking experience along Cape Town's stunning coastline."}
                  </div>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
