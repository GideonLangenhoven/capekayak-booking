import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Bookings | Book Your Tour",
};

export default function MyBookingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
