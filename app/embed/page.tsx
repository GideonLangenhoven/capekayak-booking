"use client";
// Partner embed widget — glassmorphic, Airbnb-style booking search built to
// sit in a partner site's hero section. "Experience" pill picker + a 5-day
// availability board (per-day time chips with live seat counts); every open
// chip deep-links into the real booking flow (?tour&slot&date) in a new tab.
// The document background is transparent (see embed/layout.tsx) and the card
// paints its own frosted-glass layers, so it looks right over any hero image.
// Auto-resizes its iframe via the bt:resize postMessage protocol (widget.js).
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createTenantSupabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import type { Tour, Slot } from "../lib/types";
import { formatDuration } from "../lib/duration";

const DAY_COUNT = 5;

function dayKeyInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split("T")[0];
}
function dayHeaderParts(key: string): { dow: string; label: string } {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    dow: dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
    label: dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
  };
}

/** 48px tour thumbnail. Eager-loaded: loading="lazy" is deferred indefinitely
 *  by Chromium inside cross-origin iframes (the widget's production context).
 *  Falls back to a tenant-gradient monogram when the image is missing/broken. */
function TourThumb({ tour }: { tour: Tour }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!tour.image_url && !failed;
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/[0.06]">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tour.image_url!} alt="" decoding="async" onError={() => setFailed(true)} className="block h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[17px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--accent,#125e40), var(--cta,#b4641c))" }}
        >
          {tour.name.charAt(0)}
        </span>
      )}
    </span>
  );
}

