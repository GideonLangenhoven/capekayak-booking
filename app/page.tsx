"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "./lib/supabase";
import { useRouter } from "next/navigation";
import SectionHeader from "./components/ui/SectionHeader";
import Card from "./components/ui/Card";
import { useTheme } from "./components/ThemeProvider";
import TourCardSkeleton from "./components/skeletons/TourCardSkeleton";

const TOUR_IMAGES: Record<string, string> = {
  "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop",
  "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=600&h=400&fit=crop",
  "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=600&h=400&fit=crop",
};

export default function Home() {
  const theme = useTheme();
  const router = useRouter();
  const [tours, setTours] = useState<any[]>([]);
  const [comboOffers, setComboOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotsThisWeek, setSpotsThisWeek] = useState<Record<string, number>>({});
  const [totalBookings, setTotalBookings] = useState(0);

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const { data } = await supabase.from("tours").select("*").eq("business_id", theme.id).eq("active", true).order("sort_order", { ascending: true });
      const activeTours = (data || []).filter((t: any) => !t.hidden);
      setTours(activeTours);

      // Load combo offers
      const { data: combos } = await supabase.from("combo_offers")
        .select("*, tour_a:tours!combo_offers_tour_a_id_fkey(id, name, image_url, duration_minutes), tour_b:tours!combo_offers_tour_b_id_fkey(id, name, image_url, duration_minutes)")
        .or(`business_a_id.eq.${theme.id},business_b_id.eq.${theme.id}`)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      setComboOffers(combos || []);

      // Urgency: load remaining spots this week per tour
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: slots } = await supabase.from("slots")
        .select("tour_id, capacity_total, booked, held")
        .eq("business_id", theme.id)
        .eq("status", "OPEN")
        .gte("start_time", now.toISOString())
        .lte("start_time", weekEnd.toISOString());
      const spotMap: Record<string, number> = {};
      for (const s of (slots || [])) {
        const avail = Math.max(0, (s.capacity_total || 0) - (s.booked || 0) - (s.held || 0));
        spotMap[s.tour_id] = (spotMap[s.tour_id] || 0) + avail;
      }
      setSpotsThisWeek(spotMap);

      // Trust signal: total completed bookings
      const { count } = await supabase.from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("business_id", theme.id)
        .in("status", ["PAID", "CONFIRMED", "COMPLETED"]);
      setTotalBookings(count || 0);

      setLoading(false);
    })();
  }, [theme.id]);

  if (loading) return (
    <div className="app-container page-wrap">
      <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(275px, 1fr))" }}>
        <TourCardSkeleton /><TourCardSkeleton /><TourCardSkeleton />
      </div>
    </div>
  );

  return (
    <div className="app-container page-wrap">
      <SectionHeader
        centered
        eyebrow={theme.hero_eyebrow || "Premium Kayaking"}
        title={theme.hero_title || "Find Your Perfect Paddle"}
        subtitle={theme.hero_subtitle || "Explore the stunning coastline by kayak with our original guided team."}
        className="max-w-3xl"
      />



      {tours.length === 0 && !loading && (
        <div className="col-span-1 md:col-span-3 py-12 text-center text-[color:var(--textMuted)]">
          <p className="text-lg">No tours currently available.</p>
          <p className="mt-2 text-sm">Please make sure tours are un-hidden in your Dashboard.</p>
        </div>
      )}

      <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(275px, 1fr))" }}>
        {tours.map((tour) => {
          const spots = spotsThisWeek[tour.id];
          const urgencyLabel = spots !== undefined && spots <= 6 && spots > 0
            ? `Only ${spots} spot${spots === 1 ? "" : "s"} left this week`
            : null;
          return (
            <button type="button" key={tour.id} className="relative w-[285px] h-[429px] mx-auto group cursor-pointer mb-4 text-left" aria-label={"Book " + tour.name}
              onClick={() => router.push("/book?tour=" + tour.id)}>
              <div className="absolute top-[7px] left-[7px] w-[285px] h-[429px] overflow-hidden bg-white shadow-sm rounded-2xl transition-all duration-300 group-hover:top-[3px] group-hover:left-[3px] group-hover:w-[293px] group-hover:h-[437px] group-hover:shadow-[0_13px_21px_-5px_rgba(0,0,0,0.3)]">

                {/* Image */}
                <div className="absolute top-0 left-0 w-full h-[65%]">
                  <Image src={tour.image_url || TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name}
                    fill sizes="285px" className="object-cover" />
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-70"
                    style={{ backgroundColor: 'var(--hoverOverlay, #48cfad)' }} />
                  {/* Urgency badge */}
                  {urgencyLabel && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm">
                      {urgencyLabel}
                    </div>
                  )}
                </div>

                {/* Stats — description always visible on mobile, hover on desktop */}
                <div className="absolute top-[65%] left-0 w-full h-[65%] bg-white px-5 pt-4 pb-5 transition-all duration-300 group-hover:top-[35%] text-left">
                  <div className="text-[30px] text-[#393c45] font-semibold tracking-tight leading-tight line-clamp-2">
                    {tour.name}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1 transition-all duration-300 group-hover:mt-2">
                    <div className="font-semibold text-[16px] text-[#393c45]">
                      R{tour.base_price_per_person}<span className="text-[11px] font-normal text-[#b1b1b3] ml-0.5"> per person</span>
                    </div>
                    <div className="text-xs text-[#b1b1b3]">
                      • {tour.duration_minutes} min
                    </div>
                  </div>

                  {/* Book Now — default state (visible, hidden on hover for desktop) */}
                  <div className="text-center mt-5 transition-all duration-300 group-hover:hidden">
                    <span className="inline-block rounded-full text-white text-[12px] font-semibold uppercase tracking-wide px-5 py-2"
                      style={{ backgroundColor: 'var(--cta)' }}>
                      Book Now
                    </span>
                  </div>

                  {/* Description — always visible on mobile, hover-reveal on desktop */}
                  <div className="mt-2 group-hover:opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-300">
                    <div className="hidden group-hover:block mt-2 mb-3 text-center">
                      <span className="inline-block rounded-full text-white text-xs font-semibold uppercase tracking-wide px-5 py-2"
                        style={{ backgroundColor: 'var(--cta)' }}>
                        Book Now
                      </span>
                    </div>
                    <div className="text-xs text-[#969699] line-clamp-3 leading-relaxed">
                      {tour.description || "An incredible kayaking experience along the stunning coastline."}
                    </div>
                  </div>
                </div>

              </div>
            </button>
          );
        })}
      </div>

      {/* Combo Packages */}
      {comboOffers.length > 0 && (
        <div className="mt-16">
          <SectionHeader
            centered
            eyebrow="Save More"
            title="Combo Packages"
            subtitle="Bundle two adventures together and save."
            className="max-w-3xl"
          />
          <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {comboOffers.map((combo) => {
              const tourA = combo.tour_a;
              const tourB = combo.tour_b;
              const savings = combo.original_price - combo.combo_price;
              return (
                <button type="button" key={combo.id} className="relative w-full max-w-[380px] mx-auto group cursor-pointer text-left" aria-label={"Book combo: " + combo.name}
                  onClick={() => router.push("/combo/" + combo.id)}>
                  <div className="overflow-hidden bg-white shadow-sm rounded-2xl transition-all duration-300 hover:shadow-[0_13px_21px_-5px_rgba(0,0,0,0.2)] hover:-translate-y-1">
                    {/* Dual image strip */}
                    <div className="flex h-[180px]">
                      <div className="w-1/2 relative overflow-hidden">
                        <Image src={tourA?.image_url || TOUR_IMAGES[tourA?.name] || TOUR_IMAGES["Sea Kayak"]} alt={tourA?.name || "Tour"}
                          fill sizes="190px" className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-semibold truncate">{tourA?.name}</p>
                        </div>
                      </div>
                      <div className="w-1/2 relative overflow-hidden border-l-2 border-white">
                        <Image src={tourB?.image_url || TOUR_IMAGES[tourB?.name] || TOUR_IMAGES["Sea Kayak"]} alt={tourB?.name || "Tour"}
                          fill sizes="190px" className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-semibold truncate">{tourB?.name}</p>
                        </div>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{combo.name}</h3>
                        {savings > 0 && (
                          <span className="shrink-0 bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            Save R{savings}
                          </span>
                        )}
                      </div>
                      {combo.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{combo.description}</p>}
                      <div className="flex items-baseline gap-2 mt-3">
                        <span className="text-xl font-bold text-gray-900">R{combo.combo_price}</span>
                        <span className="text-sm text-gray-400">/pp</span>
                        {savings > 0 && <span className="text-sm text-gray-400 line-through">R{combo.original_price}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{tourA?.duration_minutes + (tourB?.duration_minutes || 0)} min total</span>
                        <span>•</span>
                        <span>2 experiences</span>
                      </div>
                      <div className="text-center mt-4">
                        <span className="inline-block rounded-full text-white text-xs font-semibold uppercase tracking-wide px-6 py-2.5"
                          style={{ backgroundColor: 'var(--cta)' }}>
                          Book Combo
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
