"use client";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Link from "next/link";
import SectionHeader from "./components/ui/SectionHeader";
import Card from "./components/ui/Card";

const TOUR_IMAGES: Record<string, string> = {
  "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop",
  "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=600&h=400&fit=crop",
  "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=600&h=400&fit=crop",
};

export default function Home() {
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
        eyebrow="Cape Town Sea Kayaking"
        title="Find Your Perfect Paddle"
        subtitle="Explore the Atlantic coastline by kayak with Cape Town's original guided team."
        className="max-w-3xl"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {tours.map((tour) => (
          <Card key={tour.id} className="group overflow-hidden panel-enter">
            <div className="h-48 overflow-hidden bg-[color:var(--surface2)]">
              <img src={tour.image_url || TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="p-5">
              <h3 className="text-xl font-semibold text-[color:var(--text)]">{tour.name}</h3>
              <p className="mt-1 text-sm text-[color:var(--textMuted)]">{tour.duration_minutes} minutes</p>
              <p className="mt-3 text-sm text-[color:var(--textMuted)]">{tour.description || "An incredible kayaking experience along Cape Town's stunning coastline."}</p>
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-[color:var(--text)]">R{tour.base_price_per_person}</span>
                  <span className="text-sm text-[color:var(--textMuted)]"> / person</span>
                </div>
                <Link href={"/book?tour=" + tour.id}
                  className="btn btn-primary px-4 py-2">
                  Book Tour
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
}
