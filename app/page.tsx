"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createTenantSupabase } from "./lib/supabase";
import { formatDuration } from "./lib/duration";
import { fmtDate, fmtTime } from "./lib/format";
import { BOOKING_CUTOFF_MINUTES } from "./lib/pricing";
import { useRouter } from "next/navigation";
import SectionHeader from "./components/ui/SectionHeader";
import { useTheme } from "./components/ThemeProvider";
import OperatorDirectory from "./components/OperatorDirectory";
import TenantClosedNotice, { useTenantTrading } from "./components/TenantClosedNotice";
import { readValidDraft, clearDraft, draftResumeUrl, type BookingDraft } from "@/app/lib/booking-draft";
import type { Tour, Slot } from "./lib/types";

const TOUR_IMAGES: Record<string, string> = {
  "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop",
  "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=600&h=400&fit=crop",
  "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=600&h=400&fit=crop",
};

type ComboTourRef = { id: string; name: string; image_url: string | null; duration_minutes: number };
type ComboItem = { id: string; tour_id: string; business_id: string; position: number | null; label: string | null; tours: ComboTourRef | null };
type ComboOfferRow = { id: string; name: string; description: string | null; combo_price: number; original_price: number; items: ComboItem[] };
type DealSlot = Pick<Slot, "id" | "tour_id" | "start_time" | "price_per_person_override" | "capacity_total" | "booked" | "held"> & {
  // Non-optional: the deals list is filtered to entries with a tour before storage.
  tour: { name: string; base_price_per_person: number; hidden: boolean | null; active: boolean | null };
};

