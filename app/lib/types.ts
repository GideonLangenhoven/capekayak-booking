/* Shared TypeScript interfaces — matches Supabase column shapes used across the booking site */

export interface Tour {
  id: string;
  business_id: string;
  name: string;
  image_url?: string | null;
  duration_minutes: number;
  base_price_per_person: number;
  hidden?: boolean;
  active?: boolean;
  meeting_point?: string | null;
  what_to_bring?: string | null;
}

export interface Slot {
  id: string;
  tour_id: string;
  start_time: string;
  status: string;
  capacity_total: number;
  booked: number;
  held: number;
  price_per_person_override?: number | null;
  tours?: Pick<Tour, "name" | "base_price_per_person">;
}

export interface Booking {
  id: string;
  business_id: string;
  tour_id: string;
  slot_id: string;
  customer_name: string;
  email: string;
  phone: string;
  qty: number;
  unit_price: number;
  total_amount: number;
  original_total?: number;
  status: string;
  source?: string;
  refund_status?: string | null;
  refund_amount?: number | null;
  created_at: string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  converted_to_voucher_id?: string | null;
  custom_fields?: Record<string, string> | null;
  waiver_status?: string | null;
  waiver_token?: string | null;
  waiver_token_expires_at?: string | null;
  waiver_signed_at?: string | null;
  waiver_signed_name?: string | null;
  waiver_payload?: Record<string, unknown> | null;
  yoco_payment_id?: string | null;
  marketing_opt_in?: boolean | null;
  slots?: { start_time: string; capacity_total: number; booked: number; held: number };
  tours?: { name: string; duration_minutes?: number; meeting_point?: string | null; what_to_bring?: string | null };
}

export interface Voucher {
  id: string;
  business_id: string;
  code: string;
  status: string;
  type?: string;
  value: number;
  purchase_amount?: number;
  current_balance?: number;
  expires_at?: string | null;
  recipient_name?: string | null;
  gift_message?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  tour_name?: string | null;
  redeemed_booking_id?: string | null;
}

export interface ComboOffer {
  id: string;
  name: string;
  combo_price: number;
  original_price: number;
  currency?: string;
  active: boolean;
  tour_a: Tour;
  tour_b: Tour;
}

export interface Business {
  id: string;
  name: string;
  business_name?: string;
  timezone?: string;
}

export interface VoucherCredit {
  id: string;
  code: string;
  value: number;
}

export interface ChatMessage {
  role: "user" | "bot";
  text: string;
  buttons?: ChatButton[];
  paymentUrl?: string;
  calendar?: CalendarDate[];
}

export interface ChatButton {
  label: string;
  value: string;
}

export interface CalendarDate {
  date: string;
  label: string;
  slots: { id: string; start_time: string }[];
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
}

export interface AppliedPromo {
  id: string;
  code: string;
  discount_type: "FLAT" | "PERCENT";
  discount_value: number;
}

export interface BookingLog {
  id: string;
  booking_id: string;
  action: string;
  created_at: string;
  details?: string | null;
}
