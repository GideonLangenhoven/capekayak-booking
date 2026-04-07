/* Shared date/time/calendar formatting utilities */

const DEFAULT_TZ = "Africa/Johannesburg";

export function fmtDate(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", timeZone: tz,
  });
}

export function fmtTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit", timeZone: tz,
  });
}

export function fmtFull(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz,
  });
}

export function fmtDateTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: tz,
  });
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

export function dateKey(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

export function dateKeyInTz(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date(iso));
  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = parts.find(p => p.type === "month")?.value ?? "1";
  const d = parts.find(p => p.type === "day")?.value ?? "1";
  return `${y}-${Number(m) - 1}-${Number(d)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDaysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function getFirstDay(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

export function gCalFmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "00Z";
}
