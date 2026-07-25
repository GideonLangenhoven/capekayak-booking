import type { Slot } from "./types";

/**
 * How close to departure a slot stops being sellable. The booking flow hides
 * slots inside this window, so nothing may advertise one either (a last-minute
 * banner linking to a slot the flow won't show is a dead end).
 */
export const BOOKING_CUTOFF_MINUTES = 60;

/**
 * Per-person price when an EXISTING booking moves onto `slot`.
 *
 * Last-minute deals exist to fill unsold seats on new bookings. Letting a
 * paid customer reschedule into one would hand them a refundable difference,
 * so rebook-booking prices those legs at the tour's base price — these
 * previews must show the same number.
 */
export function rescheduleUnitPrice(
  slot: Pick<Slot, "price_per_person_override" | "last_minute_at">,
  basePrice: number | null | undefined,
): number {
  const base = Number(basePrice || 0);
  if (slot.price_per_person_override == null) return base;
  const override = Number(slot.price_per_person_override);
  // Only a genuine discount is skipped. If the flag outlived its deal (an
  // operator re-priced the slot upward), honour the price on the slot —
  // trusting the flag alone would undercharge.
  if (slot.last_minute_at && override < base) return base;
  return override;
}
