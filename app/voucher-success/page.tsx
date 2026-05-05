"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VoucherSuccessRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") || "";

  useEffect(() => {
    router.replace("/voucher-confirmed" + (code ? "?code=" + encodeURIComponent(code) : ""));
  }, [router, code]);

  return (
    <div className="app-loader min-h-screen">
      <div className="spinner" />
    </div>
  );
}

export default function VoucherSuccessPage() {
  return (
    <Suspense fallback={<div className="app-loader min-h-screen"><div className="spinner" /></div>}>
      <VoucherSuccessRedirect />
    </Suspense>
  );
}