export default function Home() {
  const theme = useTheme();
  const trading = useTenantTrading();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const tz = theme.timezone || "Africa/Johannesburg";
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [comboOffers, setComboOffers] = useState<ComboOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [spotsThisWeek, setSpotsThisWeek] = useState<Record<string, number>>({});
  const [totalBookings, setTotalBookings] = useState(0);
  const [reviewStats, setReviewStats] = useState<Record<string, { avg: number; count: number }>>({});
  const [deals, setDeals] = useState<DealSlot[]>([]);
  // Lazy-initialized from localStorage (impure, so must happen once here, not
  // re-derived on every render) — reading it inline avoids the effect having
  // to synchronously setState before any async gap.
  const [draft, setDraft] = useState<BookingDraft | null>(() => readValidDraft());

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const now = new Date();
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [toursRes, combosRes, slotsRes, bookingsRes, rvStatsRes, dealsRes] = await Promise.all([
        tenantSupabase.from("tours").select("*").eq("business_id", theme.id).eq("active", true).order("sort_order", { ascending: true }),
        // Offers this tenant participates in (any leg, incl. 3+ party combos)
        tenantSupabase.from("combo_offer_items").select("combo_offer_id").eq("business_id", theme.id),
        tenantSupabase.from("slots")
          .select("tour_id, capacity_total, booked, held")
          .eq("business_id", theme.id)
          .eq("status", "OPEN")
          .gte("start_time", now.toISOString())
          .lte("start_time", weekEnd.toISOString()),
        tenantSupabase.from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("business_id", theme.id)
          .in("status", ["PAID", "CONFIRMED", "COMPLETED"]),
        tenantSupabase.from("tour_review_stats")
          .select("tour_id, avg_rating, review_count")
          .eq("business_id", theme.id),
        // Last-minute deals: slots the cron has repriced (see apply_last_minute_deals).
        // Only advertise what the booking flow will actually sell — same cutoff.
        tenantSupabase.from("slots")
          .select("id, tour_id, start_time, price_per_person_override, capacity_total, booked, held, tours(name, base_price_per_person, hidden, active)")
          .eq("business_id", theme.id)
          .eq("status", "OPEN")
          .not("last_minute_at", "is", null)
          .not("price_per_person_override", "is", null)
          .gt("start_time", new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000).toISOString())
          .order("start_time", { ascending: true })
          .limit(20),
      ]);

      const activeTours = ((toursRes.data || []) as unknown as Tour[]).filter((t) => !t.hidden);
      setTours(activeTours);

      const comboIds = [...new Set(((combosRes.data || []) as { combo_offer_id: string }[]).map((r) => r.combo_offer_id))];
      if (comboIds.length > 0) {
        const offersRes = await tenantSupabase.from("combo_offers")
          .select("*, items:combo_offer_items(id, tour_id, business_id, position, label, tours:tours(id, name, image_url, duration_minutes))")
          .in("id", comboIds)
          .eq("active", true)
          .order("sort_order", { ascending: true });
        setComboOffers((offersRes.data || []) as unknown as ComboOfferRow[]);
      } else {
        setComboOffers([]);
      }

      const spotMap: Record<string, number> = {};
      for (const s of (slotsRes.data || [])) {
        const avail = Math.max(0, (s.capacity_total || 0) - (s.booked || 0) - (s.held || 0));
        spotMap[s.tour_id] = (spotMap[s.tour_id] || 0) + avail;
      }
      setSpotsThisWeek(spotMap);
      setTotalBookings(bookingsRes.count || 0);

      const rvMap: Record<string, { avg: number; count: number }> = {};
      for (const rs of (rvStatsRes.data || [])) {
        if (rs.review_count > 0) rvMap[rs.tour_id] = { avg: Number(rs.avg_rating), count: rs.review_count };
      }
      setReviewStats(rvMap);

      // Supabase types the joined tour as an array; it is one row per slot.
      setDeals((dealsRes.data || [])
        .map((s) => ({ ...s, tour: (Array.isArray(s.tours) ? s.tours[0] : s.tours) as { name: string; base_price_per_person: number; hidden: boolean | null; active: boolean | null } | undefined }))
        .filter((s) =>
          s.tour && s.tour.active !== false && !s.tour.hidden
          && (s.capacity_total || 0) - (s.booked || 0) - (s.held || 0) > 0
        )
        .slice(0, 4) as DealSlot[]);

      setLoading(false);
    })();
  }, [tenantSupabase, theme.id]);

  // No tenant for this host (bare booking domain) — render the central
  // operator directory instead of an empty storefront.
  if (!theme.id) return <OperatorDirectory />;

  if (loading) return (
    <div className="app-container page-wrap">
      {/* Shimmering glass blocks matching the final card grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`glass-skeleton overflow-hidden ${i > 1 ? "hidden md:block" : ""} ${i > 2 ? "md:hidden xl:block" : ""}`} style={{ borderRadius: 28, height: 420 }} />
        ))}
      </div>
    </div>
  );

  // Fix 3a: a paused or suspended operator shows a status page instead of a
  // sellable tour list. Checked after `loading` so the notice never flashes
  // before the tenant resolves. The binding gate is server-side in
  // create-checkout; this is the storefront's side of it.
  if (!trading) return <div className="app-container page-wrap"><TenantClosedNotice /></div>;

  return (
    <div className="app-container page-wrap">
      {draft && (
        <div className="glass mb-8 px-5 py-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">

            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Pick up where you left off?</p>
              <p className="truncate text-[13px]" style={{ color: "var(--ink-muted)" }}>
                {draft.tourName || "Your tour"}
                {draft.date && draft.slotTime && (
                  <> &middot; {new Date(draft.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })} at {draft.slotTime}</>
                )}
              </p>
            </div>
            <a href={draftResumeUrl(draft)} className="btn btn-primary shrink-0 px-4 py-2.5 text-[13px]">
              Resume
            </a>
            <button onClick={() => { clearDraft(); setDraft(null); }} className="shrink-0 text-[12px] underline underline-offset-2" style={{ color: "var(--ink-muted)" }} aria-label="Dismiss resume banner">
              Dismiss
            </button>
          </div>
        </div>
      )}
      {/* Hero copy sits on glass — text never floats on raw imagery (§5 rule 4).
          No copy saved in Site Settings means no hero at all; this is a
          multi-tenant storefront, so there is no sensible default sentence. */}
      {(theme.hero_eyebrow || theme.hero_title || theme.hero_subtitle) && (
        <div className="glass mx-auto mb-8 max-w-3xl px-6 py-6 sm:mb-10 sm:px-10 sm:py-8" style={{ borderRadius: 32 }}>
          <SectionHeader
            centered
            eyebrow={theme.hero_eyebrow || undefined}
            title={theme.hero_title || ""}
            subtitle={theme.hero_subtitle || undefined}
          />
        </div>
      )}



      {deals.length > 0 && (
        <div className="glass mb-8 px-5 py-4" style={{ borderRadius: 28 }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: "var(--accent)", color: "var(--ink-on-main)" }}>
              Last minute
            </span>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              {deals.length === 1 ? "1 departure" : deals.length + " departures"} leaving soon at a reduced rate
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {deals.map((d) => (
              <button type="button" key={d.id}
                className="glass-chip flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-shadow hover:shadow-md"
                aria-label={"Book " + d.tour.name + " on " + fmtDate(d.start_time, tz) + " at the last-minute rate"}
                onClick={() => router.push("/book?tour=" + d.tour_id + "&slot=" + d.id + "&date=" + encodeURIComponent(d.start_time))}>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  {d.tour.name}
                  <span className="ml-2 font-normal" style={{ color: "var(--ink-muted)" }}>
                    {fmtDate(d.start_time, tz)} at {fmtTime(d.start_time, tz)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                  <span className="mr-1.5 font-normal line-through" style={{ color: "var(--ink-faint)" }}>R{d.tour.base_price_per_person}</span>
                  R{d.price_per_person_override}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tours.length === 0 && !loading && (
        <div className="col-span-1 md:col-span-3 py-12 text-center text-[color:var(--textMuted)]">
          <p className="text-lg">No tours currently available.</p>
          <p className="mt-2 text-sm">Please make sure tours are un-hidden in your Dashboard.</p>
        </div>
      )}

      {/* Floating glass tour cards — one grid: 1 col mobile, 2 ≥768px, 3 ≥1280px */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {tours.map((tour, idx) => {
          const rv = reviewStats[tour.id];
          const spots = spotsThisWeek[tour.id];
          const urgencyLabel = spots !== undefined && spots <= 6 && spots > 0
            ? `Only ${spots} spot${spots === 1 ? "" : "s"} left this week`
            : null;
          return (
            <button type="button" key={tour.id} data-shot="tour-card"
              className="glass glass-hover group cursor-pointer overflow-hidden text-left active:scale-[0.98] flex flex-col"
              style={{ borderRadius: 28 }}
              aria-label={"Book " + tour.name}
              onClick={() => router.push("/book?tour=" + tour.id)}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={tour.image_url || TOUR_IMAGES[tour.name] || TOUR_IMAGES["Sea Kayak"]} alt={tour.name + " tour"}
                  fill sizes="(max-width: 767px) 92vw, (max-width: 1279px) 46vw, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" priority={idx === 0} loading={idx === 0 ? "eager" : "lazy"} />
                {/* Text over imagery always sits on a scrim or a glass capsule */}
                <div className="glass-photo-scrim" />
                <span className="glass-chip absolute bottom-3 left-3 px-3.5 py-1.5 font-display text-[15px] font-bold">
                  R{tour.base_price_per_person}
                  <span className="ml-1 text-[11px] font-normal" style={{ color: "var(--ink-muted)" }}>pp</span>
                </span>
                <span className="glass-chip absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                </span>
                {urgencyLabel && (
                  <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm" style={{ background: "var(--danger)", color: "#fff" }}>
                    {urgencyLabel}
                  </span>
                )}
              </div>
              <div className="px-5 pb-5 pt-4">
                <h3 className="font-display text-xl font-semibold leading-tight" style={{ color: "var(--ink)", fontSize: "1.25rem" }}>
                  {tour.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="glass-chip inline-flex items-center px-2.5 py-1 text-[11px] font-semibold">
                    {formatDuration(tour.duration_minutes)}
                  </span>
                  {rv && (
                    <span className="glass-chip inline-flex items-center px-2.5 py-1 text-[11px] font-semibold">
                      {rv.avg.toFixed(1)} · {rv.count} review{rv.count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {tour.description || "An incredible experience along the stunning coastline."}
                </p>
                <span className="btn btn-primary mt-4 w-full text-[13px]">
                  {theme.card_cta_label || "Book Now"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Combo Packages */}
      {comboOffers.length > 0 && (
        <div className="mt-16">
          <div className="glass mx-auto mb-8 max-w-3xl px-6 py-6 sm:px-10" style={{ borderRadius: 32 }}>
            <SectionHeader
              centered
              eyebrow="Save More"
              title="Combo Packages"
              subtitle="Bundle two adventures together and save."
            />
          </div>
          <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {comboOffers.map((combo) => {
              const comboTours = (combo.items || [])
                .slice()
                .sort((a, b) => (a.position || 0) - (b.position || 0))
                .map((i) => i.tours)
                .filter(Boolean);
              const tourA = comboTours[0];
              const tourB = comboTours[1];
              const extraCount = Math.max(0, comboTours.length - 2);
              const totalDuration = comboTours.reduce((s, t) => s + (t?.duration_minutes || 0), 0);
              const savings = combo.original_price - combo.combo_price;
              return (
                <button type="button" key={combo.id} className="relative w-full max-w-[380px] mx-auto group cursor-pointer text-left" aria-label={"Book combo: " + combo.name}
                  onClick={() => router.push("/combo/" + combo.id)}>
                  <div className="glass glass-hover overflow-hidden" style={{ borderRadius: 28 }}>
                    {/* Dual image strip */}
                    <div className="flex h-[180px]">
                      <div className="w-1/2 relative overflow-hidden">
                        <Image src={tourA?.image_url || TOUR_IMAGES[tourA?.name || ""] || TOUR_IMAGES["Sea Kayak"]} alt={tourA?.name || "Tour"}
                          fill sizes="190px" className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-semibold truncate">{tourA?.name}</p>
                        </div>
                      </div>
                      <div className="w-1/2 relative overflow-hidden border-l" style={{ borderColor: "var(--glass-border)" }}>
                        <Image src={tourB?.image_url || TOUR_IMAGES[tourB?.name || ""] || TOUR_IMAGES["Sea Kayak"]} alt={tourB?.name || "Tour"}
                          fill sizes="190px" className="object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-semibold truncate">{tourB?.name}{extraCount > 0 ? ` +${extraCount} more` : ""}</p>
                        </div>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-lg font-bold leading-tight" style={{ color: "var(--ink)" }}>{combo.name}</h3>
                        {savings > 0 && (
                          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--accent)", color: "var(--ink-on-main)" }}>
                            Save R{savings}
                          </span>
                        )}
                      </div>
                      {combo.description && <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--ink-muted)" }}>{combo.description}</p>}
                      <div className="flex items-baseline gap-2 mt-3">
                        <span className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>R{combo.combo_price}</span>
                        <span className="text-sm" style={{ color: "var(--ink-muted)" }}>/pp</span>
                        {savings > 0 && <span className="text-sm line-through" style={{ color: "var(--ink-faint)" }}>R{combo.original_price}</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: "var(--ink-muted)" }}>
                        <span>{formatDuration(totalDuration)} total</span>
                        <span>•</span>
                        <span>{comboTours.length || 2} experiences</span>
                      </div>
                      <div className="text-center mt-4">
                        <span className="btn btn-primary w-full text-xs uppercase tracking-wide">
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
