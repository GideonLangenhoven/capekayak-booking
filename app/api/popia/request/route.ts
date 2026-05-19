import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { enforceRateLimit } from "@/app/lib/rate-limit";

// AK1: customer-facing mirror of /admin /api/popia/request so the booking
// site can accept POPIA data-subject requests directly without cross-origin
// calls into the admin host. Same writer logic (and same target table) as
// the admin route — kept structurally identical so prod migrations apply
// to one schema.

// Env access mirrors /api/review-submit's pattern: tolerate either
// SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (Vercel envs aren't always
// `NEXT_PUBLIC_` prefixed) and never throw at module load on missing
// keys — surface the failure in the handler instead.
function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) {
    console.error("POPIA_REQUEST_ENV_MISSING url=" + !!supabaseUrl + " key=" + !!serviceKey);
    return NextResponse.json({ error: "Server is missing the required Supabase credentials." }, { status: 500 });
  }

  const rl = await enforceRateLimit({ req, endpoint: "popia/request", maxPerMinute: 10 });
  if (rl) return rl;

  let body: { email?: string; business_id?: string; type?: string; reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, business_id, type, reason } = body;
  if (!email || !business_id) return NextResponse.json({ error: "email and business_id required" }, { status: 400 });
  if (!type || !["DELETION", "ACCESS", "CORRECTION"].includes(type)) {
    return NextResponse.json({ error: "type must be DELETION, ACCESS, or CORRECTION" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const db = adminClient();

  // Rate limit: max 1 pending request per email per business per 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("data_subject_requests")
    .select("*", { count: "exact", head: true })
    .eq("business_id", business_id)
    .ilike("email", email)
    .in("status", ["PENDING_CONFIRMATION", "CONFIRMED", "IN_REVIEW"])
    .gte("created_at", sevenDaysAgo);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "You already have a pending request. Check your email for the confirmation link, or contact us to cancel it." }, { status: 429 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: request, error } = await db.from("data_subject_requests").insert({
    business_id,
    email,
    request_type: type,
    status: "PENDING_CONFIRMATION",
    reason: reason || null,
    confirmation_token_hash: tokenHash,
    confirmation_expires_at: expiresAt,
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The confirmation email points back at the booking-site host so the
  // customer never sees the admin domain.
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const confirmUrl = `${origin}/popia/confirm?token=${token}&id=${request.id}`;
  await fetch(supabaseUrl + "/functions/v1/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + serviceKey },
    body: JSON.stringify({
      type: "POPIA_CONFIRM_REQUEST",
      data: {
        business_id,
        email,
        customer_name: "Customer",
        request_type: type,
        confirm_url: confirmUrl,
        expires_at: expiresAt,
      },
    }),
  }).catch((e) => console.warn("POPIA_CONFIRM_EMAIL_ERR:", e));

  return NextResponse.json({ request_id: request.id, expires_at: expiresAt });
  } catch (err: unknown) {
    console.error("POPIA_REQUEST_HANDLER_ERR:", err);
    return NextResponse.json({ error: (err as Error)?.message || "Unhandled error" }, { status: 500 });
  }
}
