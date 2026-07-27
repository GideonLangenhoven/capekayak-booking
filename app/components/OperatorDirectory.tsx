"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { PHOTO, WAYS, haystack, stock } from "../lib/directory-ways";

// Central BookingTours landing page — a directory of every live operator,
// modelled on intrepidtravel.com's component structure: utility strip → sticky
// nav → full-bleed photo hero carousel with search panel → accent review strip
// → three-column value band → operator card rail (image-top cards, "From R X"
// price row) → why-us grid → ways-to-travel tiles → destination photo tiles →
// recruitment band → multi-column dark footer.
// Flat, confident blocks on the violet -> aquamarine palette; copy and the
// accent colour are super-admin-editable via platform_public_settings.

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
  hero_image_url: "/stock/cape-town-hero.jpg",
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

// Directory palette: the violet → aquamarine ramp.
//   Royal Violet #7400B8 · Indigo Bloom #6930C3 · Slate Indigo #5E60CE
//   Blue Energy #5390D9 · Fresh Sky #4EA8DE · Sky Surge #48BFE3
//   Strong Cyan #56CFE1 · Pearl Aqua #64DFDF · Turquoise #72EFDD · Aquamarine #80FFDB
// Deep violets carry the dark surfaces, the aqua end carries the accents.
// PAPER and INK are derived tints — the ramp supplies no neutral, and a page
// needs a background and a body colour that hold AA against it.
// Note this is directory-only; tenant storefronts keep their own themes.
const PRIMARY = "#6930C3"; // Indigo Bloom — primary (buttons, prices, headings)
const VIOLET = "#7400B8"; // Royal Violet — deepest surface
const PAPER = "#F6F3FC"; // derived: violet-tinted paper
const INK = "#1E1233"; // derived: violet-black body text
const ACCENT = "#72EFDD"; // Turquoise — default accent
const SURFACE_ALT = "#EDE7FA"; // derived: tinted band behind "what sets us apart"
// Both stops stay deep on purpose: turquoise headings sit on this gradient and
// only clear AA (5.37:1 at the lightest stop) while it stays in the violets.
// Slate Indigo #5E60CE as the end stop drops them to 3.74:1.
const DEEP_GRAD = `linear-gradient(135deg, ${VIOLET} 0%, ${PRIMARY} 100%)`;

// Stock photography is self-hosted in public/stock (see PHOTO in
// ../lib/directory-ways). Every photo was fetched and eyeballed before being
// placed — the subject matches the slot it fills. Operator-supplied photos
// always win; these only fill empty slots so the page never falls back to a
// flat tile.
const HERO_W = 1600;

// Hero carousel — Intrepid runs three rotating full-bleed slides with dots.
const HERO_SLIDES = [
  { photo: PHOTO.capeTown, kicker: "Southern Africa" },
  { photo: PHOTO.coast, kicker: "On the water" },
  { photo: PHOTO.hike, kicker: "On foot" },
];

// Stock imagery for well-known Southern African locations, used only when no
// operator in that location has uploaded a photo yet.
const LOCATION_PHOTOS: Array<[RegExp, string]> = [
  [/cape town|sea point|camps bay|table mountain|atlantic seaboard|hout bay/i, PHOTO.capeTown],
  [/winelands|stellenbosch|franschhoek|paarl|constantia/i, PHOTO.wine],
  [/garden route|knysna|plettenberg|hermanus|mossel/i, PHOTO.coast],
  [/drakensberg|berg|maloti|lesotho/i, PHOTO.mountain],
  [/kruger|mpumalanga|limpopo|blyde|panorama/i, PHOTO.canyon],
  [/namibia|swakopmund|sossusvlei|desert|kalahari/i, PHOTO.giraffe],
  [/durban|zululand|kwazulu|st lucia|sodwana/i, PHOTO.dive],
];

