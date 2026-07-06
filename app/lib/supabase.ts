import { createClient } from '@supabase/supabase-js'
import { buildTenantHeaders, buildVoucherHeaders } from './tenant-headers'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in booking app environment.')
}
const resolvedSupabaseUrl = supabaseUrl
const resolvedSupabaseKey = supabaseKey

export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseKey)

export function createScopedSupabase(headers: Record<string, string>) {
  // Storefront reads are anon + tenant-header scoped (RLS `*_anon_select` policies
  // are granted to the `anon` role only). Never load the persisted auth session:
  // if a visitor has an `authenticated` session (e.g. from /my-bookings OTP login),
  // supabase-js would send their user JWT instead of the anon key, the anon policies
  // would no longer apply, and every public read (theme, tours, slots) would return
  // zero rows — leaving the site stuck on loading skeletons.
  return createClient(resolvedSupabaseUrl, resolvedSupabaseKey, {
    global: { headers },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function createTenantSupabase(businessId?: string | null) {
  return createScopedSupabase(buildTenantHeaders({ businessId }))
}

export function createBusinessResolverSupabase(input: {
  businessId?: string | null;
  subdomain?: string | null;
  origin?: string | null;
}) {
  return createScopedSupabase(buildTenantHeaders(input))
}

export function createVoucherSupabase(code: string, businessId?: string | null) {
  return createScopedSupabase(buildVoucherHeaders(code, businessId))
}
