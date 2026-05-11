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
  return createClient(resolvedSupabaseUrl, resolvedSupabaseKey, {
    global: { headers },
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
