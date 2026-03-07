"use client";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Link from "next/link";
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
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("tours").select("*").eq("active", true).order("base_price_per_person");
      console.log("Tours:", data, error);
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

      <div className="grid gap-6 md:grid-cols-3">
        {tours.map((tour) => (
          <div key={tour.id} className="relative w-[325px] h-[490px] mx-auto group perspective-[800px] mb-8">
            <div className="absolute top-[10px] left-[10px] w-[325px] h-[490px] overflow-hidden bg-white shadow-sm transition-all duration-300 group-hover:top-[5px] group-hover:left-[5px] group-hover:w-[335px] group-hover:h-[500px] group-hover:shadow-[0_13px_21px_-5px_rgba(0,0,0,0.3)]">

              {/* Image */}
              <div className="absolute top-0 left-0 w-full h-[390px]">
                <img src={tour.image_url || TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name}
                  className="w-full h-full object-cover" />

                {/* Overlay */}
                <div className="absolute inset-0 bg-[#48cfad] opacity-0 transition-opacity duration-300 group-hover:opacity-70"></div>

                {/* Book Details Button */}
                <Link href={"/book?tour=" + tour.id}
                  className="absolute top-[112px] left-1/2 -ml-[85px] w-[172px] border-2 border-white text-white text-[19px] text-center uppercase font-bold py-2.5 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:w-[152px] group-hover:-ml-[76px] group-hover:text-[15px] group-hover:top-[115px] hover:bg-white hover:text-[#48cfad] z-10">
                  Book Tour
                </Link>
              </div>

              {/* Stats Container (Slide Up) */}
              <div className="absolute top-[386px] left-0 w-full h-[300px] bg-white px-8 pt-7 pb-8 transition-all duration-300 group-hover:top-[272px]">
                <div className="float-right text-[#48cfad] text-[22px] font-semibold">
                  R{tour.base_price_per_person}
                </div>
                <div className="text-[22px] text-[#393c45] font-sans truncate pr-2">
                  {tour.name}
                </div>
                <p className="text-[16px] text-[#b1b1b3] py-[2px] mb-5">
                  {tour.duration_minutes} minutes
                </p>
                <div className="mt-2 text-sm text-[#969699] line-clamp-3">
                  {tour.description || "An incredible kayaking experience along Cape Town's stunning coastline."}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
