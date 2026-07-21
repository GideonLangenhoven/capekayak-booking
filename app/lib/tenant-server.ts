import { headers } from "next/headers";
import { cache } from "react";
import { createBusinessResolverSupabase } from "./supabase";
import { tenantSubdomainFromHost } from "./tenant-headers";

// Columns for server-rendered metadata (title / OG) PLUS the full theme row —
// the layout hands the whole row to ThemeProvider so the client never makes
// its own theme round-trip (it used to serially block every page's data
// queries behind one browser→DB fetch). Same anon column grants ThemeProvider
// already relied on; selecting more columns of the same indexed row is free.
const TENANT_COLS = [
  "id", "business_name", "business_tagline", "logo_url", "subdomain", "booking_site_url",
  "color_main", "color_secondary", "color_cta", "color_bg", "color_nav", "color_hover",
  "chatbot_avatar", "hero_eyebrow", "hero_title", "hero_subtitle", "hero_image",
  "timezone", "what_to_bring", "what_to_wear", "directions",
  "nav_gift_voucher_label", "nav_my_bookings_label", "card_cta_label", "chat_widget_label",
  "footer_line_one", "footer_line_two", "subscription_status", "refund_policy_text",
  "public_email", "public_phone", "public_whatsapp",
].join(", ");

export type RequestTenant = {
  id: string;
  business_name: string | null;
  business_tagline: string | null;
  logo_url: string | null;
  subdomain: string | null;
  booking_site_url: string | null;
  [key: string]: unknown;
};

/**
 * Resolve which tenant the current request belongs to, server-side, from the
 * request Host — the single source of truth for a shared (one-deployment)
 * multi-tenant booking site. React-`cache()`d so metadata + layout + pages that
 * call it within one request share a single DB round-trip.
 *
 * Order: indexed subdomain lookup → custom-domain origin match → legacy
 * NEXT_PUBLIC_BUSINESS_ID (kept so existing per-tenant deployments still work
 * during/after the cutover). Each branch is a single indexed anon query whose
 * RLS is satisfied by the matching x-tenant-* header, so this never scans the
 * businesses table.
 */
export const getRequestTenant = cache(async (): Promise<RequestTenant | null> => {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const subdomain = tenantSubdomainFromHost(host);

  if (subdomain) {
    const scoped = createBusinessResolverSupabase({ subdomain });
    const { data } = await scoped.from("businesses").select(TENANT_COLS).eq("subdomain", subdomain).maybeSingle();
    if (data) return data as unknown as RequestTenant;
  }

  if (host) {
    const proto = h.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const scoped = createBusinessResolverSupabase({ origin });
    const { data } = await scoped
      .from("businesses")
      .select(TENANT_COLS)
      .in("booking_site_url", [origin, origin + "/"])
      .maybeSingle();
    if (data) return data as unknown as RequestTenant;
  }

  const envId = process.env.NEXT_PUBLIC_BUSINESS_ID || "";
  if (envId) {
    const scoped = createBusinessResolverSupabase({ businessId: envId });
    const { data } = await scoped.from("businesses").select(TENANT_COLS).eq("id", envId).maybeSingle();
    if (data) return data as unknown as RequestTenant;
  }

  return null;
});
