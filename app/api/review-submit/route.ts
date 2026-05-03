import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function POST(req: NextRequest) {
  var supabase = getServiceClient();
  var body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  var { token, rating, comment, reviewerName } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  var { data: review } = await supabase
    .from("reviews")
    .select("id, submitted_at")
    .eq("submission_token", token)
    .eq("source", "NATIVE")
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (review.submitted_at) {
    return NextResponse.json({ error: "Already submitted" }, { status: 410 });
  }

  var { error } = await supabase
    .from("reviews")
    .update({
      rating,
      comment: typeof comment === "string" ? comment.slice(0, 2000) : null,
      reviewer_name: typeof reviewerName === "string" ? reviewerName.slice(0, 100) : null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id);

  if (error) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
