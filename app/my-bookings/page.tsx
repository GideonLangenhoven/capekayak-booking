"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Card from "../components/ui/Card";

/* ───── Formatters ───── */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
}
function dateKey(iso: string) { return new Date(iso).toISOString().split("T")[0]; }

/* ───── Countdown helper (C9) ───── */
function getCountdownText(startIso: string): string | null {
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

/* ───── Status config ───── */
var STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  HELD: "bg-amber-50 text-amber-700 border border-amber-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  CANCELLED: "bg-red-50 text-red-700 border border-red-200",
  COMPLETED: "bg-blue-50 text-blue-700 border border-blue-200",
};
var STATUS_LABEL: Record<string, string> = {
  PAID: "Confirmed",
  CONFIRMED: "Confirmed",
  HELD: "Awaiting Payment",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

/* ───── Time tier helpers ───── */
type TimeTier = "FULL" | "LIMITED" | "LOCKED" | "PAST";
function getHrsBefore(b: any): number {
  if (!b.slots?.start_time) return 999;
  return (new Date(b.slots.start_time).getTime() - Date.now()) / (1000 * 60 * 60);
}
function getTimeTier(b: any): TimeTier {
  var hrs = getHrsBefore(b);
  if (hrs < 0) return "PAST";
  if (hrs < 12) return "LOCKED";
  if (hrs < 24) return "LIMITED";
  return "FULL";
}

/* ───── Phone normalization — strips + from dial code to match DB format ───── */
const DIAL_CODES = [
  { code: "+27",  flag: "\u{1F1FF}\u{1F1E6}", country: "South Africa" },
  { code: "+1",   flag: "\u{1F1FA}\u{1F1F8}", country: "United States" },
  { code: "+1",   flag: "\u{1F1E8}\u{1F1E6}", country: "Canada" },
  { code: "+44",  flag: "\u{1F1EC}\u{1F1E7}", country: "United Kingdom" },
  { code: "+61",  flag: "\u{1F1E6}\u{1F1FA}", country: "Australia" },
  { code: "+64",  flag: "\u{1F1F3}\u{1F1FF}", country: "New Zealand" },
  { code: "+49",  flag: "\u{1F1E9}\u{1F1EA}", country: "Germany" },
  { code: "+33",  flag: "\u{1F1EB}\u{1F1F7}", country: "France" },
  { code: "+31",  flag: "\u{1F1F3}\u{1F1F1}", country: "Netherlands" },
  { code: "+32",  flag: "\u{1F1E7}\u{1F1EA}", country: "Belgium" },
  { code: "+41",  flag: "\u{1F1E8}\u{1F1ED}", country: "Switzerland" },
  { code: "+43",  flag: "\u{1F1E6}\u{1F1F9}", country: "Austria" },
  { code: "+34",  flag: "\u{1F1EA}\u{1F1F8}", country: "Spain" },
  { code: "+39",  flag: "\u{1F1EE}\u{1F1F9}", country: "Italy" },
  { code: "+351", flag: "\u{1F1F5}\u{1F1F9}", country: "Portugal" },
  { code: "+46",  flag: "\u{1F1F8}\u{1F1EA}", country: "Sweden" },
  { code: "+47",  flag: "\u{1F1F3}\u{1F1F4}", country: "Norway" },
  { code: "+45",  flag: "\u{1F1E9}\u{1F1F0}", country: "Denmark" },
  { code: "+358", flag: "\u{1F1EB}\u{1F1EE}", country: "Finland" },
  { code: "+353", flag: "\u{1F1EE}\u{1F1EA}", country: "Ireland" },
  { code: "+48",  flag: "\u{1F1F5}\u{1F1F1}", country: "Poland" },
  { code: "+420", flag: "\u{1F1E8}\u{1F1FF}", country: "Czech Republic" },
  { code: "+36",  flag: "\u{1F1ED}\u{1F1FA}", country: "Hungary" },
  { code: "+40",  flag: "\u{1F1F7}\u{1F1F4}", country: "Romania" },
  { code: "+90",  flag: "\u{1F1F9}\u{1F1F7}", country: "Turkey" },
  { code: "+972", flag: "\u{1F1EE}\u{1F1F1}", country: "Israel" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", country: "UAE" },
  { code: "+254", flag: "\u{1F1F0}\u{1F1EA}", country: "Kenya" },
  { code: "+255", flag: "\u{1F1F9}\u{1F1FF}", country: "Tanzania" },
  { code: "+256", flag: "\u{1F1FA}\u{1F1EC}", country: "Uganda" },
  { code: "+260", flag: "\u{1F1FF}\u{1F1F2}", country: "Zambia" },
  { code: "+263", flag: "\u{1F1FF}\u{1F1FC}", country: "Zimbabwe" },
  { code: "+267", flag: "\u{1F1E7}\u{1F1FC}", country: "Botswana" },
  { code: "+264", flag: "\u{1F1F3}\u{1F1E6}", country: "Namibia" },
  { code: "+258", flag: "\u{1F1F2}\u{1F1FF}", country: "Mozambique" },
  { code: "+20",  flag: "\u{1F1EA}\u{1F1EC}", country: "Egypt" },
  { code: "+234", flag: "\u{1F1F3}\u{1F1EC}", country: "Nigeria" },
  { code: "+233", flag: "\u{1F1EC}\u{1F1ED}", country: "Ghana" },
  { code: "+91",  flag: "\u{1F1EE}\u{1F1F3}", country: "India" },
  { code: "+86",  flag: "\u{1F1E8}\u{1F1F3}", country: "China" },
  { code: "+81",  flag: "\u{1F1EF}\u{1F1F5}", country: "Japan" },
  { code: "+82",  flag: "\u{1F1F0}\u{1F1F7}", country: "South Korea" },
  { code: "+65",  flag: "\u{1F1F8}\u{1F1EC}", country: "Singapore" },
  { code: "+60",  flag: "\u{1F1F2}\u{1F1FE}", country: "Malaysia" },
  { code: "+66",  flag: "\u{1F1F9}\u{1F1ED}", country: "Thailand" },
  { code: "+55",  flag: "\u{1F1E7}\u{1F1F7}", country: "Brazil" },
  { code: "+54",  flag: "\u{1F1E6}\u{1F1F7}", country: "Argentina" },
  { code: "+52",  flag: "\u{1F1F2}\u{1F1FD}", country: "Mexico" },
];

function normalizePhone(dialCode: string, digits: string): string {
  var clean = digits.replace(/\D/g, "").replace(/^0+/, "");
  return dialCode.replace(/\D/g, "") + clean;
}

/* ═══════════════════════════════════════════════════════
   MINI CALENDAR
   ═══════════════════════════════════════════════════════ */
function MiniCalendar({ slots, onSelect }: { slots: any[]; onSelect: (slot: any) => void }) {
  var now = new Date();
  var [vMonth, setVMonth] = useState(now.getMonth());
  var [vYear, setVYear] = useState(now.getFullYear());
  var [selectedDate, setSelectedDate] = useState<string | null>(null);

  var slotsByDate: Record<string, any[]> = {};
  for (var s of slots) { var dk = dateKey(s.start_time); if (!slotsByDate[dk]) slotsByDate[dk] = []; slotsByDate[dk].push(s); }

  var firstDay = new Date(vYear, vMonth, 1).getDay();
  var daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  var monthName = new Date(vYear, vMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  var dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  var canPrev = vYear > now.getFullYear() || (vYear === now.getFullYear() && vMonth > now.getMonth());
  var maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  var canNext = new Date(vYear, vMonth + 1, 1) < maxDate;

  var cells: any[] = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = vYear + "-" + String(vMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cells.push({ day: d, date: ds, isPast: new Date(ds) < new Date(now.toISOString().split("T")[0]), hasSlots: !!slotsByDate[ds] });
  }

  return (
    <div>
      <div className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (vMonth === 0) { setVMonth(11); setVYear(vYear - 1); } else setVMonth(vMonth - 1); }} disabled={!canPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&lsaquo;</button>
          <span className="text-sm font-semibold text-[color:var(--text)]">{monthName}</span>
          <button onClick={() => { if (vMonth === 11) { setVMonth(0); setVYear(vYear + 1); } else setVMonth(vMonth + 1); }} disabled={!canNext}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)] transition-colors">&rsaquo;</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-[11px] font-medium text-[color:var(--textMuted)] py-1">{dn}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((c, i) => {
            if (!c) return <div key={"e" + i} />;
            if (c.isPast || !c.hasSlots) return <div key={c.date} className="text-center py-2 text-sm text-[color:var(--textMuted)]/30 rounded-lg">{c.day}</div>;
            var isSelected = selectedDate === c.date;
            return (
              <button key={c.date} onClick={() => setSelectedDate(c.date)}
                className={"text-center py-2 text-sm font-semibold rounded-lg transition-all relative " + (isSelected ? "bg-[color:var(--accent)] text-white shadow-sm" : "text-[color:var(--text)] hover:bg-[color:var(--accentSoft)]")}>
                {c.day}
                {!isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[color:var(--cta)]"></span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (slotsByDate[selectedDate] || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text)] px-1">{fmtFull((slotsByDate[selectedDate] || [])[0].start_time)}</p>
          {(slotsByDate[selectedDate] || []).map((sl: any) => {
            var avail = sl.capacity_total - sl.booked - (sl.held || 0);
            return (
              <button key={sl.id} onClick={() => onSelect(sl)}
                className="w-full text-left border border-[color:var(--border)] rounded-xl p-4 hover:border-[color:var(--accent)] hover:shadow-sm transition-all bg-[color:var(--surface)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--text)]">{sl.tours?.name}</p>
                    <p className="text-sm text-[color:var(--textMuted)] mt-0.5">{fmtTime(sl.start_time)} &middot; {avail} spots left &middot; R{sl.price_per_person_override ?? sl.tours?.base_price_per_person}/pp</p>
                  </div>
                  <svg className="w-5 h-5 text-[color:var(--textMuted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════════════════ */
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[color:var(--surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="sticky top-0 bg-[color:var(--surface)] z-10 flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <h3 className="font-semibold text-[color:var(--text)]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] text-[color:var(--textMuted)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TOAST BANNER
   ═══════════════════════════════════════════════════════ */
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  if (!message) return null;
  var bg = type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800";
  return (
    <div className={"mb-4 p-4 rounded-xl border text-sm " + bg + " flex items-start gap-3"}>
      <span className="shrink-0 mt-0.5">{type === "success" ? "\u2705" : "\u274C"}</span>
      <p className="flex-1 font-medium">{message}</p>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MyBookings() {
  var router = useRouter();

  // Login
  var [email, setEmail] = useState("");
  var [dialCode, setDialCode] = useState("+27");
  var [phoneDigits, setPhoneDigits] = useState("");
  var [loggedIn, setLoggedIn] = useState(false);
  var [bookings, setBookings] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [emailError, setEmailError] = useState("");
  var [phoneError, setPhoneError] = useState("");
  var [loginError, setLoginError] = useState("");

  // Feedback
  var [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  var [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reschedule
  var [rescheduling, setRescheduling] = useState<any>(null);
  var [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  var [loadingSlots, setLoadingSlots] = useState(false);
  var [rebookConfirmSlot, setRebookConfirmSlot] = useState<any>(null);
  var [excessAction, setExcessAction] = useState("VOUCHER");

  // Edit guests modal
  var [editGuestsBooking, setEditGuestsBooking] = useState<any>(null);
  var [guestQty, setGuestQty] = useState(1);
  var [guestExcessAction, setGuestExcessAction] = useState("VOUCHER");

  // Contact details modal
  var [contactBooking, setContactBooking] = useState<any>(null);
  var [contactName, setContactName] = useState("");
  var [contactEmail, setContactEmail] = useState("");
  var [contactPhone, setContactPhone] = useState("");

  // Special request modal
  var [requestBooking, setRequestBooking] = useState<any>(null);
  var [specialRequest, setSpecialRequest] = useState("");

  // Cancel modal
  var [cancelTarget, setCancelTarget] = useState<any>(null);

  // C9: Countdown timer tick
  var [countdownTick, setCountdownTick] = useState(0);

  // C11: Voucher balance checker
  var [voucherOpen, setVoucherOpen] = useState(false);
  var [voucherCode, setVoucherCode] = useState("");
  var [voucherResult, setVoucherResult] = useState<any>(null);
  var [voucherLoading, setVoucherLoading] = useState(false);
  var [voucherError, setVoucherError] = useState("");

  // C4: Trip photos
  var [tripPhotos, setTripPhotos] = useState<Record<string, string[]>>({});

  // C7: Booking logs / timeline
  var [bookingLogs, setBookingLogs] = useState<Record<string, any[]>>({});
  var [expandedTimeline, setExpandedTimeline] = useState<Record<string, boolean>>({});

  // C10: Meeting point / what to bring
  var [expandedWhatToBring, setExpandedWhatToBring] = useState<Record<string, boolean>>({});

  // C14: Payment polling
  var [paymentPending, setPaymentPending] = useState<string | null>(null);
  var paymentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ───── C9: Countdown interval ───── */
  useEffect(() => {
    if (!loggedIn || bookings.length === 0) return;
    var interval = setInterval(() => setCountdownTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [loggedIn, bookings.length]);

  /* ───── C14: Payment polling cleanup ───── */
  useEffect(() => {
    return () => {
      if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    };
  }, []);

  /* ───── Toast helper ───── */
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    if (type === "success") setTimeout(() => setToast(null), 8000);
  }

  /* ───── Edge function caller — robust error handling ───── */
  async function callRebook(body: any): Promise<any> {
    var resp = await supabase.functions.invoke("rebook-booking", { body });
    if (resp.error) {
      var msg = "Something went wrong. Please try again.";
      try {
        if (resp.error && typeof (resp.error as any).context === "object") {
          var ctx = (resp.error as any).context;
          if (ctx && typeof ctx.json === "function") {
            var body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } else if (resp.data && typeof resp.data === "object" && resp.data.error) {
          msg = resp.data.error;
        } else if (resp.error.message && resp.error.message !== "non-2xx status code") {
          msg = resp.error.message;
        }
      } catch (_) {}
      throw new Error(msg);
    }
    if (resp.data?.error) throw new Error(resp.data.error);
    return resp.data;
  }

  /* ───── Lookup bookings (C2: waiver fields, C10: tour fields) ───── */
  var lookupBookings = useCallback(async function () {
    if (!email.trim() || !phoneDigits.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email"); return; }
    var cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 6 || cleanDigits.length > 12) { setPhoneError("Please enter a valid phone number"); return; }
    setEmailError(""); setPhoneError(""); setLoginError("");
    setLoading(true);
    var norm = normalizePhone(dialCode, phoneDigits);
    // Match on email first, then verify phone by comparing last 9 digits
    // to handle normalization differences (e.g. 27 vs 027 vs +27 prefix variants)
    var phoneTail = norm.replace(/\D/g, "").slice(-9);
    var { data } = await supabase.from("bookings")
      .select("id, business_id, customer_name, email, phone, qty, total_amount, status, refund_status, refund_amount, created_at, unit_price, tour_id, slot_id, custom_fields, converted_to_voucher_id, cancelled_at, cancellation_reason, payment_method, waiver_status, waiver_token, slots(start_time, capacity_total, booked, held), tours(name)")
      .eq("email", email.toLowerCase()).order("created_at", { ascending: false });
    // Filter by phone: match if last 9 digits are the same
    var matched = (data || []).filter(function (b: any) {
      var bTail = (b.phone || "").replace(/\D/g, "").slice(-9);
      return bTail === phoneTail;
    });
    if (matched.length === 0) {
      setLoginError("No bookings found for this email and phone combination.");
      setLoading(false);
      return;
    }
    data = matched;
    setBookings(data);
    setLoggedIn(true);
    setLoading(false);

    // C4: Fetch trip photos for completed bookings
    var completedSlotIds = data
      .filter((b: any) => b.status === "COMPLETED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"))
      .map((b: any) => b.slot_id)
      .filter(Boolean);
    if (completedSlotIds.length > 0) {
      var { data: photos } = await supabase.from("trip_photos")
        .select("id, photo_urls, slot_id")
        .in("slot_id", completedSlotIds);
      if (photos && photos.length > 0) {
        var photoMap: Record<string, string[]> = {};
        for (var p of photos) {
          if (p.slot_id && p.photo_urls) {
            if (!photoMap[p.slot_id]) photoMap[p.slot_id] = [];
            photoMap[p.slot_id] = photoMap[p.slot_id].concat(Array.isArray(p.photo_urls) ? p.photo_urls : [p.photo_urls]);
          }
        }
        setTripPhotos(photoMap);
      }
    }

    // C7: Fetch booking logs
    var bookingIds = data.map((b: any) => b.id);
    if (bookingIds.length > 0) {
      var { data: logs } = await supabase.from("logs")
        .select("id, booking_id, action, created_at, details")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: true });
      if (logs && logs.length > 0) {
        var logMap: Record<string, any[]> = {};
        for (var l of logs) {
          if (!logMap[l.booking_id]) logMap[l.booking_id] = [];
          logMap[l.booking_id].push(l);
        }
        setBookingLogs(logMap);
      }
    }
  }, [email, phoneDigits, dialCode]);

  /* ───── C11: Voucher balance check ───── */
  async function checkVoucherBalance() {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError("");
    setVoucherResult(null);
    var { data, error } = await supabase.from("vouchers")
      .select("code, status, current_balance, expires_at")
      .eq("code", voucherCode.trim().toUpperCase())
      .maybeSingle();
    if (error || !data) {
      setVoucherError("Voucher not found. Please check the code and try again.");
    } else {
      setVoucherResult(data);
    }
    setVoucherLoading(false);
  }

  /* ───── C14: Start payment polling ───── */
  function startPaymentPolling(bookingId: string) {
    setPaymentPending(bookingId);
    var attempts = 0;
    if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    paymentPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 12) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        return;
      }
      var { data } = await supabase.from("bookings")
        .select("status")
        .eq("id", bookingId)
        .maybeSingle();
      if (data && ["PAID", "CONFIRMED"].includes(data.status)) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        showToast("Payment confirmed! Your booking is updated.");
        lookupBookings();
      }
    }, 10000);
  }

  /* ───── Admin review (locked bookings) ───── */
  async function requestAdminReview(b: any, action: string) {
    if (!confirm("Your trip is within 12 hours. Send a request to our team?")) return;
    setActionLoading(b.id);
    var hrs = getHrsBefore(b);
    await supabase.from("chat_messages").insert({
      business_id: b.business_id,
      phone: b.phone,
      direction: "IN",
      body: "[URGENT] Request to " + action.toUpperCase() + " booking " + b.id.substring(0, 8).toUpperCase() + " (Trip in " + Math.round(hrs) + "h). Customer: " + b.customer_name,
      sender: b.customer_name,
    });
    showToast("Request sent! Our team will get back to you shortly.");
    setActionLoading(null);
  }

  /* ───── Reschedule ───── */
  async function startReschedule(b: any) {
    setRescheduling(b);
    setLoadingSlots(true);
    var now = new Date();
    var cutoff = new Date(Date.now() + 60 * 60 * 1000);
    var later = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    var { data } = await supabase.from("slots").select("*, tours(name, base_price_per_person)")
      .eq("status", "OPEN").eq("business_id", b.business_id)
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString())
      .order("start_time", { ascending: true });
    setRescheduleSlots((data || []).filter((s: any) => s.capacity_total - s.booked - (s.held || 0) >= b.qty && s.id !== b.slot_id));
    setLoadingSlots(false);
  }

  async function submitReschedule() {
    if (!rescheduling || !rebookConfirmSlot) return;
    setActionLoading("reschedule");
    try {
      var result = await callRebook({
        booking_id: rescheduling.id,
        action: "RESCHEDULE",
        new_slot_id: rebookConfirmSlot.id,
        excess_action: excessAction,
      });
      if (result.diff > 0 && result.payment_url) {
        showToast("Rescheduled! Pay the R" + result.diff + " difference to confirm.");
        window.open(result.payment_url, "_blank");
        startPaymentPolling(rescheduling.id);
      } else if (result.voucher_code) {
        showToast("Rescheduled! Voucher " + result.voucher_code + " for R" + result.voucher_amount + " sent to you.");
      } else {
        showToast("Booking rescheduled successfully!");
      }
      setRescheduling(null); setRebookConfirmSlot(null); setRescheduleSlots([]);
      lookupBookings();
    } catch (err: any) {
      showToast(err.message, "error");
    }
    setActionLoading(null);
  }

  /* ───── Edit guests ───── */
  function openEditGuests(b: any) {
    setEditGuestsBooking(b);
    setGuestQty(b.qty);
    setGuestExcessAction("VOUCHER");
  }

  async function submitEditGuests() {
    if (!editGuestsBooking || guestQty === editGuestsBooking.qty) { setEditGuestsBooking(null); return; }
    var b = editGuestsBooking;
    setActionLoading("guests");
    try {
      if (guestQty > b.qty) {
        var result = await callRebook({ booking_id: b.id, action: "ADD_GUESTS", new_qty: guestQty });
        if (result.payment_url) {
          showToast((guestQty - b.qty) + " guest(s) added! Pay R" + result.diff + " to confirm.");
          window.open(result.payment_url, "_blank");
          startPaymentPolling(b.id);
        } else {
          showToast("Guests added!");
        }
      } else {
        var result = await callRebook({ booking_id: b.id, action: "REMOVE_GUESTS", new_qty: guestQty, excess_action: guestExcessAction });
        if (result.voucher_code) {
          showToast("Guests removed. Voucher " + result.voucher_code + " for R" + result.voucher_amount + " sent to you.");
        } else if (result.refund_amount) {
          showToast("Guests removed. Refund of R" + result.refund_amount.toFixed(2) + " requested.");
        } else {
          showToast("Guests updated!");
        }
      }
      setEditGuestsBooking(null);
      lookupBookings();
    } catch (err: any) { showToast(err.message, "error"); }
    setActionLoading(null);
  }

  /* ───── Contact details ───── */
  function openContactDetails(b: any) {
    setContactBooking(b); setContactName(b.customer_name || ""); setContactEmail(b.email || ""); setContactPhone(b.phone || "");
  }
  async function submitContactDetails() {
    if (!contactBooking) return;
    setActionLoading("contact");
    try {
      await callRebook({ booking_id: contactBooking.id, action: "UPDATE_CONTACT", contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone });
      showToast("Contact details updated!");
      setContactBooking(null);
      lookupBookings();
    } catch (err: any) { showToast(err.message, "error"); }
    setActionLoading(null);
  }

  /* ───── Special request ───── */
  function openSpecialRequest(b: any) {
    setRequestBooking(b); setSpecialRequest((b.custom_fields?.special_requests) || "");
  }
  async function submitSpecialRequest() {
    if (!requestBooking || !specialRequest.trim()) return;
    setActionLoading("request");
    try {
      await callRebook({ booking_id: requestBooking.id, action: "SPECIAL_REQUEST", special_requests: specialRequest });
      showToast("Special request saved!");
      setRequestBooking(null);
      lookupBookings();
    } catch (err: any) { showToast(err.message, "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with refund ───── */
  async function submitCancelRefund() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      var result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_REFUND" });
      if (result.voucher_code) {
        showToast("Your booking has been cancelled. A voucher of R" + result.voucher_amount + " has been issued. Code: " + result.voucher_code);
      } else if (result.manual_refund || result.refund_type === "MANUAL_EFT_REQUIRED") {
        showToast("Your booking has been cancelled. A manual refund will be processed by the team.");
      } else if (result.refund_amount != null) {
        showToast("Cancelled. Refund of R" + Number(result.refund_amount).toFixed(2) + " requested (5-7 business days).");
      } else {
        showToast("Your booking has been cancelled.");
      }
      setCancelTarget(null);
      lookupBookings();
    } catch (err: any) { showToast(err.message, "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with voucher ───── */
  async function submitCancelVoucher() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      var result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_VOUCHER" });
      showToast("Converted to voucher! Code: " + result.voucher_code + " (R" + result.voucher_amount + ")");
      setCancelTarget(null);
      lookupBookings();
    } catch (err: any) { showToast(err.message, "error"); }
    setActionLoading(null);
  }

  /* ═══════════════════════════════════════════════════════
     RESCHEDULE CONFIRM SCREEN
     ═══════════════════════════════════════════════════════ */
  if (rescheduling && rebookConfirmSlot) {
    var unitPrice = rebookConfirmSlot.price_per_person_override ?? rebookConfirmSlot.tours.base_price_per_person;
    var newTotal = unitPrice * rescheduling.qty;
    var diff = newTotal - Number(rescheduling.total_amount);

    return (
      <div className="app-container max-w-lg page-wrap py-8">
        <button onClick={() => setRebookConfirmSlot(null)} className="flex items-center gap-1 text-sm text-[color:var(--textMuted)] hover:text-[color:var(--text)] mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to dates
        </button>
        <h2 className="text-xl font-bold text-[color:var(--text)] mb-5">Confirm Reschedule</h2>

        <div className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] p-5 mb-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Tour</p><p className="font-medium text-[color:var(--text)]">{rebookConfirmSlot.tours.name}</p></div>
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Guests</p><p className="font-medium text-[color:var(--text)]">{rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"}</p></div>
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Date</p><p className="font-medium text-[color:var(--text)]">{fmtFull(rebookConfirmSlot.start_time)}</p></div>
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Time</p><p className="font-medium text-[color:var(--text)]">{fmtTime(rebookConfirmSlot.start_time)}</p></div>
          </div>
          <div className="mt-4 pt-4 border-t border-[color:var(--border)] flex justify-between items-center">
            <span className="text-sm text-[color:var(--textMuted)]">Originally paid</span><span className="text-sm">R{rescheduling.total_amount}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-semibold text-[color:var(--text)]">New total</span><span className="text-sm font-bold text-[color:var(--text)]">R{newTotal}</span>
          </div>
        </div>

        {diff > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">Additional payment of R{diff} required</p>
            <p className="text-xs">A secure payment link will be sent to your email and WhatsApp.</p>
          </div>
        )}

        {diff < 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-semibold text-[color:var(--text)]">R{Math.abs(diff)} credit — how would you like it?</p>
            <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)]">
              <input type="radio" value="VOUCHER" checked={excessAction === "VOUCHER"} onChange={() => setExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
              <div className="text-sm"><span className="font-semibold">Gift Voucher</span> <span className="text-[color:var(--textMuted)]">&middot; R{Math.abs(diff)} (full amount)</span></div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)]">
              <input type="radio" value="REFUND" checked={excessAction === "REFUND"} onChange={() => setExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
              <div className="text-sm"><span className="font-semibold">Refund</span> <span className="text-[color:var(--textMuted)]">&middot; R{(Math.abs(diff) * 0.95).toFixed(2)} (less 5% fee)</span></div>
            </label>
          </div>
        )}

        <Button onClick={submitReschedule} disabled={actionLoading === "reschedule"} fullWidth className="py-3.5 font-semibold">
          {actionLoading === "reschedule" ? "Processing..." : diff > 0 ? "Confirm & Pay R" + diff : "Confirm Reschedule"}
        </Button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     RESCHEDULE CALENDAR SCREEN
     ═══════════════════════════════════════════════════════ */
  if (rescheduling) {
    return (
      <div className="app-container max-w-lg page-wrap py-8">
        <button onClick={() => { setRescheduling(null); setRescheduleSlots([]); }} className="flex items-center gap-1 text-sm text-[color:var(--textMuted)] hover:text-[color:var(--text)] mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to bookings
        </button>
        <h2 className="text-xl font-bold text-[color:var(--text)] mb-1">Choose a New Date</h2>
        <p className="text-sm text-[color:var(--textMuted)] mb-6">{rescheduling.tours?.name} &middot; {rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"}</p>
        {loadingSlots ? (
          <div className="flex justify-center py-16"><div className="spinner" /></div>
        ) : rescheduleSlots.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[color:var(--textMuted)]">No available dates found.</p>
            <p className="text-sm text-[color:var(--textMuted)] mt-1">Please contact us for assistance.</p>
          </div>
        ) : (
          <MiniCalendar slots={rescheduleSlots} onSelect={(sl) => { setRebookConfirmSlot(sl); setExcessAction("VOUCHER"); }} />
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════════════════ */
  if (!loggedIn) {
    return (
      <div className="app-container max-w-sm py-16 px-4">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)]">
            <svg className="w-7 h-7 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <h2 className="text-xl font-bold text-[color:var(--text)]">My Bookings</h2>
          <p className="mt-2 text-sm text-[color:var(--textMuted)]">Enter the details you used when booking.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1.5">Email</label>
            <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); setLoginError(""); }}
              onKeyDown={(e) => e.key === "Enter" && lookupBookings()} placeholder="your@email.com" className="py-3" />
            {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1.5">Phone</label>
            <div className="flex gap-2">
              <select value={dialCode} onChange={(e) => setDialCode(e.target.value)}
                className="shrink-0 border-2 border-[color:var(--border)] rounded-xl px-2 py-3 text-sm bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)] cursor-pointer"
                style={{ minWidth: "100px" }}>
                {DIAL_CODES.map((d, i) => <option key={d.country + i} value={d.code}>{d.flag} {d.code}</option>)}
              </select>
              <Input type="tel" value={phoneDigits}
                onChange={(e) => { setPhoneDigits(e.target.value); setPhoneError(""); setLoginError(""); }}
                onKeyDown={(e) => e.key === "Enter" && lookupBookings()}
                placeholder="81 234 5678" className="flex-1 py-3" />
            </div>
            {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
          </div>
        </div>

        {loginError && <p className="mt-3 text-sm text-red-600 text-center">{loginError}</p>}

        <Button onClick={lookupBookings} disabled={loading || !email.trim() || !phoneDigits.trim()} fullWidth className="mt-5 py-3.5">
          {loading ? "Looking up..." : "Find My Bookings"}
        </Button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     BOOKINGS LIST
     ═══════════════════════════════════════════════════════ */
  var upcoming = bookings.filter(b => ["PAID", "CONFIRMED", "HELD", "PENDING"].includes(b.status) && getTimeTier(b) !== "PAST");
  var past = bookings.filter(b => b.status === "COMPLETED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"));
  var cancelled = bookings.filter(b => b.status === "CANCELLED");

  function renderBookingCard(b: any) {
    var tier = getTimeTier(b);
    var isPast = tier === "PAST";
    var isActive = ["PAID", "CONFIRMED"].includes(b.status);
    var isCancelled = b.status === "CANCELLED";
    var isCompleted = b.status === "COMPLETED" || (isActive && isPast);

    // C9: countdown
    var countdown = b.slots?.start_time && !isPast ? getCountdownText(b.slots.start_time) : null;
    void countdownTick;

    // C2: waiver
    var waiverSigned = b.waiver_status === "SIGNED" || b.waiver_status === "signed";
    var waiverPending = !waiverSigned && !isPast && !isCancelled && isActive;
    var isUrgentWaiver = waiverPending && b.slots?.start_time && getHrsBefore(b) < 24;

    // C10: meeting point
    var meetingPoint = b.tours?.meeting_point;
    var whatToBring = b.tours?.what_to_bring;
    var mapsUrl = meetingPoint ? "https://www.google.com/maps/search/" + encodeURIComponent(meetingPoint) : null;

    // C4: trip photos
    var photos = b.slot_id ? tripPhotos[b.slot_id] : null;

    // C7: timeline logs
    var logs = bookingLogs[b.id] || [];

    return (
      <div key={b.id} className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] overflow-hidden hover:shadow-md transition-shadow">
        {/* C9: Countdown banner */}
        {countdown && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {countdown}
            </div>
          </div>
        )}

        {/* C14: Payment pending indicator */}
        {paymentPending === b.id && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <div className="spinner" style={{ width: 14, height: 14 }} />
              Payment pending... checking status
            </div>
          </div>
        )}

        {/* Booking header */}
        <div className="p-5 pb-0">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[color:var(--text)] truncate">{b.tours?.name || "Booking"}</h3>
              {b.slots?.start_time && (
                <p className="text-sm text-[color:var(--textMuted)] mt-0.5">
                  {fmtDate(b.slots.start_time)} &middot; {fmtTime(b.slots.start_time)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              {/* C2: Waiver badge */}
              {isActive && !isPast && waiverSigned && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Waiver Signed &#10003;</span>
              )}
              {waiverPending && (
                <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full border " + (isUrgentWaiver ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse" : "bg-amber-50 text-amber-700 border-amber-200")}>Waiver Pending</span>
              )}
              <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (STATUS_STYLE[b.status] || "bg-gray-100 text-gray-600")}>{STATUS_LABEL[b.status] || b.status}</span>
            </div>
          </div>

          {/* C2: Sign waiver link */}
          {waiverPending && b.waiver_token && (
            <div className={"flex items-center gap-2 pb-3 " + (isUrgentWaiver ? "p-2 -mx-2 rounded-lg bg-amber-50 border border-amber-200 mb-2" : "")}>
              <Link href={"/waiver?booking=" + b.id + "&token=" + b.waiver_token}
                className={"text-xs font-semibold underline " + (isUrgentWaiver ? "text-amber-800" : "text-amber-600 hover:text-amber-800")}>
                {isUrgentWaiver ? "Sign Waiver Now (required before trip)" : "Sign Waiver"}
              </Link>
            </div>
          )}

          {/* Details */}
          <div className="flex items-center gap-3 text-sm text-[color:var(--textMuted)] pb-4">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {b.qty}
            </span>
            <span className="font-medium text-[color:var(--text)]">R{b.total_amount}</span>
            <span className="font-mono text-xs opacity-60">{b.id.substring(0, 8).toUpperCase()}</span>
          </div>

          {/* C10: Meeting point */}
          {meetingPoint && !isCancelled && (
            <div className="flex items-start gap-2 pb-3 text-xs text-[color:var(--textMuted)]">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <div>
                <span className="font-medium text-[color:var(--text)]">Meeting point: </span>
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{meetingPoint}</a>
                ) : (
                  <span>{meetingPoint}</span>
                )}
              </div>
            </div>
          )}

          {/* C10: What to bring (collapsible) */}
          {whatToBring && !isCancelled && (
            <div className="pb-3">
              <button onClick={() => setExpandedWhatToBring(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors">
                <svg className={"w-3 h-3 transition-transform " + (expandedWhatToBring[b.id] ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                What to bring
              </button>
              {expandedWhatToBring[b.id] && (
                <div className="mt-1.5 ml-5 text-xs text-[color:var(--textMuted)] bg-[color:var(--surface2)] rounded-lg p-3 whitespace-pre-line">
                  {whatToBring}
                </div>
              )}
            </div>
          )}

          {/* Special request note */}
          {b.custom_fields?.special_requests && (
            <div className="flex items-start gap-2 pb-3 text-xs text-[color:var(--textMuted)]">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              <span className="italic">{b.custom_fields.special_requests.substring(0, 80)}{b.custom_fields.special_requests.length > 80 ? "..." : ""}</span>
            </div>
          )}

          {/* Status indicators */}
          {b.refund_status === "REQUESTED" && (
            <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-amber-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Refund of R{b.refund_amount || b.total_amount} pending
            </div>
          )}
          {isCancelled && b.converted_to_voucher_id && (
            <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-blue-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
              Converted to voucher — check your email
            </div>
          )}

          {/* Time tier warning */}
          {isActive && !isPast && tier === "LIMITED" && (
            <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-amber-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              Some changes limited (trip within 24 hours)
            </div>
          )}
          {isActive && !isPast && tier === "LOCKED" && (
            <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-red-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Changes require team review (trip within 12 hours)
            </div>
          )}

          {/* C4: Trip photos for completed bookings */}
          {isCompleted && photos && photos.length > 0 && (
            <div className="pb-3">
              <a href={photos[0]} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                View Trip Photos ({photos.length} {photos.length === 1 ? "photo" : "photos"})
              </a>
            </div>
          )}

          {/* C7: Activity timeline (collapsible) */}
          {logs.length > 0 && (
            <div className="pb-3">
              <button onClick={() => setExpandedTimeline(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors">
                <svg className={"w-3 h-3 transition-transform " + (expandedTimeline[b.id] ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Activity ({logs.length})
              </button>
              {expandedTimeline[b.id] && (
                <div className="mt-2 ml-1 border-l-2 border-[color:var(--border)] pl-3 space-y-2">
                  {logs.map((log: any) => (
                    <div key={log.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] -ml-[calc(0.75rem+1px)]"></div>
                        <span className="font-medium text-[color:var(--text)]">
                          {(log.action || "Event").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </span>
                      </div>
                      <p className="text-[color:var(--textMuted)] ml-0 mt-0.5">
                        {new Date(log.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" })} at {fmtTime(log.created_at)}
                        {log.details && typeof log.details === "string" && <span className="ml-1">— {log.details.substring(0, 60)}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions bar */}
        <div className="px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--bg)]/50">
          <div className="flex flex-wrap gap-2">
            {/* ─── FULL ACCESS (>24h) ─── */}
            {isActive && tier === "FULL" && (
              <>
                <ActionBtn label="Reschedule" onClick={() => startReschedule(b)} />
                <ActionBtn label="Edit Guests" onClick={() => openEditGuests(b)} />
                <ActionBtn label="Details" onClick={() => openContactDetails(b)} />
                <ActionBtn label="Request" onClick={() => openSpecialRequest(b)} />
                <ActionBtn label="Cancel" onClick={() => setCancelTarget(b)} variant="danger" />
              </>
            )}

            {/* ─── LIMITED (12-24h) ─── */}
            {isActive && tier === "LIMITED" && (
              <>
                <ActionBtn label="Edit Guests" onClick={() => openEditGuests(b)} />
                <ActionBtn label="Details" onClick={() => openContactDetails(b)} />
                <ActionBtn label="Request" onClick={() => openSpecialRequest(b)} />
                <ActionBtn label="Request Change" onClick={() => requestAdminReview(b, "change")} disabled={actionLoading === b.id} variant="muted" />
              </>
            )}

            {/* ─── LOCKED (<12h) ─── */}
            {isActive && tier === "LOCKED" && (
              <>
                <ActionBtn label="Special Request" onClick={() => openSpecialRequest(b)} />
                <ActionBtn label="Contact Team" onClick={() => requestAdminReview(b, "change")} disabled={actionLoading === b.id} variant="muted" />
              </>
            )}

            {/* ─── PAST TRIP (C13: navigate to /book) ─── */}
            {isCompleted && (
              <>
                <ActionBtn label="Book Again" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" />
                <Link href="/" className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--surface2)] transition-colors text-[color:var(--textMuted)]">Browse Tours</Link>
              </>
            )}

            {/* ─── CANCELLED (C13: navigate to /book) ─── */}
            {isCancelled && !b.converted_to_voucher_id && (b.refund_status === "NONE" || !b.refund_status) && (
              <>
                <ActionBtn label="Rebook Trip" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" />
              </>
            )}

            {/* ─── HELD / PENDING ─── */}
            {(b.status === "HELD" || b.status === "PENDING") && (
              <p className="text-xs text-[color:var(--textMuted)] py-1">Check your email for the payment link.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container max-w-xl page-wrap py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[color:var(--text)]">My Bookings</h2>
          <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{email}</p>
        </div>
        <button onClick={() => { setLoggedIn(false); setBookings([]); setEmail(""); setDialCode("+27"); setPhoneDigits(""); setLoginError(""); setToast(null); }}
          className="text-xs text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[color:var(--surface2)]">
          Log out
        </button>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* C11: Voucher Balance Checker */}
      <div className="mb-5">
        <button onClick={() => { setVoucherOpen(!voucherOpen); setVoucherResult(null); setVoucherError(""); }}
          className="flex items-center gap-2 text-xs font-medium text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors">
          <svg className={"w-3 h-3 transition-transform " + (voucherOpen ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
          Check Voucher Balance
        </button>
        {voucherOpen && (
          <div className="mt-2 bg-[color:var(--surface)] rounded-xl border border-[color:var(--border)] p-4">
            <div className="flex gap-2">
              <Input value={voucherCode} onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); }}
                onKeyDown={e => e.key === "Enter" && checkVoucherBalance()}
                placeholder="Enter voucher code" className="flex-1 py-2 text-sm font-mono" />
              <button onClick={checkVoucherBalance} disabled={voucherLoading || !voucherCode.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[color:var(--accent)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
                {voucherLoading ? "..." : "Check"}
              </button>
            </div>
            {voucherError && <p className="mt-2 text-xs text-red-600">{voucherError}</p>}
            {voucherResult && (
              <div className="mt-3 bg-[color:var(--surface2)] rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[color:var(--textMuted)]">Status</span>
                  <span className={"font-semibold " + (voucherResult.status === "ACTIVE" ? "text-emerald-600" : "text-red-600")}>
                    {voucherResult.status}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[color:var(--textMuted)]">Balance</span>
                  <span className="font-bold text-[color:var(--text)]">R{voucherResult.current_balance}</span>
                </div>
                {voucherResult.expires_at && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[color:var(--textMuted)]">Expires</span>
                    <span className="text-[color:var(--text)]">{fmtDate(voucherResult.expires_at)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[color:var(--textMuted)] mb-4">No bookings found.</p>
          <Link href="/" className="btn btn-primary">Browse Tours</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Upcoming</h3>
              <div className="space-y-3">{upcoming.map(renderBookingCard)}</div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Past Trips</h3>
              <div className="space-y-3">{past.map(renderBookingCard)}</div>
            </section>
          )}

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Cancelled</h3>
              <div className="space-y-3">{cancelled.map(renderBookingCard)}</div>
            </section>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         EDIT GUESTS MODAL
         ═══════════════════════════════════════════════════════ */}
      <Modal open={!!editGuestsBooking} onClose={() => setEditGuestsBooking(null)} title="Edit Guests">
        {editGuestsBooking && (() => {
          var b = editGuestsBooking;
          var tier = getTimeTier(b);
          var unitPrice = Number(b.unit_price || 0);
          var guestDiff = guestQty - b.qty;
          var canRemove = tier === "FULL";

          return (
            <div>
              <p className="text-sm text-[color:var(--textMuted)] mb-5">{b.tours?.name} &middot; R{unitPrice}/pp</p>

              {/* Stepper */}
              <div className="flex items-center justify-center gap-8 mb-6">
                <button onClick={() => setGuestQty(Math.max(canRemove ? 1 : b.qty, guestQty - 1))}
                  disabled={guestQty <= (canRemove ? 1 : b.qty)}
                  title={!canRemove ? "Cannot remove guests within 24 hours of trip" : undefined}
                  className="w-11 h-11 rounded-full border-2 border-[color:var(--border)] flex items-center justify-center text-xl font-bold hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none">
                  &minus;
                </button>
                <div className="text-center min-w-[60px]">
                  <span className="text-3xl font-bold text-[color:var(--text)] tabular-nums">{guestQty}</span>
                  <p className="text-[10px] text-[color:var(--textMuted)] uppercase tracking-wider mt-0.5">{guestQty === 1 ? "guest" : "guests"}</p>
                </div>
                <button onClick={() => setGuestQty(guestQty + 1)}
                  className="w-11 h-11 rounded-full border-2 border-[color:var(--border)] flex items-center justify-center text-xl font-bold hover:border-[color:var(--accent)] transition-colors select-none">
                  +
                </button>
              </div>

              {/* Price change summary */}
              {guestDiff !== 0 && (
                <div className="bg-[color:var(--surface2)] rounded-xl p-3 mb-5 text-sm">
                  <div className="flex justify-between"><span className="text-[color:var(--textMuted)]">Current ({b.qty})</span><span>R{b.total_amount}</span></div>
                  <div className="flex justify-between font-semibold mt-1"><span>New ({guestQty})</span><span>R{guestQty * unitPrice}</span></div>
                  {guestDiff > 0 && <p className="text-xs text-amber-600 mt-2">Payment link for R{guestDiff * unitPrice} will be sent.</p>}
                </div>
              )}

              {/* Remove guests: refund/voucher choice */}
              {guestDiff < 0 && (
                <div className="mb-5 space-y-2">
                  <p className="text-sm font-medium text-[color:var(--text)]">R{Math.abs(guestDiff) * unitPrice} credit:</p>
                  <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
                    <input type="radio" value="VOUCHER" checked={guestExcessAction === "VOUCHER"} onChange={() => setGuestExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
                    <span><strong>Voucher</strong> &middot; R{Math.abs(guestDiff) * unitPrice}</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
                    <input type="radio" value="REFUND" checked={guestExcessAction === "REFUND"} onChange={() => setGuestExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
                    <span><strong>Refund</strong> &middot; R{(Math.abs(guestDiff) * unitPrice * 0.95).toFixed(2)} (less 5%)</span>
                  </label>
                </div>
              )}

              {!canRemove && guestQty <= b.qty && <p className="text-xs text-amber-600 mb-4">Cannot remove guests within 24 hours of trip.</p>}

              <Button onClick={submitEditGuests} disabled={guestQty === b.qty || actionLoading === "guests"} fullWidth className="py-3">
                {actionLoading === "guests" ? "Processing..." : guestDiff === 0 ? "No changes" : guestDiff > 0 ? "Add & Pay R" + (guestDiff * unitPrice) : "Confirm Removal"}
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
         CONTACT DETAILS MODAL
         ═══════════════════════════════════════════════════════ */}
      <Modal open={!!contactBooking} onClose={() => setContactBooking(null)} title="Contact Details">
        {contactBooking && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Name</label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" className="py-2.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Email</label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="your@email.com" className="py-2.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Phone</label>
              <Input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="27812345678" className="py-2.5" />
              <p className="text-[10px] text-[color:var(--textMuted)] mt-1">Full number with country code, no + or spaces</p>
            </div>
            <Button onClick={submitContactDetails} disabled={actionLoading === "contact"} fullWidth className="py-3 mt-2">
              {actionLoading === "contact" ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
         SPECIAL REQUEST MODAL
         ═══════════════════════════════════════════════════════ */}
      <Modal open={!!requestBooking} onClose={() => setRequestBooking(null)} title="Special Request">
        {requestBooking && (
          <div>
            <p className="text-sm text-[color:var(--textMuted)] mb-3">Dietary needs, celebrations, accessibility, or anything else.</p>
            <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)}
              placeholder="E.g. birthday celebration, vegetarian, wheelchair access..."
              rows={3} maxLength={500}
              className="w-full border-2 border-[color:var(--border)] rounded-xl p-3 text-sm bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)] resize-none" />
            <p className="text-[10px] text-[color:var(--textMuted)] text-right mb-4">{specialRequest.length}/500</p>
            <Button onClick={submitSpecialRequest} disabled={!specialRequest.trim() || actionLoading === "request"} fullWidth className="py-3">
              {actionLoading === "request" ? "Saving..." : "Save Request"}
            </Button>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
         CANCEL BOOKING MODAL
         ═══════════════════════════════════════════════════════ */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Booking">
        {cancelTarget && (() => {
          var pm = (cancelTarget.payment_method || "").toUpperCase();
          var isVoucherPaid = pm === "VOUCHER" || pm === "GIFT_VOUCHER";
          var isManualPaid = pm === "MANUAL" || pm === "CASH" || pm === "EFT";
          var isSplitPaid = pm === "SPLIT" || pm === "SPLIT_TENDER";

          return (
          <div>
            <div className="bg-[color:var(--surface2)] rounded-xl p-4 mb-5">
              <p className="font-semibold text-sm text-[color:var(--text)]">{cancelTarget.tours?.name}</p>
              {cancelTarget.slots?.start_time && <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{fmtDate(cancelTarget.slots.start_time)} at {fmtTime(cancelTarget.slots.start_time)}</p>}
              <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{cancelTarget.qty} {cancelTarget.qty === 1 ? "person" : "people"} &middot; R{cancelTarget.total_amount}</p>
            </div>

            <p className="text-sm font-semibold text-[color:var(--text)] mb-3">How would you like to proceed?</p>

            <div className="space-y-2 mb-5">
              <button onClick={submitCancelVoucher} disabled={actionLoading === "cancel"}
                className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Gift Voucher</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">
                      {isVoucherPaid
                        ? "Full value voucher (no fee)"
                        : "R" + cancelTarget.total_amount + " voucher \u00b7 No fees \u00b7 Valid 3 years"}
                    </p>
                  </div>
                  {!isManualPaid && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 ml-2">BEST VALUE</span>}
                </div>
              </button>

              {isManualPaid && (
                <div className="p-4 border border-[color:var(--border)] rounded-xl bg-amber-50 text-sm text-amber-800">
                  Manual refund will be arranged by our team
                </div>
              )}

              {isSplitPaid && (
                <button onClick={submitCancelRefund} disabled={actionLoading === "cancel"}
                  className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Refund</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">Voucher portion restored + card refund (less 5% fee on card amount)</p>
                  </div>
                </button>
              )}

              {!isVoucherPaid && !isManualPaid && !isSplitPaid && (
                <button onClick={submitCancelRefund} disabled={actionLoading === "cancel"}
                  className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Refund</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">R{(Number(cancelTarget.total_amount) * 0.95).toFixed(2)} (less 5% fee) &middot; 5-7 business days</p>
                  </div>
                </button>
              )}
            </div>

            {actionLoading === "cancel" && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-[color:var(--textMuted)]">
                <div className="spinner" /> Processing...
              </div>
            )}
          </div>
          );
        })()}
      </Modal>
    </div>
  );
}

/* ───── Small action button component ───── */
function ActionBtn({ label, onClick, disabled, variant = "default" }: { label: string; onClick: () => void; disabled?: boolean; variant?: "default" | "primary" | "danger" | "muted" }) {
  var cls = "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ";
  if (variant === "primary") cls += "bg-[color:var(--accent)] text-white hover:opacity-90";
  else if (variant === "danger") cls += "text-red-600 border border-red-200 hover:bg-red-50";
  else if (variant === "muted") cls += "text-[color:var(--textMuted)] border border-[color:var(--border)] hover:bg-[color:var(--surface2)]";
  else cls += "text-[color:var(--text)] border border-[color:var(--border)] hover:bg-[color:var(--surface2)] hover:border-[color:var(--accent)]";
  return <button onClick={onClick} disabled={disabled} className={cls}>{label}</button>;
}
