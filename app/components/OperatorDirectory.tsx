"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Central BookingTours landing page — a directory of every live operator,
// modelled on intrepidtravel.com's component structure: utility strip → sticky
// nav → full-bleed left-aligned photo hero with search panel → accent review
// strip → operator card rail (image-top cards, "From R X" price row) → why-us
// icon grid → destination photo tiles → recruitment band → dark footer.
// Flat, confident blocks in the BookingTours brand (pine / paper / amber);
// copy and colours are super-admin-editable via platform_public_settings.

type DirectoryOperator = {
  id: string;
  name: string | null;
  business_name: string | null;
  business_tagline: string | null;
  subdomain: string | null;
  logo_url: string | null;
  booking_site_url: string | null;
  location_phrase: string | null;
  hero_image_url: string | null;
  tour_count: number;
  from_price: number | null;
};

export type DirectoryConfig = {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  search_placeholder?: string;
  hero_image_url?: string;
  accent?: string;
  review_strip?: string;
  value_props?: Array<{ title: string; text: string }>;
  cta_label?: string;
  footer_note?: string;
};

export const DIRECTORY_DEFAULTS: Required<DirectoryConfig> = {
  eyebrow: "The home of independent tour operators",
  headline: "Real and remarkable adventures, run by local operators",
  subheadline: "Kayaking, hiking, boats, wine routes and more across Southern Africa — book directly with the independent operators who run every trip.",
  search_placeholder: "Search operators or destinations…",
  hero_image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=2000&q=80",
  accent: "",
  review_strip: "Book direct with independent local operators — no middleman, no markups",
  value_props: [
    { title: "Book direct", text: "Every booking goes straight to the operator running your trip. Your money stays with the people who take you out." },
    { title: "Local experts", text: "Independent operators who live where you're adventuring, with the local knowledge to match." },
    { title: "Secure payment", text: "Card payments processed by PCI DSS compliant providers. Your details never touch our servers." },
    { title: "Instant confirmation", text: "Live availability, instant booking confirmation, and your tickets on email and WhatsApp." },
  ],
  cta_label: "View tours",
  footer_note: "BookingTours gives independent operators a booking site, payments, WhatsApp and a place in this directory.",
};

// BookingTours brand (docs/BRAND.md): pine / paper / amber
const PINE = "#0F2B1F";
const PINE_DEEP = "#0A2018";
const PAPER = "#F7F5F0";
const INK = "#1A241F";
const AMBER = "#D9A441";

function operatorUrl(op: DirectoryOperator) {
  const url = (op.booking_site_url || "").replace(/\/+$/, "");
  if (url) return url;
  return op.subdomain ? `https://${op.subdomain}.booking.bookingtours.co.za` : "#";
}

function cleanLocation(loc: string | null) {
  return (loc || "").replace(/^(in|at|on)\s+/i, "").trim();
}

