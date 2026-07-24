"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

// Central BookingTours landing page: a directory of every live operator.
// Operators appear automatically (operator_directory view, directory_visible
// defaults true on creation); copy/branding is super-admin-editable via the
// platform_settings 'directory' row. Styled with the same glass tokens as the
// tenant booking sites.

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
};

export type DirectoryConfig = {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  search_placeholder?: string;
  hero_image_url?: string;
  accent?: string;
  value_props?: Array<{ title: string; text: string }>;
  cta_label?: string;
  footer_note?: string;
};

export const DIRECTORY_DEFAULTS: Required<DirectoryConfig> = {
  eyebrow: "BookingTours",
  headline: "Real adventures, run by real local operators",
  subheadline: "Kayaking, hiking, boats, wine routes and more — book directly with independent Southern African tour operators, all in one place.",
  search_placeholder: "Search operators or locations…",
  hero_image_url: "",
  accent: "",
  value_props: [
    { title: "Book direct", text: "Every booking goes straight to the operator running your trip — no middleman margins." },
    { title: "Local experts", text: "Independent operators who live where you're adventuring, with the local knowledge to match." },
    { title: "Secure payment", text: "Card payments processed by PCI DSS compliant providers. Your details never touch our servers." },
  ],
  cta_label: "View tours",
  footer_note: "Are you a tour operator? BookingTours gives you a booking site, payments, WhatsApp and more.",
};

function operatorUrl(op: DirectoryOperator) {
  const url = (op.booking_site_url || "").replace(/\/+$/, "");
  if (url) return url;
  return op.subdomain ? `https://${op.subdomain}.booking.bookingtours.co.za` : "#";
}

export default function OperatorDirectory() {
  const [operators, setOperators] = useState<DirectoryOperator[]>([]);
  const [config, setConfig] = useState<DirectoryConfig>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const [opsRes, cfgRes] = await Promise.all([
        supabase.from("operator_directory").select("*").order("name", { ascending: true }),
        supabase.from("platform_settings").select("value").eq("key", "directory").maybeSingle(),
      ]);
      setOperators(((opsRes.data || []) as DirectoryOperator[]).filter((o) => o.tour_count > 0));
      setConfig((cfgRes.data?.value as DirectoryConfig) || {});
      setLoading(false);
    })();
  }, []);

  const cfg = useMemo(() => ({ ...DIRECTORY_DEFAULTS, ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== "" && v != null)) }), [config]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((o) =>
      [o.business_name, o.name, o.business_tagline, o.location_phrase]
        .some((f) => (f || "").toLowerCase().includes(q)));
  }, [operators, query]);

  return (
    <div className="min-h-screen" style={cfg.accent ? ({ "--accent": cfg.accent } as React.CSSProperties) : undefined}>
      {/* Hero */}
      <div className="relative overflow-hidden">
        {cfg.hero_image_url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.hero_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}
        <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-12 text-center">
          <p className={"text-xs font-semibold uppercase tracking-[0.25em] " + (cfg.hero_image_url ? "text-white/80" : "text-[color:var(--accent)]")}>{cfg.eyebrow}</p>
          <h1 className={"font-display mt-4 text-4xl sm:text-5xl font-bold leading-tight " + (cfg.hero_image_url ? "text-white" : "text-[color:var(--ink)]")}>
            {cfg.headline}
          </h1>
          <p className={"mx-auto mt-4 max-w-2xl text-base sm:text-lg " + (cfg.hero_image_url ? "text-white/85" : "text-[color:var(--ink-muted)]")}>
            {cfg.subheadline}
          </p>
          <div className="glass mx-auto mt-8 flex max-w-xl items-center gap-3 !rounded-full px-5 py-3">
            <span aria-hidden className="text-[color:var(--ink-muted)]">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={cfg.search_placeholder}
              className="w-full bg-transparent text-sm outline-none text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)]"
            />
          </div>
        </div>
      </div>

      {/* Operator grid */}
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass mx-auto max-w-md p-10 text-center">
            <p className="font-semibold text-[color:var(--ink)]">No operators found</p>
            <p className="mt-2 text-sm text-[color:var(--ink-muted)]">{query ? "Try a different search." : "Operators will appear here as they join BookingTours."}</p>
          </div>
        ) : (
          <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {filtered.map((op) => {
              const displayName = op.business_name || op.name || "Operator";
              return (
                <a
                  key={op.id}
                  href={operatorUrl(op)}
                  className="group w-full max-w-[380px] text-left"
                  aria-label={"View tours from " + displayName}
                >
                  <div className="glass glass-hover overflow-hidden" style={{ borderRadius: 28 }}>
                    <div className="relative h-[180px] overflow-hidden">
                      {op.hero_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={op.hero_image_url} alt={displayName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[color:var(--accent)]/10 text-4xl font-bold text-[color:var(--accent)]">
                          {displayName.charAt(0)}
                        </div>
                      )}
                      {op.logo_url && (
                        <div className="absolute bottom-3 left-3 h-11 w-11 overflow-hidden rounded-full border-2 border-white/80 bg-white shadow-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={op.logo_url} alt="" className="h-full w-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      <h3 className="font-display text-lg font-bold leading-tight text-[color:var(--ink)]">{displayName}</h3>
                      {op.business_tagline && (
                        <p className="mt-1 line-clamp-2 text-xs text-[color:var(--ink-muted)]">{op.business_tagline}</p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-xs text-[color:var(--ink-muted)]">
                        {op.location_phrase && <span>{op.location_phrase.replace(/^(in|at|on)\s+/i, "")}</span>}
                        {op.location_phrase && <span>•</span>}
                        <span>{op.tour_count} {op.tour_count === 1 ? "experience" : "experiences"}</span>
                      </div>
                      <div className="mt-4 text-center">
                        <span className="btn btn-primary w-full text-xs uppercase tracking-wide">{cfg.cta_label}</span>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Why BookingTours */}
      {cfg.value_props.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {cfg.value_props.map((vp, i) => (
              <div key={i} className="glass p-6 text-center" style={{ borderRadius: 24 }}>
                <p className="font-display text-base font-bold text-[color:var(--ink)]">{vp.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{vp.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="border-t border-[color:var(--glass-border)] py-8 text-center">
        <p className="mx-auto max-w-xl px-4 text-xs text-[color:var(--ink-muted)]">{cfg.footer_note}</p>
        <p className="mt-2 text-xs text-[color:var(--ink-faint)]">Powered by BookingTours</p>
      </div>
    </div>
  );
}
