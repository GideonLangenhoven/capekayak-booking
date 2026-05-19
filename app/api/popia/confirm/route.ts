import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// AK2: customer confirmation mirror of /admin /api/popia/confirm. Same
// writer logic + state-machine guards. Lives on the booking site so the
// confirmation link in the email can be served from the same origin the
// customer expects.

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
    console.error("POPIA_CONFIRM_ENV_MISSING url=" + !!supabaseUrl + " key=" + !!serviceKey);
    return NextResponse.json({ error: "Server is missing the required Supabase credentials." }, { status: 500 });
  }

  let body: { token?: string; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { token, id } = body;
  if (!token || !id) return NextResponse.json({ error: "token and id required" }, { status: 400 });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const db = adminClient();

  const { data: request } = await db.from("data_subject_requests")
    .select("id, status, confirmation_token_hash, confirmation_expires_at, request_type, business_id, email")
    .eq("id", id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.status !== "PENDING_CONFIRMATION") {
    return NextResponse.json({ error: "This request has already been confirmed or cancelled. No further action needed." }, { status: 400 });
  }
  if (request.confirmation_token_hash !== tokenHash) {
    return NextResponse.json({ error: "Invalid confirmation token" }, { status: 403 });
  }
  if (new Date(request.confirmation_expires_at) < new Date()) {
    await db.from("data_subject_requests").update({
      status: "CANCELLED",
      cancellation_reason: "Confirmation expired",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return NextResponse.json({ error: "This confirmation link has expired (24h limit). Please submit a new request." }, { status: 410 });
  }

  const confirmedAt = new Date().toISOString();
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.from("data_subject_requests").update({
    status: "CONFIRMED",
    confirmed_at: confirmedAt,
    scheduled_for: scheduledFor,
    confirmation_token_hash: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  await fetch(supabaseUrl + "/functions/v1/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + serviceKey },
    body: JSON.stringify({
      type: "POPIA_REQUEST_CONFIRMED",
      data: {
        business_id: request.business_id,
        email: request.email,
        request_type: request.request_type,
        scheduled_for: scheduledFor,
      },
    }),
  }).catch((e) => console.warn("POPIA_CONFIRMED_EMAIL_ERR:", e));

  return NextResponse.json({ ok: true, request_type: request.request_type, scheduled_for: scheduledFor });
  } catch (err: unknown) {
    console.error("POPIA_CONFIRM_HANDLER_ERR:", err);
    return NextResponse.json({ error: (err as Error)?.message || "Unhandled error" }, { status: 500 });
  }
}
