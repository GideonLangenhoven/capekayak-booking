import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Combo Package | Book Your Tour",
};

export default function ComboLayout({ children }: { children: React.ReactNode }) {
  return children;
}
