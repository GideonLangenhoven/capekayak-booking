const STORAGE_KEY = "bt-booking-draft-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

export type BookingDraft = {
  tourId: string | null;
  tourName: string | null;
  date: string | null;
  slotId: string | null;
  slotTime: string | null;
  qty: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  marketingConsent: boolean;
  promoCode: string;
  voucherCode: string;
  addOns: { id: string; qty: number }[];
  step: 1 | 2 | 3;
  savedAt: number;
  tenantSlug: string;
};

const empty: BookingDraft = {
  tourId: null, tourName: null, date: null, slotId: null, slotTime: null,
  qty: 1, customerName: "", customerEmail: "", customerPhone: "",
  marketingConsent: false, promoCode: "", voucherCode: "", addOns: [],
  step: 1, savedAt: 0, tenantSlug: "",
};

function getTenantSlug(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.split(".")[0] || "";
}

function readRaw(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function saveDraft(partial: Partial<BookingDraft>) {
  if (typeof window === "undefined") return;
  try {
    const existing = readRaw();
    const merged: BookingDraft = {
      ...empty,
      ...(existing ?? {}),
      ...partial,
      savedAt: Date.now(),
      tenantSlug: getTenantSlug(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch { /* localStorage may be disabled */ }
}

export function readValidDraft(): BookingDraft | null {
  const d = readRaw();
  if (!d) return null;
  const age = Date.now() - (d.savedAt || 0);
  const tenant = getTenantSlug();
  const valid = age >= 0 && age < TTL_MS && d.tenantSlug === tenant && !!d.tourId;
  if (!valid) {
    clearDraft();
    return null;
  }
  return d;
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

export function draftResumeUrl(d: BookingDraft): string {
  const qs = new URLSearchParams();
  if (d.tourId) qs.set("tour", d.tourId);
  if (d.slotId) qs.set("slot", d.slotId);
  if (d.date) qs.set("date", d.date);
  return "/book?" + qs.toString();
}
