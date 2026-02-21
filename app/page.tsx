"use client";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Link from "next/link";

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
      const { data, error } = await supabase.from("tours").select("*").order("base_price_per_person");
      console.log("Tours:", data, error);
      setTours(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold tracking-tight">Paddle Cape Town</h2>
        <p className="text-gray-500 mt-3 text-lg">Explore the Atlantic coastline by kayak. Unforgettable experiences since 1994.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {tours.map((tour) => (
          <div key={tour.id} className="group border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-48 bg-gray-100 overflow-hidden">
              <img src={TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="p-5">
              <h3 className="text-xl font-semibold">{tour.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{tour.duration_minutes} minutes</p>
              <p className="text-gray-600 text-sm mt-3">{tour.description || "An incredible kayaking experience along Cape Town's stunning coastline."}</p>
              <div className="flex items-center justify-between mt-5">
                <div>
                  <span className="text-2xl font-bold">R{tour.base_price_per_person}</span>
                  <span className="text-gray-500 text-sm"> / person</span>
                </div>
                <Link href={"/book?tour=" + tour.id}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                  Book Now
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-16 text-center">
        <div className="inline-flex items-center gap-6 text-sm text-gray-500">
          <span>📍 Three Anchor Bay, Sea Point</span>
          <span>⭐ 4.9 rating (200+ reviews)</span>
          <span>🛶 30+ years experience</span>
        </div>
      </div>
    </div>
  );
}
