import { NextRequest, NextResponse } from "next/server";

// Serves the "Add to Apple Calendar" event as a real text/calendar response.
// A served .ics opens straight into the calendar app (iOS shows the native
// event preview) instead of the confusing bare-file save a data: URI causes.
// Times are UTC (Z) instants — calendar apps convert to the viewer's zone.

function icsTime(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z";
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n").slice(0, 500);
}

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const start = icsTime(q.get("start") || "");
  const end = icsTime(q.get("end") || "");
  if (!start || !end) return new NextResponse("Invalid event times", { status: 400 });
  const title = esc(q.get("title") || "Booking");
  const loc = esc(q.get("loc") || "");
  const ref = esc((q.get("ref") || "").slice(0, 12));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookingTours//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + (ref || start) + "@bookingtours.co.za",
    "DTSTAMP:" + icsTime(new Date().toISOString()),
    "DTSTART:" + start,
    "DTEND:" + end,
    "SUMMARY:" + title,
    ...(loc ? ["LOCATION:" + loc] : []),
    "DESCRIPTION:" + esc("Ref " + ref + ". Arrive 15 min early."),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="booking.ics"',
      "Cache-Control": "no-store",
    },
  });
}