function WidgetQuick() {
  const params = useSearchParams();
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const tz = theme.timezone || "Africa/Johannesburg";
  const preselectTourId = params.get("tour");

  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Next 5 days starting tomorrow (matches the design reference)
  const dayKeys = useMemo(() => {
    const todayKey = dayKeyInTz(new Date(), tz);
    return Array.from({ length: DAY_COUNT }, (_, i) => addDaysToKey(todayKey, i + 1));
  }, [tz]);

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("tours").select("*")
        .eq("business_id", theme.id).order("sort_order", { ascending: true });
      const visible = ((data || []) as unknown as Tour[]).filter(t => !t.hidden && t.active !== false);
      setTours(visible);
      setLoadingTours(false);
      const pre = preselectTourId ? visible.find(t => t.id === preselectTourId) : null;
      if (pre) setSelectedTour(pre);
      else if (visible.length === 1) setSelectedTour(visible[0]);
      else setPickerOpen(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id]);

  useEffect(() => {
    if (!selectedTour || !theme.id) return;
    setLoadingSlots(true);
    (async () => {
      // Window: the next 5 tenant-timezone days. Fetch with a UTC pad and
      // filter precisely by tz day key.
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + (DAY_COUNT + 2) * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await tenantSupabase.from("slots").select("*")
        .eq("business_id", theme.id).eq("tour_id", selectedTour.id)
        .eq("status", "OPEN").gte("start_time", from).lte("start_time", to)
        .order("start_time", { ascending: true });
      const wanted = new Set(dayKeys);
      setSlots(((data || []) as unknown as Slot[]).filter(s => wanted.has(dayKeyInTz(new Date(s.start_time), tz))));
      setLoadingSlots(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTour, theme.id, dayKeys.join(",")]);

  const timeOf = (s: Slot) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s.start_time));

  // Slots grouped per tenant-timezone day (query is already time-ordered).
  const slotsByDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const k of dayKeys) m.set(k, []);
    for (const s of slots) m.get(dayKeyInTz(new Date(s.start_time), tz))?.push(s);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, dayKeys.join(","), tz]);

  const openCount = (s: Slot) => Math.max(0, (s.capacity_total || 0) - (s.booked || 0) - (s.held || 0));

  // Deep links must land on the operator's own booking site (per-tenant slug,
  // e.g. https://aonyx.booking.bookingtours.co.za) no matter which origin is
  // serving this iframe. Fall back to a relative link (correct on the tenant
  // subdomain) only if the business row has no booking_site_url configured.
  const bookingBase = (theme.booking_site_url || "").replace(/\/+$/, "");

  const bookUrl = (s: Slot, dayKey: string) =>
    `${bookingBase}/book?tour=${encodeURIComponent(selectedTour!.id)}&slot=${encodeURIComponent(s.id)}&date=${encodeURIComponent(dayKey)}&source=widget`;

  const fullCalendarUrl = (tourId: string) => `${bookingBase}/book?tour=${encodeURIComponent(tourId)}&source=widget`;

  const weekRange = `${dayHeaderParts(dayKeys[0]).label} – ${dayHeaderParts(dayKeys[DAY_COUNT - 1]).label}`;
  const togglePicker = () => { if (!loadingTours) setPickerOpen(o => !o); };

  const scrollMask = "linear-gradient(90deg,transparent 0,black 14px,black calc(100% - 26px),transparent 100%)";

  /** One bookable (or sold-out) time chip — shared by desktop grid + mobile carousel. */
  const renderChip = (s: Slot, dayKey: string) => {
    const open = openCount(s);
    const time = timeOf(s);
    if (open <= 0) {
      return (
        <div key={s.id} className="select-none rounded-xl border border-black/[0.05] bg-black/[0.04] px-2 py-2 text-center">
          <span className="block text-[13px] font-semibold text-[#b3ada2] line-through decoration-[#d4cec2]">{time}</span>
          <span className="mt-0.5 block text-[10.5px] font-medium text-[#b3ada2]">Sold out</span>
        </div>
      );
    }
    const scarce = open <= 3;
    return (
      <a
        key={s.id}
        href={bookUrl(s, dayKey)}
        target="_blank"
        rel="noopener"
        aria-label={`Book ${selectedTour!.name} on ${dayHeaderParts(dayKey).label} at ${time}, ${open} ${open === 1 ? "seat" : "seats"} available`}
        className="group block rounded-xl border border-black/[0.06] bg-white/85 px-2 py-2 text-center shadow-[0_1px_2px_rgba(20,24,22,0.06)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-[0_10px_22px_-8px_rgba(20,24,22,0.28)] hover:ring-2 hover:ring-[color:color-mix(in_srgb,var(--accent,#125e40)_45%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#125e40)] active:scale-[0.97]"
      >
        <span className="block text-[13.5px] font-bold text-[#211d19]">{time}</span>
        <span className={`mt-0.5 block text-[10.5px] font-semibold ${scarce ? "text-amber-700" : "text-emerald-700"}`}>
          {scarce ? `${open} left` : `${open} seats`}
        </span>
      </a>
    );
  };

  const dayHeader = (k: string) => {
    const h = dayHeaderParts(k);
    return (
      <div className="pb-2 text-center">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8478]">{h.dow}</span>
        <span className="block text-[13.5px] font-bold text-[#211d19]">{h.label}</span>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[880px] p-3 antialiased sm:p-4">
      {/* ── Frosted glass card ──────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden rounded-[28px] border border-white/60 bg-white/[0.84] shadow-[0_32px_90px_-24px_rgba(15,20,18,0.45),0_2px_10px_rgba(15,20,18,0.08)] ring-1 ring-black/[0.04] sm:rounded-[32px]">
        {/* Ambient tenant-tinted glass layers (blurred by the panels above them) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-28 -z-10 h-80 w-80 rounded-full opacity-70 blur-[80px]"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent,#125e40) 38%, transparent), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 -z-10 h-96 w-96 rounded-full opacity-60 blur-[90px]"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--cta,#b4641c) 34%, transparent), transparent)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

        {/* ── Header: live badge + tenant name ─────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#6f6a62]">Live availability</span>
          </span>
          {theme.business_name && (
            <span className="truncate pl-3 text-[12px] font-semibold text-[#4c463e]">{theme.business_name}</span>
          )}
        </div>

        {/* ── Airbnb-style search pill ──────────────────────────────────── */}
        <div className="px-4 pt-3 sm:px-6">
          <div className="flex items-stretch rounded-full border border-white/70 bg-white/90 shadow-[0_14px_40px_-14px_rgba(20,24,22,0.35)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_18px_48px_-14px_rgba(20,24,22,0.45)]">
            <button
              type="button"
              onClick={togglePicker}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              className="min-w-0 flex-1 rounded-full py-2.5 pl-6 pr-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#125e40)]"
            >
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#3f3a33]">Experience</span>
              <span className={`block truncate text-[14px] ${selectedTour ? "font-semibold text-[#211d19]" : "text-[#8a8478]"}`}>
                {loadingTours ? "Loading experiences…" : selectedTour ? selectedTour.name : tours.length === 0 ? "No experiences available" : "Choose an experience"}
              </span>
            </button>
            <div aria-hidden className="my-2.5 hidden w-px bg-black/10 sm:block" />
            <button type="button" onClick={togglePicker} tabIndex={-1} className="hidden shrink-0 py-2.5 pl-5 pr-4 text-left sm:block">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#3f3a33]">When</span>
              <span className="block text-[14px] text-[#8a8478]">{weekRange}</span>
            </button>
            <div className="flex items-center pl-1 pr-2">
              <button
                type="button"
                onClick={togglePicker}
                aria-label={pickerOpen ? "Close experience list" : "Open experience list"}
                className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(20,24,22,0.4)] ring-1 ring-white/40 transition-all duration-200 hover:scale-[1.05] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#125e40)] focus-visible:ring-offset-2 sm:h-12 sm:w-12"
                style={{ background: "linear-gradient(135deg, var(--accent,#125e40) 0%, var(--cta,#b4641c) 100%)" }}
              >
                {pickerOpen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ── Experience picker ─────────────────────────────────────── */}
          {pickerOpen && !loadingTours && (
            <div
              role="listbox"
              aria-label="Choose an experience"
              className="mt-2 origin-top animate-[btScaleIn_.32s_cubic-bezier(.16,1,.3,1)] overflow-hidden rounded-[22px] border border-white/70 bg-white/95 shadow-[0_24px_60px_-20px_rgba(20,24,22,0.4)] backdrop-blur-xl"
            >
              {tours.length === 0 && (
                <div className="p-6 text-center text-[13.5px] text-[#8a8478]">No experiences are available right now. Please check back soon.</div>
              )}
              {tours.map(t => {
                const selected = selectedTour?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => { setSelectedTour(t); setPickerOpen(false); }}
                    className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-black/[0.035] focus-visible:bg-black/[0.035] focus-visible:outline-none sm:px-5 ${selected ? "bg-[color:color-mix(in_srgb,var(--accent,#125e40)_7%,transparent)]" : ""}`}
                  >
                    <TourThumb tour={t} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#211d19]">{t.name}</span>
                      <span className="block text-[12px] text-[#8a8478]">{formatDuration(t.duration_minutes)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-bold text-[#211d19]">R{t.base_price_per_person}</span>
                      <span className="block text-[11px] text-[#8a8478]">per person</span>
                    </span>
                    {selected && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: "var(--accent,#125e40)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 5-day availability board ──────────────────────────────────── */}
        {selectedTour && (
          <div key={selectedTour.id} className="animate-[btFadeUp_.4s_cubic-bezier(.16,1,.3,1)] px-4 pb-5 pt-5 sm:px-6 sm:pb-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[13px] font-bold tracking-tight text-[#3f3a33]">Next {DAY_COUNT} days</h3>
              <a
                href={fullCalendarUrl(selectedTour.id)}
                target="_blank"
                rel="noopener"
                className="text-[12px] font-semibold text-[color:var(--accent,#125e40)] underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Full calendar →
              </a>
            </div>

            {loadingSlots ? (
              <>
                {/* Skeletons — day headers render immediately, chips shimmer */}
                <div className="hidden gap-2 sm:grid sm:grid-cols-5">
                  {dayKeys.map(k => (
                    <div key={k}>
                      {dayHeader(k)}
                      <div className="flex flex-col gap-1.5">
                        <div className="h-[52px] animate-pulse rounded-xl bg-black/[0.05]" />
                        <div className="h-[52px] animate-pulse rounded-xl bg-black/[0.05]" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2.5 overflow-hidden sm:hidden">
                  {dayKeys.slice(0, 3).map(k => (
                    <div key={k} className="h-36 w-[136px] shrink-0 animate-pulse rounded-2xl bg-black/[0.05]" />
                  ))}
                </div>
              </>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-6 py-8 text-center backdrop-blur-md">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#b3ada2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <p className="text-[13.5px] font-medium text-[#6f6a62]">No departures in the next {DAY_COUNT} days.</p>
                <a
                  href={fullCalendarUrl(selectedTour.id)}
                  target="_blank"
                  rel="noopener"
                  className="rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#125e40)] focus-visible:ring-offset-2"
                  style={{ background: "linear-gradient(135deg, var(--accent,#125e40), var(--cta,#b4641c))" }}
                >
                  View full calendar
                </a>
              </div>
            ) : (
              <>
                {/* Desktop: 5 day columns */}
                <div className="hidden gap-2 sm:grid sm:grid-cols-5">
                  {dayKeys.map((k, i) => {
                    const daySlots = slotsByDay.get(k) || [];
                    return (
                      <div
                        key={k}
                        className="animate-[btFadeUp_.45s_cubic-bezier(.16,1,.3,1)]"
                        style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                      >
                        {dayHeader(k)}
                        <div className="flex flex-col gap-1.5">
                          {daySlots.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-black/10 px-2 py-3 text-center text-[10.5px] font-medium text-[#b3ada2]">
                              No trips
                            </div>
                          ) : (
                            daySlots.map(s => renderChip(s, k))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile: horizontal snap carousel of day cards */}
                <div
                  className="bt-scroll-x -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 sm:hidden"
                  style={{ WebkitMaskImage: scrollMask, maskImage: scrollMask }}
                >
                  {dayKeys.map((k, i) => {
                    const daySlots = slotsByDay.get(k) || [];
                    return (
                      <div
                        key={k}
                        className="w-[136px] shrink-0 animate-[btFadeUp_.45s_cubic-bezier(.16,1,.3,1)] snap-start rounded-2xl border border-white/70 bg-white/70 p-2.5 shadow-[0_6px_18px_-8px_rgba(20,24,22,0.18)] backdrop-blur-md"
                        style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                      >
                        {dayHeader(k)}
                        <div className="flex flex-col gap-1.5">
                          {daySlots.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-black/10 px-2 py-3 text-center text-[10.5px] font-medium text-[#b3ada2]">
                              No trips
                            </div>
                          ) : (
                            daySlots.map(s => renderChip(s, k))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Trust footer ──────────────────────────────────────────────── */}
        <div className={`flex items-center justify-between border-t border-black/[0.06] bg-white/45 px-5 py-3 backdrop-blur-md sm:px-7 ${selectedTour ? "" : "mt-5"}`}>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#8a8478]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Secure checkout
          </span>
          <span className="text-[11px] text-[#8a8478]">
            Powered by{" "}
            <a
              href="https://bookingtours.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#4c463e]"
            >
              BookingTours
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmbedContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  const bg = params.get("bg") || "transparent";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(function (entries) {
      for (const e of entries) {
        const h = Math.ceil(e.contentRect.height);
        window.parent?.postMessage({ type: "bt:resize", height: h }, "*");
      }
    });
    observer.observe(el);
    return function () { observer.disconnect(); };
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "bt:theme" && typeof ev.data.bg === "string") {
        if (containerRef.current) containerRef.current.style.background = ev.data.bg;
      }
    }
    window.addEventListener("message", onMessage);
    return function () { window.removeEventListener("message", onMessage); };
  }, []);

  return (
    <div ref={containerRef} style={{ background: bg }}>
      <WidgetQuick />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className="p-10" />}>
      <EmbedContent />
    </Suspense>
  );
}
