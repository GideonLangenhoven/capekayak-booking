import { headers } from "next/headers";
import { cache } from "react";
import { createBusinessResolverSupabase } from "./supabase";
import { tenantSubdomainFromHost } from "./tenant-headers";

// Columns needed for server-rendered metadata (title / OG) + handing the tenant
// id to the client. Kept small so the per-request resolution is cheap.
const TENANT_COLS = "id, business_name, business_tagline, logo_url, subdomain, booking_site_url";

export type RequestTenant = {
  id: string;
  business_name: string | null;
  business_tagline: string | null;
  logo_url: string | null;
  subdomain: string | null;
  booking_site_url: string | null;
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
    if (data) return data as RequestTenant;
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
    if (data) return data as RequestTenant;
  }

  const envId = process.env.NEXT_PUBLIC_BUSINESS_ID || "";
  if (envId) {
    const scoped = createBusinessResolverSupabase({ businessId: envId });
    const { data } = await scoped.from("businesses").select(TENANT_COLS).eq("id", envId).maybeSingle();
    if (data) return data as RequestTenant;
  }

  return null;
});
