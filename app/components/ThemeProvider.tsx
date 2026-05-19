"use client";
import { useEffect, useState, createContext, useContext } from "react";
import { createBusinessResolverSupabase } from "../lib/supabase";
import { tenantSubdomainFromHost } from "../lib/tenant-headers";

type ThemeData = {
  id: string | null;
  color_main: string | null;
  color_secondary: string | null;
  color_cta: string | null;
  color_bg: string | null;
  color_nav: string | null;
  color_hover: string | null;
  chatbot_avatar: string | null;
  hero_eyebrow: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  business_name: string | null;
  business_tagline: string | null;
  logo_url: string | null;
  timezone: string | null;
  what_to_bring: string | null;
  what_to_wear: string | null;
  directions: string | null;
  nav_gift_voucher_label: string | null;
  nav_my_bookings_label: string | null;
  card_cta_label: string | null;
  chat_widget_label: string | null;
  footer_line_one: string | null;
  footer_line_two: string | null;
  subscription_status: string | null;
  refund_policy_text: string | null;
};

const defaults: ThemeData = {
  id: null, color_main: null, color_secondary: null, color_cta: null,
  color_bg: null, color_nav: null, color_hover: null, chatbot_avatar: null,
  hero_eyebrow: null, hero_title: null, hero_subtitle: null,
  business_name: null, business_tagline: null, logo_url: null,
  timezone: null, what_to_bring: null, what_to_wear: null, directions: null,
  nav_gift_voucher_label: null, nav_my_bookings_label: null,
  card_cta_label: null, chat_widget_label: null,
  footer_line_one: null, footer_line_two: null,
  subscription_status: null, refund_policy_text: null,
};

// AN3 P1: explicit column list mirrors the ThemeData keys above so anon reads
// don't fan out to encrypted credentials / internal billing columns. Without
// this, switching the businesses table to column-level grants would 401 on
// `select=*` because PostgREST expands `*` to every introspected column.
const BUSINESS_THEME_COLS = (Object.keys(defaults) as string[]).join(",");

/** Map a raw DB row (which may have extra or missing columns) to ThemeData safely */
function toTheme(row: Record<string, unknown> | null): ThemeData {
  if (!row) return defaults;
  const t: ThemeData = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof ThemeData)[]) {
    if (key in row && row[key] !== undefined) {
      (t as any)[key] = row[key];
    }
  }
  return t;
}

const ThemeCtx = createContext<ThemeData>(defaults);

export function useTheme() { return useContext(ThemeCtx); }

function hexToRgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function darken(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - pct / 100;
  return "#" + [Math.round(r * f), Math.round(g * f), Math.round(b * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function lighten(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = pct / 100;
  return "#" + [Math.round(r + (255 - r) * f), Math.round(g + (255 - g) * f), Math.round(b + (255 - b) * f)].map(v => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolves which business this booking site belongs to.
 *
 * Strategy (in order):
 * 1. NEXT_PUBLIC_BUSINESS_ID env var — set per Vercel deployment to lock to a business
 * 2. ?business_id= query parameter — for previewing / testing
 * 3. Match the current standard subdomain or current origin without enumerating businesses
 */
async function resolveBusiness(): Promise<ThemeData> {
  // 1. Environment variable — most reliable, set once per Vercel deployment
  const envBusinessId = process.env.NEXT_PUBLIC_BUSINESS_ID || "";
  if (envBusinessId) {
    const scoped = createBusinessResolverSupabase({ businessId: envBusinessId });
    const { data: envBiz } = await scoped.from("businesses").select(BUSINESS_THEME_COLS).eq("id", envBusinessId).maybeSingle();
    if (envBiz) return toTheme(envBiz as unknown as Record<string, unknown>);
  }

  // 2. Query parameter override (e.g. ?business_id=xxx for testing)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get("business_id");
    if (paramId) {
      const scoped = createBusinessResolverSupabase({ businessId: paramId });
      const { data: paramBiz } = await scoped.from("businesses").select(BUSINESS_THEME_COLS).eq("id", paramId).maybeSingle();
      if (paramBiz) return toTheme(paramBiz as unknown as Record<string, unknown>);
    }
  }

  // 3. Match current domain without fetching all tenants.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (origin) {
    const hostname = window.location.hostname;
    const subdomain = tenantSubdomainFromHost(hostname);

    if (subdomain) {
      const scoped = createBusinessResolverSupabase({ subdomain });
      const { data: subdomainBiz } = await scoped.from("businesses").select(BUSINESS_THEME_COLS).eq("subdomain", subdomain).maybeSingle();
      if (subdomainBiz) return toTheme(subdomainBiz as unknown as Record<string, unknown>);
    }

    const scoped = createBusinessResolverSupabase({ origin });
    const normOrigin = origin.replace(/\/+$/, "");
    const { data: originBiz } = await scoped.from("businesses")
      .select(BUSINESS_THEME_COLS)
      .in("booking_site_url", [normOrigin, normOrigin + "/"])
      .maybeSingle();
    if (originBiz) {
      return toTheme(originBiz as unknown as Record<string, unknown>);
    }
  }

  return defaults;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeData>(defaults);

  useEffect(() => {
    (async () => {
      const resolved = await resolveBusiness();
      if (resolved) {
        setTheme(resolved);
      }
    })();
    // Load dotlottie script for animated avatars
    if (!document.getElementById("dotlottie-script")) {
      const script = document.createElement("script");
      script.id = "dotlottie-script";
      script.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.3/dist/dotlottie-wc.js";
      script.type = "module";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme.color_main) {
      root.style.setProperty("--accent", theme.color_main);
      root.style.setProperty("--accentHover", darken(theme.color_main, 15));
      root.style.setProperty("--accentSoft", lighten(theme.color_main, 85));
      root.style.setProperty("--focusRing", theme.color_main);
    }
    if (theme.color_secondary) {
      root.style.setProperty("--text", theme.color_secondary);
      root.style.setProperty("--textMuted", lighten(theme.color_secondary, 35));
    }
    if (theme.color_cta) {
      root.style.setProperty("--cta", theme.color_cta);
      root.style.setProperty("--ctaHover", darken(theme.color_cta, 15));
    }
    if (theme.color_bg) {
      root.style.setProperty("--bg", theme.color_bg);
      root.style.setProperty("--surface2", darken(theme.color_bg, 3));
    }
    if (theme.color_nav) {
      root.style.setProperty("--surface", theme.color_nav);
      root.style.setProperty("--border", darken(theme.color_nav, 12));
    }
    if (theme.color_hover) {
      root.style.setProperty("--hoverOverlay", theme.color_hover);
    }
    // Update page title with business name
    if (theme.business_name) {
      document.title = theme.business_name + " | Book Your Tour";
    }
  }, [theme]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}