export default function OperatorDirectory() {
  const [operators, setOperators] = useState<DirectoryOperator[]>([]);
  const [config, setConfig] = useState<DirectoryConfig>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [opsRes, cfgRes] = await Promise.all([
        supabase.from("operator_directory").select("*").order("name", { ascending: true }),
        supabase.from("platform_public_settings").select("value").eq("key", "directory").maybeSingle(),
      ]);
      setOperators(((opsRes.data || []) as DirectoryOperator[]).filter((o) => o.tour_count > 0));
      setConfig((cfgRes.data?.value as DirectoryConfig) || {});
      setLoading(false);
    })();
  }, []);

  const cfg = useMemo(
    () => ({ ...DIRECTORY_DEFAULTS, ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== "" && v != null)) }),
    [config],
  );
  const accent = cfg.accent || AMBER;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((o) =>
      [o.business_name, o.name, o.business_tagline, o.location_phrase]
        .some((f) => (f || "").toLowerCase().includes(q)));
  }, [operators, query]);

  const destinations = useMemo(() => {
    const byLoc: Record<string, { name: string; image: string | null; count: number }> = {};
    for (const o of operators) {
      const loc = cleanLocation(o.location_phrase);
      if (!loc) continue;
      const d = (byLoc[loc.toLowerCase()] = byLoc[loc.toLowerCase()] || { name: loc, image: null, count: 0 });
      d.count += o.tour_count;
      if (!d.image && o.hero_image_url) d.image = o.hero_image_url;
    }
    return Object.values(byLoc);
  }, [operators]);

  const totalExperiences = operators.reduce((s, o) => s + o.tour_count, 0);

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      {/* ── Utility strip ── */}
      <div style={{ background: PINE_DEEP }} className="px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-[11px] text-white/70">
          <span className="truncate">{cfg.eyebrow}</span>
          <a href="#for-operators" className="shrink-0 font-semibold text-white/90 hover:text-white">For operators</a>
        </div>
      </div>

      {/* ── Main nav ── */}
      <header className="sticky top-0 z-40 border-b border-black/5 px-4" style={{ background: PAPER }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <a href="/" className="font-display text-xl font-black tracking-tight" style={{ color: PINE }}>
            bookingtours
          </a>
          <nav className="flex items-center gap-5 text-[13px] font-semibold">
            <a href="#operators" className="hover:underline">Operators</a>
            <a href="#destinations" className="hidden sm:inline hover:underline">Destinations</a>
            <a href="#why" className="hidden sm:inline hover:underline">Why book here</a>
            <button
              onClick={() => searchRef.current?.focus()}
              aria-label="Search"
              className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white"
              style={{ background: PINE }}
            >
              Search
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero: full-bleed photo, left-aligned type + search panel ── */}
      <section className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cfg.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,25,18,0.72) 0%, rgba(10,25,18,0.35) 55%, rgba(10,25,18,0.15) 100%)" }} />
        <div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col justify-center px-4 py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>{cfg.eyebrow}</p>
          <h1 className="font-display mt-3 max-w-2xl text-4xl font-black leading-[1.05] text-white sm:text-6xl">
            {cfg.headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{cfg.subheadline}</p>
          <div className="mt-8 flex w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={cfg.search_placeholder}
              className="w-full px-5 py-4 text-[15px] outline-none"
              style={{ color: INK }}
            />
            <a
              href="#operators"
              className="flex shrink-0 items-center px-7 text-[13px] font-bold uppercase tracking-wide text-white"
              style={{ background: PINE }}
            >
              Search
            </a>
          </div>
        </div>
      </section>

      {/* ── Review / trust strip ── */}
      <section className="px-4 py-4" style={{ background: accent }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-bold" style={{ color: PINE_DEEP }}>
            <span aria-hidden className="mr-2">★★★★★</span>{cfg.review_strip}
          </p>
          <p className="text-[13px] font-semibold" style={{ color: PINE_DEEP }}>
            {operators.length} operator{operators.length === 1 ? "" : "s"} · {totalExperiences} experience{totalExperiences === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* ── Operator cards ── */}
      <section id="operators" className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: PINE }}>Book direct</p>
            <h2 className="font-display mt-1 text-3xl font-black sm:text-4xl" style={{ color: INK }}>Our operators</h2>
          </div>
          {query && <button onClick={() => setQuery("")} className="text-[13px] font-semibold underline">Clear search</button>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: PINE }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-md rounded-lg bg-white p-10 text-center shadow-sm">
            <p className="font-bold">No operators found</p>
            <p className="mt-2 text-sm opacity-70">{query ? "Try a different search." : "Operators will appear here as they join BookingTours."}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
            {filtered.map((op) => {
              const displayName = op.business_name || op.name || "Operator";
              const loc = cleanLocation(op.location_phrase);
              return (
                <a key={op.id} href={operatorUrl(op)} className="group block overflow-hidden rounded-lg bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative h-48 overflow-hidden">
                    {op.hero_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={op.hero_image_url} alt={displayName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white" style={{ background: PINE }}>
                        {displayName.charAt(0)}
                      </div>
                    )}
                    {loc && (
                      <span className="absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: PINE_DEEP }}>
                        {loc}
                      </span>
                    )}
                    {op.logo_url && (
                      <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={op.logo_url} alt="" className="h-full w-full object-contain" />
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-[150px] flex-col p-4">
                    <h3 className="font-display text-lg font-black leading-snug" style={{ color: INK }}>{displayName}</h3>
                    {op.business_tagline && <p className="mt-1 line-clamp-2 text-[13px] leading-snug opacity-70">{op.business_tagline}</p>}
                    <p className="mt-1 text-[12px] font-semibold opacity-60">{op.tour_count} experience{op.tour_count === 1 ? "" : "s"}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-black/10 pt-3">
                      {op.from_price != null ? (
                        <p className="text-[13px]">
                          <span className="opacity-60">From </span>
                          <span className="text-[16px] font-black" style={{ color: PINE }}>R{Math.round(Number(op.from_price))}</span>
                          <span className="opacity-60"> pp</span>
                        </p>
                      ) : <span />}
                      <span className="text-[12px] font-bold uppercase tracking-wide transition-transform group-hover:translate-x-0.5" style={{ color: PINE }}>
                        {cfg.cta_label} →
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Why book with BookingTours ── */}
      {cfg.value_props.length > 0 && (
        <section id="why" className="px-4 py-14" style={{ background: "#EFEBE2" }}>
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-black sm:text-4xl" style={{ color: INK }}>What sets our operators apart</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {cfg.value_props.map((vp, i) => (
                <div key={i}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ background: accent, color: PINE_DEEP }}>
                    {i + 1}
                  </span>
                  <p className="mt-4 font-display text-[17px] font-black" style={{ color: INK }}>{vp.title}</p>
                  <p className="mt-2 text-[14px] leading-relaxed opacity-75">{vp.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Destination tiles ── */}
      {destinations.length > 0 && (
        <section id="destinations" className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl font-black sm:text-4xl" style={{ color: INK }}>Where do you want to go?</h2>
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {destinations.map((d) => (
              <a
                key={d.name}
                href="#operators"
                onClick={() => setQuery(d.name)}
                className="group relative block h-40 overflow-hidden rounded-lg shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt={d.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full" style={{ background: PINE }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="font-display text-lg font-black text-white">{d.name}</p>
                  <p className="text-[12px] font-semibold text-white/80">{d.count} experience{d.count === 1 ? "" : "s"}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Operator recruitment band ── */}
      <section id="for-operators" className="px-4 py-16" style={{ background: PINE }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-black text-white sm:text-4xl">Run tours? Get listed.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">{cfg.footer_note}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 py-10" style={{ background: PINE_DEEP }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span className="font-display text-lg font-black text-white">bookingtours</span>
          <p className="text-[12px] text-white/60">
            {operators.length} independent operators · Southern Africa · Powered by BookingTours
          </p>
        </div>
      </footer>
    </div>
  );
}