// Deterministic so a given operator keeps the same filler photo between renders.
const FILLER = [PHOTO.coast, PHOTO.mountain, PHOTO.canyon, PHOTO.boat, PHOTO.hikeAlt, PHOTO.safari];
function fillerFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FILLER[h % FILLER.length];
}
function locationPhoto(name: string) {
  return (LOCATION_PHOTOS.find(([re]) => re.test(name)) || [null, PHOTO.coast])[1] as string;
}

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
  const [way, setWay] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
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
  const accent = cfg.accent || ACCENT;

  const filtered = useMemo(() => {
    const active = WAYS.find((w) => w.label === way);
    if (active) return operators.filter((o) => active.match.test(haystack(o)));
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((o) => haystack(o).toLowerCase().includes(q));
  }, [operators, query, way]);

  const selectWay = (label: string) => { setWay(label); setQuery(""); };
  const clearFilters = () => { setWay(null); setQuery(""); };

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

  // Only surface a way-to-travel tile that actually matches live operators.
  const ways = useMemo(
    () =>
      WAYS.map((w) => ({ ...w, count: operators.filter((o) => w.match.test(haystack(o))).length }))
        .filter((w) => w.count > 0),
    [operators],
  );

  const totalExperiences = operators.reduce((s, o) => s + o.tour_count, 0);

  // Auto-advance the hero, matching Intrepid's rotating banner. WCAG 2.2.2
  // wants a way to stop motion that starts on its own and runs past 5s: the
  // dots stop it for good, and reduced-motion never starts it.
  useEffect(() => {
    if (!autoPlay || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % HERO_SLIDES.length), 6500);
    return () => clearInterval(t);
  }, [autoPlay]);

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      {/* ── Utility strip ── */}
      <div style={{ background: VIOLET }} className="px-4 py-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-[11px] text-white/70">
          <span className="truncate">{cfg.eyebrow}</span>
          <a href="#for-operators" className="shrink-0 font-semibold text-white/90 hover:text-white">For operators</a>
        </div>
      </div>

      {/* ── Main nav ── */}
      <header className="sticky top-0 z-40 border-b border-black/5 px-4" style={{ background: PAPER }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <a href="/" className="font-display text-xl font-black tracking-tight" style={{ color: PRIMARY }}>
            bookingtours
          </a>
          <nav className="flex items-center gap-5 text-[13px] font-semibold">
            <a href="#operators" className="hover:underline">Operators</a>
            <a href="#ways" className="hidden sm:inline hover:underline">Ways to travel</a>
            <a href="#destinations" className="hidden md:inline hover:underline">Destinations</a>
            <a href="#why" className="hidden md:inline hover:underline">Why book here</a>
            <button
              onClick={() => searchRef.current?.focus()}
              aria-label="Search"
              className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white"
              style={{ background: PRIMARY }}
            >
              Search
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero: rotating full-bleed photo slides + search panel ── */}
      {/* Solid brand fill so the block reads as intentional, not blank, on the
          first paint before any photo has arrived. */}
      <section className="relative" style={{ background: VIOLET }} aria-roledescription="carousel" aria-label="Featured adventures">
        {HERO_SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.photo}
            // The first slide honours the super-admin hero override so existing
            // platform_public_settings keep working.
            src={i === 0 && cfg.hero_image_url !== DIRECTORY_DEFAULTS.hero_image_url ? cfg.hero_image_url : stock(s.photo, HERO_W)}
            alt=""
            aria-hidden
            // All three slides sit in the viewport, so lazy loading will not
            // defer them — priority is what decides which photo paints first.
            // Undifferentiated, the browser raced 2.4MB and the hero stayed a
            // flat colour for seconds on a slow connection.
            fetchPriority={i === 0 ? "high" : "low"}
            decoding={i === 0 ? "sync" : "async"}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === slide ? 1 : 0 }}
          />
        ))}
        {/* Heavy enough over the text column to hold white at AA, and light
            enough past it that the photograph is actually the hero. */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(24,6,45,0.80) 0%, rgba(24,6,45,0.42) 45%, rgba(24,6,45,0.06) 100%)" }} />
        <div className="relative mx-auto flex min-h-[560px] max-w-6xl flex-col justify-center px-4 py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>{cfg.eyebrow}</p>
          <h1 className="font-display mt-3 max-w-2xl text-4xl font-black leading-[1.05] text-white sm:text-6xl">
            {cfg.headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{cfg.subheadline}</p>
          <div className="mt-8 flex w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setWay(null); }}
              placeholder={cfg.search_placeholder}
              className="w-full px-5 py-4 text-[15px] outline-none"
              style={{ color: INK }}
            />
            <a
              href="#operators"
              className="flex shrink-0 items-center px-7 text-[13px] font-bold uppercase tracking-wide text-white"
              style={{ background: PRIMARY }}
            >
              Search
            </a>
          </div>
          {/* Slide picker as photo thumbnails rather than dots — the hero then
              shows the adventure imagery outright instead of hiding two thirds
              of it behind an abstract control. */}
          <div className="mt-10 flex items-center gap-3">
            {HERO_SLIDES.map((s, i) => (
              <button
                key={s.photo}
                onClick={() => { setSlide(i); setAutoPlay(false); }}
                aria-label={`Show ${s.kicker} (slide ${i + 1} of ${HERO_SLIDES.length})`}
                aria-current={i === slide}
                className="group relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition-all sm:h-16 sm:w-24"
                style={{
                  outline: i === slide ? `2px solid ${accent}` : "2px solid rgba(255,255,255,0.35)",
                  outlineOffset: 2,
                  opacity: i === slide ? 1 : 0.65,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stock(s.photo, 240)} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] font-bold leading-tight text-white">
                  {s.kicker}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Review / trust strip ── */}
      <section className="px-4 py-4" style={{ background: accent }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-bold" style={{ color: VIOLET }}>
            <span aria-hidden className="mr-2">★★★★★</span>{cfg.review_strip}
          </p>
          <p className="text-[13px] font-semibold" style={{ color: VIOLET }}>
            {operators.length} operator{operators.length === 1 ? "" : "s"} · {totalExperiences} experience{totalExperiences === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* ── Three-column value band (Intrepid's slot directly under the hero) ── */}
      <section className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 text-center sm:grid-cols-3 sm:text-left">
          {[
            { big: `${totalExperiences} experience${totalExperiences === 1 ? "" : "s"}`, small: `across ${operators.length} independent operator${operators.length === 1 ? "" : "s"} in Southern Africa` },
            { big: "Small independent crews", small: "the people who answer your booking are the people who take you out" },
            { big: "Every rand goes direct", small: "no agency middleman, no commission markup on the price you see" },
          ].map((v) => (
            <div key={v.big} className="border-t-2 pt-4" style={{ borderColor: accent }}>
              <p className="font-display text-[19px] font-black leading-snug" style={{ color: PRIMARY }}>{v.big}</p>
              <p className="mt-2 text-[14px] leading-relaxed opacity-70">{v.small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Operator cards ── */}
      <section id="operators" className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: PRIMARY }}>Book direct</p>
            <h2 className="font-display mt-1 text-3xl font-black sm:text-4xl" style={{ color: INK }}>Our operators</h2>
          </div>
          {(query || way) && (
            <button onClick={clearFilters} className="text-[13px] font-semibold underline">
              {way ? `Clear "${way}"` : "Clear search"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: PRIMARY }} />
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={op.hero_image_url || stock(fillerFor(op.id))}
                      alt={displayName}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {loc && (
                      <span className="absolute left-3 top-3 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: VIOLET }}>
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
                          <span className="text-[16px] font-black" style={{ color: PRIMARY }}>R{Math.round(Number(op.from_price))}</span>
                          <span className="opacity-60"> pp</span>
                        </p>
                      ) : <span />}
                      <span className="text-[12px] font-bold uppercase tracking-wide transition-transform group-hover:translate-x-0.5" style={{ color: PRIMARY }}>
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
        <section id="why" className="px-4 py-14" style={{ background: SURFACE_ALT }}>
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-black sm:text-4xl" style={{ color: INK }}>What sets our operators apart</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {cfg.value_props.map((vp, i) => (
                <div key={i}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ background: accent, color: VIOLET }}>
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

      {/* ── Ways to travel ── */}
      {ways.length > 1 && (
        <section id="ways" className="mx-auto max-w-6xl px-4 py-14">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: PRIMARY }}>Find your thing</p>
            <h2 className="font-display mt-1 text-3xl font-black sm:text-4xl" style={{ color: INK }}>Ways to travel</h2>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ways.map((w) => (
              <a
                key={w.label}
                href="#operators"
                onClick={() => selectWay(w.label)}
                className="group relative block h-56 overflow-hidden rounded-lg shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stock(w.photo)} alt={w.label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="font-display text-xl font-black text-white">{w.label}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-white/80">
                    {w.count} operator{w.count === 1 ? "" : "s"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Destination tiles (a lone tile reads as a broken grid) ── */}
      {destinations.length > 1 && (
        <section id="destinations" className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-display text-3xl font-black sm:text-4xl" style={{ color: INK }}>Where do you want to go?</h2>
          <div className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {destinations.map((d) => (
              <a
                key={d.name}
                href="#operators"
                onClick={() => { setQuery(d.name); setWay(null); }}
                className="group relative block h-40 overflow-hidden rounded-lg shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.image || stock(locationPhoto(d.name))}
                  alt={d.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

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
      <section id="for-operators" className="px-4 py-16" style={{ background: DEEP_GRAD }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-black text-white sm:text-4xl">Run tours? Get listed.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">{cfg.footer_note}</p>
        </div>
      </section>

      {/* ── Footer: multi-column, Intrepid-style ── */}
      <footer className="px-4 pt-14 pb-10" style={{ background: DEEP_GRAD }}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="font-display text-xl font-black text-white">bookingtours</span>
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/60">
                The home of independent tour operators across Southern Africa. Every trip on this page is run by the operator you book with.
              </p>
            </div>
            {[
              {
                heading: "Explore",
                links: [
                  { label: "All operators", href: "#operators" },
                  { label: "Ways to travel", href: "#ways" },
                  { label: "Destinations", href: "#destinations" },
                  { label: "Why book here", href: "#why" },
                ],
              },
              {
                heading: "For operators",
                links: [
                  { label: "Get listed", href: "#for-operators" },
                  { label: "About BookingTours", href: "https://bookingtours.co.za" },
                ],
              },
              {
                heading: "Legal",
                links: [
                  { label: "Terms & Conditions", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Cookies Policy", href: "/cookies" },
                  { label: "Privacy Request", href: "/popia" },
                ],
              },
            ].map((col) => (
              <div key={col.heading}>
                <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>{col.heading}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-[13px] text-white/70 transition-colors hover:text-white">{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <p className="text-[12px] text-white/50">
              {operators.length} independent operator{operators.length === 1 ? "" : "s"} · Southern Africa · Powered by BookingTours
            </p>
            <p className="text-[12px] text-white/50">
              Payments processed by PCI DSS compliant providers · card details never touch our servers
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
