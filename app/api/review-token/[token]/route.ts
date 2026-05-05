import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const supabase = getServiceClient();
  const { token } = await params;
  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("id, business_id, tour_id, booking_id, rating, comment, reviewer_name, submitted_at, tours(name), businesses(business_name)")
    .eq("submission_token", token)
    .eq("source", "NATIVE")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (data.submitted_at) {
    return NextResponse.json({ error: "Already submitted", submitted: true }, { status: 410 });
  }

  return NextResponse.json({
    id: data.id,
    tourName: (data.tours as any)?.name || null,
    businessName: (data.businesses as any)?.business_name || null,
    reviewerName: data.reviewer_name,
  });
}
