"use client";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BookingFlow } from "../book/page";
import BookingFlowSkeleton from "../components/skeletons/BookingFlowSkeleton";

function EmbedContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  const bg = params.get("bg") || "transparent";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(function (entries) {
      for (const e of entries) {
        const h = Math.ceil(e.contentRect.height);
        window.parent?.postMessage({ type: "bt:resize", height: h }, "*");
      }
    });
    observer.observe(el);
    return function () { observer.disconnect(); };
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "bt:theme" && typeof ev.data.bg === "string") {
        if (containerRef.current) containerRef.current.style.background = ev.data.bg;
      }
    }
    window.addEventListener("message", onMessage);
    return function () { window.removeEventListener("message", onMessage); };
  }, []);

  return (
    <div ref={containerRef} style={{ background: bg }}>
      <BookingFlow embed />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<BookingFlowSkeleton />}>
      <EmbedContent />
    </Suspense>
  );
}
