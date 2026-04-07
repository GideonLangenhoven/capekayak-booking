import { fmtTime } from "../lib/format";
import type { Booking } from "../lib/types";

export const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  HELD: "bg-amber-50 text-amber-700 border border-amber-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  CANCELLED: "bg-red-50 text-red-700 border border-red-200",
  COMPLETED: "bg-blue-50 text-blue-700 border border-blue-200",
  EXPIRED: "bg-gray-50 text-gray-500 border border-gray-200",
};

export const STATUS_LABEL: Record<string, string> = {
  PAID: "Confirmed",
  CONFIRMED: "Confirmed",
  HELD: "Awaiting Payment",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

export type TimeTier = "FULL" | "LIMITED" | "LOCKED" | "PAST";

export function getHrsBefore(b: Booking): number {
  if (!b.slots?.start_time) return 999;
  return (new Date(b.slots.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function getTimeTier(b: Booking): TimeTier {
  var hrs = getHrsBefore(b);
  if (hrs < 0) return "PAST";
  if (hrs < 12) return "LOCKED";
  if (hrs < 24) return "LIMITED";
  return "FULL";
}

export function getCountdownText(startIso: string): string | null {
  var now = new Date();
  var start = new Date(startIso);
  var diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  var diffH = Math.floor(diffMs / (1000 * 60 * 60));
  var diffM = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffH >= 48) return null;
  var todayStr = now.toISOString().split("T")[0];
  var tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  var tomorrowStr = tomorrowDate.toISOString().split("T")[0];
  var startStr = start.toISOString().split("T")[0];
  if (startStr === todayStr) {
    if (diffH > 0) return "Trip starts in " + diffH + "h " + diffM + "m";
    return "Trip starts in " + diffM + "m";
  }
  if (startStr === tomorrowStr) {
    return "Trip starts tomorrow at " + fmtTime(startIso);
  }
  return "Trip starts in " + diffH + "h " + diffM + "m";
}
